from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import pandas as pd
import numpy as np
from contextlib import asynccontextmanager

from data_engine import generate_micro_telemetry
from models import PredictiveGuard, FEATURE_COLS
from causal_engine import CausalRemediationEngine

# Global State Store & Model Instances
STATE_STORE: Dict[str, Dict[str, Any]] = {}
guard = PredictiveGuard()
causal_engine = CausalRemediationEngine()

# Pydantic Request & Response Schemas
class RootCauseItem(BaseModel):
    feature: str
    contribution_hrs: float

class RecommendedAction(BaseModel):
    action_type: str
    estimated_hours_saved: float
    post_action_predicted_delay_hrs: float

class PromiseResponse(BaseModel):
    tracking_id: str
    promised_eta: str
    predicted_delay_hrs: float
    sla_breach_predicted: bool
    advance_notice_hours: float
    current_status: str
    root_cause_diagnosis: List[RootCauseItem]
    recommended_action: RecommendedAction

class DeliveryActionRequest(BaseModel):
    action: str = Field(..., json_schema_extra={"example": "REROUTE_TO_LOCKER"})
    locker_id: str = Field(..., json_schema_extra={"example": "LOCKER-WEST-04"})

class DeliveryActionResponse(BaseModel):
    tracking_id: str
    status: str
    new_fulfillment_state: str
    updated_predicted_delay_hrs: float
    sla_saved: bool

@asynccontextmanager
async def lifespan(app: FastAPI):
    global STATE_STORE, guard, causal_engine
    print("Initializing Parcel Guard Intelligence Engine...")
    
    # 1. Generate Micro-Telemetry Stream Snapshots
    df_telemetry = generate_micro_telemetry(n_samples=2000, random_state=42)
    
    # 2. Train Models
    print("Training Predictive Guard model...")
    guard.fit(df_telemetry)
    
    adr6 = guard.compute_advance_detection_rate(df_telemetry, n_hours=6.0)
    print(f"Predictive Guard fitted. 6-Hour Advance Detection Rate (ADR_6): {adr6:.4f}")
    
    print("Training Causal Remediation Engine (CausalForestDML)...")
    causal_engine.fit(df_telemetry)
    print("Causal Engine fitted successfully.")
    
    # 3. Populate In-Memory State Store
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
            "carrier_id": str(row["carrier_id"]),
            "priority_tier": str(row["priority_tier"]),
            "locker_rerouted": int(row["locker_rerouted"]),
            "current_status": "REROUTED_TO_LOCKER" if int(row["locker_rerouted"]) == 1 else "STANDARD_DELIVERY",
            "locker_id": None
        }
    print(f"State Store loaded with {len(STATE_STORE)} active parcel records.")
    yield

app = FastAPI(
    title="Parcel Guard Intelligence Layer",
    description="Proactive parcel SLA breach detection, XAI diagnostics, and causal remediation REST engine.",
    version="1.0.0",
    lifespan=lifespan
)

def build_row_df(parcel_data: Dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame([{
        "distance_remaining_km": parcel_data["distance_remaining_km"],
        "hub_waiting_time_hrs": parcel_data["hub_waiting_time_hrs"],
        "weather_severity": parcel_data["weather_severity"],
        "traffic_index": parcel_data["traffic_index"],
        "locker_rerouted": parcel_data["locker_rerouted"]
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
    
    # 1. Realtime Delay Prediction
    predicted_delay = float(guard.predict(row_df)[0])
    predicted_delay = round(predicted_delay, 1)
    sla_breach = predicted_delay > 0
    
    # 2. Lead Time Calculation
    advance_notice = round(calculate_advance_notice_hours(parcel["current_timestamp"], parcel["promised_eta"]), 1)
    
    # 3. TreeSHAP Root Cause Diagnosis
    root_causes = guard.get_root_causes(row_df, top_k=3)
    root_cause_items = [RootCauseItem(**item) for item in root_causes]
    
    # 4. Causal Effect Estimation
    estimated_hours_saved = causal_engine.estimate_remediation_effect(row_df)
    
    # Hypothetical post-action prediction
    hypo_df = row_df.copy()
    hypo_df["locker_rerouted"] = 1
    post_action_delay = max(0.0, float(guard.predict(hypo_df)[0]))
    post_action_delay = round(post_action_delay, 1)
    
    return PromiseResponse(
        tracking_id=parcel["tracking_id"],
        promised_eta=parcel["promised_eta"],
        predicted_delay_hrs=predicted_delay,
        sla_breach_predicted=sla_breach,
        advance_notice_hours=advance_notice,
        current_status=parcel["current_status"],
        root_cause_diagnosis=root_cause_items,
        recommended_action=RecommendedAction(
            action_type="REROUTE_TO_LOCKER",
            estimated_hours_saved=round(estimated_hours_saved, 1),
            post_action_predicted_delay_hrs=post_action_delay
        )
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
            "locker_rerouted": parcel["locker_rerouted"]
        })
        lead_times.append(calculate_advance_notice_hours(parcel["current_timestamp"], parcel["promised_eta"]))
        
    df_all = pd.DataFrame(rows)
    preds = guard.predict(df_all)
    
    at_risk = []
    for idx, (parcel, pred, lead_time) in enumerate(zip(parcels_list, preds, lead_times)):
        if pred > 0 and lead_time >= min_lead_hours:
            at_risk.append(get_parcel_promise(parcel["tracking_id"]))
            if len(at_risk) >= 50:
                break
                
    return at_risk

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
