from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from datetime import datetime
import pandas as pd
import numpy as np
from contextlib import asynccontextmanager

from data_engine import generate_micro_telemetry
from models import PredictiveGuard, FEATURE_COLS, CATEGORICAL_COLS
from causal_engine import CausalRemediationEngine
from advanced_analytics import AdvancedCausalAnalytics
from fleet_optimizer import (
    calculate_financial_metrics,
    optimize_fleet_interventions,
    render_customer_notification,
    REROUTE_COST_USD,
    PENALTY_MAP
)

# Global State Store & Model Instances
STATE_STORE: Dict[str, Dict[str, Any]] = {}
guard = PredictiveGuard()
causal_engine = CausalRemediationEngine()
advanced_analytics = AdvancedCausalAnalytics()

# Pydantic Request & Response Schemas
class RootCauseItem(BaseModel):
    feature: str
    contribution_hrs: float

class RecommendedAction(BaseModel):
    action_type: str
    estimated_hours_saved: float
    post_action_predicted_delay_hrs: float

class ConformalInterval(BaseModel):
    lower_bound_hrs: float
    upper_bound_hrs: float
    confidence_level: float = 0.90

class SurvivalProbabilities(BaseModel):
    breach_p_2h: float
    breach_p_6h: float
    breach_p_12h: float
    breach_p_24h: float

class FinancialMetrics(BaseModel):
    sla_penalty_usd: float
    reroute_cost_usd: float
    net_dollars_saved: float

class PromiseResponse(BaseModel):
    tracking_id: str
    promised_eta: str
    predicted_delay_hrs: float
    delay_lower_bound_hrs: float
    delay_upper_bound_hrs: float
    sla_breach_predicted: bool
    advance_notice_hours: float
    current_status: str
    priority_tier: str
    root_cause_diagnosis: List[RootCauseItem]
    recommended_action: RecommendedAction
    conformal_interval: ConformalInterval
    survival_probabilities: SurvivalProbabilities
    financial_metrics: FinancialMetrics

class DeliveryActionRequest(BaseModel):
    action: str = Field(..., json_schema_extra={"example": "REROUTE_TO_LOCKER"})
    locker_id: str = Field(..., json_schema_extra={"example": "LOCKER-WEST-04"})

class DeliveryActionResponse(BaseModel):
    tracking_id: str
    status: str
    new_fulfillment_state: str
    updated_predicted_delay_hrs: float
    sla_saved: bool

class FleetOptimizeRequest(BaseModel):
    locker_capacities: Optional[Dict[str, int]] = Field(
        default=None,
        json_schema_extra={"example": {"LOCKER-WEST-01": 15, "LOCKER-WEST-02": 20, "LOCKER-NORTH-01": 10}}
    )

class StressTestRequest(BaseModel):
    weather_spike: float = Field(0.8, ge=0.0, le=1.0)
    affected_region: str = Field("SOUTH", json_schema_extra={"example": "SOUTH"})

@asynccontextmanager
async def lifespan(app: FastAPI):
    global STATE_STORE, guard, causal_engine, advanced_analytics
    print("Initializing Parcel Guard Intelligence Engine...")
    
    # 1. Generate Micro-Telemetry Stream Snapshots
    df_telemetry = generate_micro_telemetry(n_samples=2000, random_state=42)
    
    # 2. Train Supervised & Causal Models
    print("Training Predictive Guard CatBoost + LightGBM Quantile Ensemble...")
    guard.fit(df_telemetry)
    adr6 = guard.compute_advance_detection_rate(df_telemetry, n_hours=6.0)
    print(f"Predictive Guard fitted. 6-Hour Advance Detection Rate (ADR_6): {adr6:.4f}")
    
    print("Training Causal Remediation Engine (CausalForestDML)...")
    causal_engine.fit(df_telemetry)
    print("Causal Engine fitted successfully.")
    
    # 3. Train Advanced Analytics (Survival & Conformal Calibration)
    print("Fitting Survival Analysis & Conformal Calibration...")
    advanced_analytics.fit_survival_model(df_telemetry)
    y_pred_calib = guard.predict(df_telemetry)
    advanced_analytics.calibrate_conformal_bounds(df_telemetry["final_actual_delay_hrs"].values, y_pred_calib)
    print("Advanced Analytics fitted successfully.")
    
    # 4. Populate In-Memory State Store
    for _, row in df_telemetry.iterrows():
        tid = str(row["tracking_id"])
        STATE_STORE[tid] = {
            "tracking_id": tid,
            "current_timestamp": str(row["current_timestamp"]),
            "promised_eta": str(row["promised_eta"]),
            "distance_remaining_km": float(row["distance_remaining_km"]),
            "hub_waiting_time_hrs": float(row["hub_waiting_time_hrs"]),
            "weather_severity": float(row["weather_severity"]),
            "traffic_index": float(row["traffic_index"]),
            "carrier_id": str(row.get("carrier_id", "CARRIER_A")),
            "priority_tier": str(row.get("priority_tier", "STANDARD")),
            "origin_hub": str(row.get("origin_hub", "HUB_SP_01")),
            "destination_hub": str(row.get("destination_hub", "HUB_SOUTH_01")),
            "locker_rerouted": int(row["locker_rerouted"]),
            "current_status": "REROUTED_TO_LOCKER" if int(row["locker_rerouted"]) == 1 else "STANDARD_DELIVERY",
            "locker_id": None
        }
    print(f"State Store loaded with {len(STATE_STORE)} active parcel records.")
    yield

