import pytest
from fastapi.testclient import TestClient
import numpy as np
import pandas as pd

from main import app, STATE_STORE, guard, causal_engine
from data_engine import generate_micro_telemetry

client = TestClient(app)

def test_telemetry_generation():
    df = generate_micro_telemetry(n_samples=100)
    assert len(df) == 100
    expected_cols = [
        "tracking_id", "current_timestamp", "promised_eta", "distance_remaining_km",
        "hub_waiting_time_hrs", "weather_severity", "traffic_index", "carrier_id",
        "priority_tier", "locker_rerouted", "final_actual_delay_hrs"
    ]
    for col in expected_cols:
        assert col in df.columns

def test_predictive_guard_and_adr():
    df = generate_micro_telemetry(n_samples=500)
    guard.fit(df)
    
    preds = guard.predict(df)
    assert len(preds) == 500
    
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

def test_fastapi_endpoints():
    # Trigger startup event manually for test client
    with TestClient(app) as test_client:
        assert len(STATE_STORE) > 0
        sample_tid = list(STATE_STORE.keys())[0]
        
        # 1. GET /parcel/{tracking_id}/promise
        res_promise = test_client.get(f"/parcel/{sample_tid}/promise")
        assert res_promise.status_code == 200
        data_promise = res_promise.json()
        assert data_promise["tracking_id"] == sample_tid
        assert "predicted_delay_hrs" in data_promise
        assert "sla_breach_predicted" in data_promise
        assert "advance_notice_hours" in data_promise
        assert "root_cause_diagnosis" in data_promise
        assert "recommended_action" in data_promise
        
        # 2. POST /parcel/{tracking_id}/delivery-action
        action_payload = {
            "action": "REROUTE_TO_LOCKER",
            "locker_id": "LOCKER-TEST-01"
        }
        res_action = test_client.post(f"/parcel/{sample_tid}/delivery-action", json=action_payload)
        assert res_action.status_code == 200
        data_action = res_action.json()
        assert data_action["status"] == "SUCCESS"
        assert data_action["new_fulfillment_state"] == "REROUTED_TO_LOCKER"
        assert "updated_predicted_delay_hrs" in data_action
        assert "sla_saved" in data_action
        
        # Verify state store updated
        assert STATE_STORE[sample_tid]["locker_rerouted"] == 1
        assert STATE_STORE[sample_tid]["current_status"] == "REROUTED_TO_LOCKER"
        
        # 3. GET /parcels/at-risk
        res_at_risk = test_client.get("/parcels/at-risk?min_lead_hours=1.0")
        assert res_at_risk.status_code == 200
        data_at_risk = res_at_risk.json()
        assert isinstance(data_at_risk, list)
