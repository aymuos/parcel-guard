import pytest
from fastapi.testclient import TestClient
import numpy as np
import pandas as pd

from main import app, STATE_STORE, guard, causal_engine, advanced_analytics
from data_engine import generate_micro_telemetry
from fleet_optimizer import optimize_fleet_interventions, render_customer_notification

client = TestClient(app)

def test_telemetry_generation():
    df = generate_micro_telemetry(n_samples=100)
    assert len(df) == 100
    expected_cols = [
        "tracking_id", "current_timestamp", "promised_eta", "distance_remaining_km",
        "hub_waiting_time_hrs", "weather_severity", "traffic_index", "carrier_id",
        "priority_tier", "origin_hub", "destination_hub", "locker_rerouted", "final_actual_delay_hrs"
    ]
    for col in expected_cols:
        assert col in df.columns

def test_predictive_guard_catboost_lgbm_ensemble():
    df = generate_micro_telemetry(n_samples=500)
    guard.fit(df)
    
    preds = guard.predict(df)
    assert len(preds) == 500
    
    bounds = guard.predict_quantile_bounds(df.head(1))
    assert "predicted_delay_hrs" in bounds
    assert "delay_lower_bound_hrs" in bounds
    assert "delay_upper_bound_hrs" in bounds
    assert bounds["delay_lower_bound_hrs"] <= bounds["delay_upper_bound_hrs"]
    
    adr6 = guard.compute_advance_detection_rate(df, n_hours=6.0)
    assert 0.0 <= adr6 <= 1.0

def test_tree_shap_root_causes():
    df = generate_micro_telemetry(n_samples=200)
    guard.fit(df)
    
    row = df.head(1)
    causes = guard.get_root_causes(row, top_k=3)
    assert isinstance(causes, list)
    assert len(causes) <= 3
    if len(causes) > 0:
        assert "feature" in causes[0]
        assert "contribution_hrs" in causes[0]

def test_causal_engine():
    df = generate_micro_telemetry(n_samples=500)
    causal_engine.fit(df)
    
    row_high = df[df["hub_waiting_time_hrs"] > 1.5].head(1)
    if len(row_high) > 0:
        saved = causal_engine.estimate_remediation_effect(row_high)
        assert isinstance(saved, float)
        assert saved >= 0.0

def test_causal_dag_and_survival():
    df = generate_micro_telemetry(n_samples=300)
    dag_res = advanced_analytics.discover_causal_dag(df)
    assert "inferred_edges" in dag_res
    
    advanced_analytics.fit_survival_model(df)
    surv_p = advanced_analytics.predict_survival_probabilities(df.head(1))
    assert "breach_p_6h" in surv_p
    assert 0.0 <= surv_p["breach_p_6h"] <= 1.0
    
    conf = advanced_analytics.predict_conformal_interval(2.5)
    assert "lower_bound_hrs" in conf
    assert "upper_bound_hrs" in conf

def test_ilp_fleet_optimization():
    sample_parcels = [
        {"tracking_id": "TEST-01", "priority_tier": "VIP", "predicted_delay_hrs": 3.0, "estimated_hours_saved": 2.5},
        {"tracking_id": "TEST-02", "priority_tier": "EXPRESS", "predicted_delay_hrs": 2.0, "estimated_hours_saved": 1.8},
        {"tracking_id": "TEST-03", "priority_tier": "STANDARD", "predicted_delay_hrs": 1.0, "estimated_hours_saved": 0.5}
    ]
    opt_res = optimize_fleet_interventions(sample_parcels)
    assert "total_net_dollars_saved" in opt_res
    assert opt_res["total_allocated"] >= 1
    assert "TEST-03" in opt_res["unassigned_parcels"]

def test_expanded_fastapi_endpoints():
    with TestClient(app) as test_client:
        assert len(STATE_STORE) > 0
        sample_tid = list(STATE_STORE.keys())[0]
        
        # 1. GET /parcel/{tracking_id}/promise
        res_promise = test_client.get(f"/parcel/{sample_tid}/promise")
        assert res_promise.status_code == 200
        data_promise = res_promise.json()
        assert "delay_lower_bound_hrs" in data_promise
        assert "delay_upper_bound_hrs" in data_promise
        assert "conformal_interval" in data_promise
        assert "survival_probabilities" in data_promise
        assert "financial_metrics" in data_promise
        
        # 2. POST /parcel/{tracking_id}/delivery-action
        action_payload = {"action": "REROUTE_TO_LOCKER", "locker_id": "LOCKER-TEST-01"}
        res_action = test_client.post(f"/parcel/{sample_tid}/delivery-action", json=action_payload)
        assert res_action.status_code == 200
        assert res_action.json()["status"] == "SUCCESS"
        
        # 3. GET /analytics/roi-dashboard
        res_roi = test_client.get("/analytics/roi-dashboard")
        assert res_roi.status_code == 200
        data_roi = res_roi.json()
        assert "total_net_dollars_protected" in data_roi
        
        # 4. POST /fleet/optimize-batch
        opt_payload = {"locker_capacities": {"LOCKER-TEST-01": 50}}
        res_opt = test_client.post("/fleet/optimize-batch", json=opt_payload)
        assert res_opt.status_code == 200
        
        # 5. GET /parcel/{tracking_id}/customer-message
        res_msg = test_client.get(f"/parcel/{sample_tid}/customer-message")
        assert res_msg.status_code == 200
        
        # 6. POST /simulation/stress-test
        stress_payload = {"weather_spike": 0.5, "affected_region": "SOUTH"}
        res_stress = test_client.post("/simulation/stress-test", json=stress_payload)
        assert res_stress.status_code == 200