app = FastAPI(
    title="Parcel Guard Intelligence Layer",
    description="Proactive parcel SLA breach detection, CatBoost/LGBM Quantile Risk Engine, XAI diagnostics, causal remediation, and ILP fleet optimization REST suite.",
    version="2.1.0",
    lifespan=lifespan
)

origins = [
    "http://localhost:3000",      # React/Next.js local server
    "http://127.0.0.1:5500",     # Live Server extension local server
    "https://yourfrontend.com",  # Your production website
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # Allows specific origins
    allow_credentials=True,           # Allows cookies / authentication headers
    allow_methods=["*"],              # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],              # Allows all headers
)


@app.get("/")
def read_root():
    return {"message": "CORS is configured successfully!"}

@app.get("/health")
def read_health():
    return {"status": "Application is up"}

def build_row_df(parcel_data: Dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame([{
        "distance_remaining_km": parcel_data["distance_remaining_km"],
        "hub_waiting_time_hrs": parcel_data["hub_waiting_time_hrs"],
        "weather_severity": parcel_data["weather_severity"],
        "traffic_index": parcel_data["traffic_index"],
        "locker_rerouted": parcel_data["locker_rerouted"],
        "carrier_id": parcel_data.get("carrier_id", "CARRIER_A"),
        "priority_tier": parcel_data.get("priority_tier", "STANDARD"),
        "origin_hub": parcel_data.get("origin_hub", "HUB_SP_01"),
        "destination_hub": parcel_data.get("destination_hub", "HUB_SOUTH_01"),
        "lead_time_hrs": calculate_advance_notice_hours(parcel_data["current_timestamp"], parcel_data["promised_eta"])
    }])

def calculate_advance_notice_hours(curr_ts_str: str, eta_str: str) -> float:
    try:
        curr_dt = datetime.fromisoformat(curr_ts_str)
        eta_dt = datetime.fromisoformat(eta_str)
        diff_hrs = (eta_dt - curr_dt).total_seconds() / 3600.0
        return max(0.0, float(diff_hrs))
    except Exception:
        return 8.0

@app.get("/parcel/{tracking_id}/promise", response_model=PromiseResponse)
def get_parcel_promise(tracking_id: str):
    if tracking_id not in STATE_STORE:
        raise HTTPException(status_code=404, detail=f"Parcel tracking ID '{tracking_id}' not found.")
        
    parcel = STATE_STORE[tracking_id]
    row_df = build_row_df(parcel)
    
    # 1. Quantile Risk Bounds & Stacking Ensemble Delay Prediction
    risk_bounds = guard.predict_quantile_bounds(row_df)
    predicted_delay = risk_bounds["predicted_delay_hrs"]
    q10_delay = risk_bounds["delay_lower_bound_hrs"]
    q90_delay = risk_bounds["delay_upper_bound_hrs"]
    sla_breach = risk_bounds["sla_breach_risk_flag"]
    
    # 2. Lead Time Calculation
    advance_notice = round(calculate_advance_notice_hours(parcel["current_timestamp"], parcel["promised_eta"]), 1)
    
    # 3. TreeSHAP Root Cause Diagnosis
    root_causes = guard.get_root_causes(row_df, top_k=3)
    root_cause_items = [RootCauseItem(**item) for item in root_causes]
    
    # 4. Causal Effect Estimation
    estimated_hours_saved = causal_engine.estimate_remediation_effect(row_df)
    
    hypo_df = row_df.copy()
    hypo_df["locker_rerouted"] = 1
    post_action_delay = max(0.0, float(guard.predict(hypo_df)[0]))
    post_action_delay = round(post_action_delay, 1)
    
    # 5. Advanced Analytics & Financial Calculations
    conf_bounds = advanced_analytics.predict_conformal_interval(predicted_delay)
    surv_probs = advanced_analytics.predict_survival_probabilities(row_df)
    fin_metrics = calculate_financial_metrics(parcel["priority_tier"], predicted_delay, estimated_hours_saved)
    
    return PromiseResponse(
        tracking_id=parcel["tracking_id"],
        promised_eta=parcel["promised_eta"],
        predicted_delay_hrs=predicted_delay,
        delay_lower_bound_hrs=q10_delay,
        delay_upper_bound_hrs=q90_delay,
        sla_breach_predicted=sla_breach,
        advance_notice_hours=advance_notice,
        current_status=parcel["current_status"],
        priority_tier=parcel["priority_tier"],
        root_cause_diagnosis=root_cause_items,
        recommended_action=RecommendedAction(
            action_type="REROUTE_TO_LOCKER",
            estimated_hours_saved=round(estimated_hours_saved, 1),
            post_action_predicted_delay_hrs=post_action_delay
        ),
        conformal_interval=ConformalInterval(**conf_bounds),
        survival_probabilities=SurvivalProbabilities(**surv_probs),
        financial_metrics=FinancialMetrics(**fin_metrics)
    )

@app.post("/parcel/{tracking_id}/delivery-action", response_model=DeliveryActionResponse)
def execute_delivery_action(tracking_id: str, payload: DeliveryActionRequest):
    if tracking_id not in STATE_STORE:
        raise HTTPException(status_code=404, detail=f"Parcel tracking ID '{tracking_id}' not found.")
        
    parcel = STATE_STORE[tracking_id]
    
    if payload.action == "REROUTE_TO_LOCKER":
        parcel["locker_rerouted"] = 1
        parcel["current_status"] = "REROUTED_TO_LOCKER"
        parcel["locker_id"] = payload.locker_id
        
        row_df = build_row_df(parcel)
        updated_delay = float(guard.predict(row_df)[0])
        updated_delay = round(updated_delay, 1)
        sla_saved = updated_delay <= 0
        
        return DeliveryActionResponse(
            tracking_id=tracking_id,
            status="SUCCESS",
            new_fulfillment_state="REROUTED_TO_LOCKER",
            updated_predicted_delay_hrs=updated_delay,
            sla_saved=sla_saved
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported action type '{payload.action}'.")

@app.get("/parcels/at-risk", response_model=List[PromiseResponse])
def get_at_risk_parcels(min_lead_hours: float = Query(6.0, ge=0.0)):
    if not STATE_STORE:
        return []
        
    parcels_list = list(STATE_STORE.values())
    rows = []
    lead_times = []
    
    for parcel in parcels_list:
        rows.append({
            "distance_remaining_km": parcel["distance_remaining_km"],
            "hub_waiting_time_hrs": parcel["hub_waiting_time_hrs"],
            "weather_severity": parcel["weather_severity"],
            "traffic_index": parcel["traffic_index"],
            "locker_rerouted": parcel["locker_rerouted"],
            "carrier_id": parcel.get("carrier_id", "CARRIER_A"),
            "priority_tier": parcel.get("priority_tier", "STANDARD"),
            "origin_hub": parcel.get("origin_hub", "HUB_SP_01"),
            "destination_hub": parcel.get("destination_hub", "HUB_SOUTH_01")
        })
        lead_times.append(calculate_advance_notice_hours(parcel["current_timestamp"], parcel["promised_eta"]))
        
    df_all = pd.DataFrame(rows)
    preds = guard.predict(df_all)
    
    at_risk = []
    for parcel, pred, lead_time in zip(parcels_list, preds, lead_times):
        if pred > 0 and lead_time >= min_lead_hours:
            at_risk.append(get_parcel_promise(parcel["tracking_id"]))
            if len(at_risk) >= 50:
                break
                
    return at_risk

@app.get("/analytics/roi-dashboard")
def get_roi_dashboard():
    if not STATE_STORE:
        return {"error": "State store empty."}
        
    parcels = list(STATE_STORE.values())
    rows = []
    for p in parcels:
        rows.append({
            "distance_remaining_km": p["distance_remaining_km"],
            "hub_waiting_time_hrs": p["hub_waiting_time_hrs"],
            "weather_severity": p["weather_severity"],
            "traffic_index": p["traffic_index"],
            "locker_rerouted": p["locker_rerouted"],
            "carrier_id": p.get("carrier_id", "CARRIER_A"),
            "priority_tier": p.get("priority_tier", "STANDARD"),
            "origin_hub": p.get("origin_hub", "HUB_SP_01"),
            "destination_hub": p.get("destination_hub", "HUB_SOUTH_01"),
            "final_actual_delay_hrs": 0.6*p["hub_waiting_time_hrs"] + 3.0*p["weather_severity"] + 2.5*p["traffic_index"],
            "lead_time_hrs": calculate_advance_notice_hours(p["current_timestamp"], p["promised_eta"])
        })
    df_all = pd.DataFrame(rows)
    
    preds = guard.predict(df_all)
    cate_preds = np.where(df_all["hub_waiting_time_hrs"] > 1.5, 3.0, 0.5)
    
    adr6 = guard.compute_advance_detection_rate(df_all, n_hours=6.0)
    auuc_metrics = advanced_analytics.evaluate_policy_auuc(df_all, cate_preds)
    
    total_net_dollars = 0.0
    slas_protected = 0
    for p, pred in zip(parcels, preds):
        if pred > 0:
            fin = calculate_financial_metrics(p["priority_tier"], pred, 2.5)
            total_net_dollars += fin["net_dollars_saved"]
            if p["locker_rerouted"] == 1 or fin["net_dollars_saved"] > 0:
                slas_protected += 1
                
    return {
        "fleet_size": len(parcels),
        "at_risk_count": int(sum(pred > 0 and lead_time >= 6.0 for pred, lead_time in zip(preds, df_all["lead_time_hrs"]))),
        "slas_protected_count": slas_protected,
        "total_net_dollars_protected": round(total_net_dollars, 2),
        "advance_detection_rate_6h_pct": round(adr6 * 100, 1),
        "auuc_uplift_score": auuc_metrics["auuc_score"],
        "qini_score": auuc_metrics["qini_score"],
        "policy_lift_vs_random_pct": auuc_metrics["policy_lift_vs_random_pct"]
    }

@app.post("/fleet/optimize-batch")
def optimize_fleet_batch(request: FleetOptimizeRequest):
    at_risk_list = []
    for tid, parcel in STATE_STORE.items():
        row_df = build_row_df(parcel)
        pred_delay = float(guard.predict(row_df)[0])
        lead_time = calculate_advance_notice_hours(parcel["current_timestamp"], parcel["promised_eta"])
        
        if pred_delay > 0 and lead_time >= 2.0:
            hours_saved = causal_engine.estimate_remediation_effect(row_df)
            at_risk_list.append({
                "tracking_id": tid,
                "priority_tier": parcel["priority_tier"],
                "predicted_delay_hrs": pred_delay,
                "estimated_hours_saved": hours_saved
            })
            if len(at_risk_list) >= 100:
                break
                
    res = optimize_fleet_interventions(at_risk_list, request.locker_capacities)
    return res

@app.get("/parcel/{tracking_id}/customer-message")
def get_customer_message(tracking_id: str):
    if tracking_id not in STATE_STORE:
        raise HTTPException(status_code=404, detail=f"Parcel tracking ID '{tracking_id}' not found.")
        
    parcel = STATE_STORE[tracking_id]
    row_df = build_row_df(parcel)
    root_causes = guard.get_root_causes(row_df, top_k=2)
    hours_saved = causal_engine.estimate_remediation_effect(row_df)
    locker_id = parcel.get("locker_id") or "LOCKER-WEST-01"
    
    msg = render_customer_notification(
        tracking_id=tracking_id,
        root_causes=root_causes,
        locker_id=locker_id,
        promised_eta=parcel["promised_eta"],
        hours_saved=hours_saved
    )
    return {
        "tracking_id": tracking_id,
        "customer_message": msg,
        "notification_channel": "SMS_AND_PUSH"
    }

@app.post("/simulation/stress-test")
def run_simulation_stress_test(request: StressTestRequest):
    global STATE_STORE
    affected_count = 0
    affected_region = request.affected_region.strip().upper()
    
    for tid, parcel in STATE_STORE.items():
        parcel_region = f'{parcel.get("origin_hub", "")} {parcel.get("destination_hub", "")}'.upper()
        region_matches = affected_region in {"ALL", "NETWORK"} or affected_region in parcel_region
        if region_matches and np.random.rand() > 0.3:
            parcel["weather_severity"] = min(1.0, parcel["weather_severity"] + request.weather_spike * 0.5)
            parcel["hub_waiting_time_hrs"] += request.weather_spike * 2.0
            affected_count += 1
            
    at_risk_items = []
    for tid, parcel in list(STATE_STORE.items())[:50]:
        row_df = build_row_df(parcel)
        pred_delay = float(guard.predict(row_df)[0])
        hours_saved = causal_engine.estimate_remediation_effect(row_df)
        at_risk_items.append({
            "tracking_id": tid,
            "priority_tier": parcel["priority_tier"],
            "predicted_delay_hrs": pred_delay,
            "estimated_hours_saved": hours_saved
        })
        
    optimization_summary = optimize_fleet_interventions(at_risk_items)
    
    return {
        "simulation_status": "COMPLETED",
        "weather_spike_applied": request.weather_spike,
        "affected_region": affected_region,
        "affected_parcels_count": affected_count,
        "reallocation_summary": optimization_summary
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
