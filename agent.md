Act as a Principal Staff AI/Logistics Engineer. Build a complete, production-ready Python FastAPI prototype for "Parcel Guard" — an overlay intelligence layer for proactive parcel SLA breach detection, XAI diagnostics, and causal remediation.

The target environment contains real datasets located in the `./data/` folder:
- Brazilian E-Commerce Dataset (Olist) - "data\Brazilian E-Commerce Public Dataset by Olist.csv"
- DataCo Supply Chain Dataset - "data\DataCoSupplyChainDataset.csv"

### Architectural Requirements & Pipeline Specifications

1. DATA INGESTION & HYBRID TELEMETRY ENGINE
- Load real order timestamps, locations, and promised delivery dates from `./data/olist_*` or `./data/DataCoSupplyChainDataset.csv`.
- Create a feature-enrichment function to augment real orders with synthetic micro-telemetry stream snapshots:
  - Schema: [tracking_id, current_timestamp, promised_eta, distance_remaining_km, hub_waiting_time_hrs, weather_severity (0-1), traffic_index (0-1), carrier_id, priority_tier, locker_rerouted (0/1), final_actual_delay_hrs]
- Inject Confounding & CATE Mechanisms:
  a. Confounders W = [distance_remaining_km, weather_severity, traffic_index]
  b. Propensity Model: P(locker_rerouted = 1 | W) = Sigmoid(0.005 * distance + 2.0 * weather - 1.5)
  c. CATE tau(X): Rerouting to a locker saves -3.0 hours if hub_waiting_time_hrs > 1.5; saves -0.5 hours otherwise (Locker bypasses hub bottlenecks).
  d. Target Delay Y = 0.6 * hub_waiting_time + 3.0 * weather_severity + 2.5 * traffic_index + tau(X) * locker_rerouted + Noise(std=0.5).

2. PREDICTIVE GUARD (Supervised SLA Breach Model)
- Train a LightGBM/XGBoost regressor on processed snapshots to predict `projected_delay_hrs`.
- Compute N-Hour Advance Detection Rate metric:
  ADR_N = (Breaches detected >= N hours before promised_eta) / (Total actual breaches)
  Target evaluation window: N = 6 hours.

3. DIAGNOSTIC LAYER (XAI Root Cause)
- Implement TreeSHAP over the LightGBM/XGBoost regressor.
- Create a helper `get_root_causes(tracking_id)` returning the top 3 features driving positive delay (e.g., [{"feature": "hub_waiting_time_hrs", "impact_hours": 2.4}]).

4. CAUSALITY LAYER (EconML / DoWhy DML Engine)
- Train an EconML `CausalForestDML` (or `LinearDML`) using LightGBM first-stage nuisance models.
  - Treatment T: `locker_rerouted` (0 = standard delivery, 1 = rerouted to parcel locker)
  - Outcome Y: `actual_delay_hrs`
  - Confounders W: `distance_remaining_km`, `weather_severity`, `traffic_index`
- Create a function `estimate_remediation_effect(tracking_id)` returning CATE (estimated hours saved by rerouting).

5. FASTAPI REST ENGINE & STATE STORE
Implement a FastAPI application with Pydantic request/response validation and an in-memory dictionary for state persistence:

- GET `/parcel/{tracking_id}/promise`
  Returns realtime prediction, SLA breach risk, advance notice hours, SHAP root causes, and recommended causal action.
  Response Payload:
  {
    "tracking_id": "ORD-98214",
    "promised_eta": "2026-09-15T18:00:00",
    "predicted_delay_hrs": 4.2,
    "sla_breach_predicted": true,
    "advance_notice_hours": 8.5,
    "current_status": "STANDARD_DELIVERY",
    "root_cause_diagnosis": [
      {"feature": "hub_waiting_time_hrs", "contribution_hrs": 2.4},
      {"feature": "traffic_index", "contribution_hrs": 1.1}
    ],
    "recommended_action": {
      "action_type": "REROUTE_TO_LOCKER",
      "estimated_hours_saved": 3.1,
      "post_action_predicted_delay_hrs": 1.1
    }
  }

- POST `/parcel/{tracking_id}/delivery-action`
  Executes business logic to reroute parcel to a mock locker (updates `locker_rerouted = 1` in state store).
  Request Body: {"action": "REROUTE_TO_LOCKER", "locker_id": "LOCKER-WEST-04"}
  Response Payload:
  {
    "tracking_id": "ORD-98214",
    "status": "SUCCESS",
    "new_fulfillment_state": "REROUTED_TO_LOCKER",
    "updated_predicted_delay_hrs": 1.1,
    "sla_saved": true
  }

- GET `/parcels/at-risk?min_lead_hours=6`
  Returns a list of all active shipments projected to breach SLA with at least `min_lead_hours` notice.


6. ADVANCED TECHNICAL & BUSINESS IMPACT ADDITIONS
- Financial Optimization Layer:
  Include business logic calculating financial metrics in GET /parcel/{tracking_id}/promise:
  - sla_penalty_usd = priority_tier * $50
  - reroute_cost_usd = $4.50
  - net_dollars_saved = (sla_breach_predicted ? sla_penalty_usd : 0) - reroute_cost_usd
- Conformal Prediction & Uncertainty:
  Provide a 90% prediction interval [delay_lower_bound_hrs, delay_upper_bound_hrs] for predicted_delay_hrs.
- DoWhy Causal Refutation:
  Add a validation function `validate_causal_effect()` using DoWhy's `refute_estimate(method_name="placebo_treatment_refuter")` and log the refutation p-value to guarantee treatment effect robustness.
- Governance & Safety:
  If predicted_delay_hrs > 6.0 or priority_tier == 'VIP', set "approval_tier": "HUMAN_APPROVAL_REQUIRED" in the recommendation payload.

7. AGENTIC AI & EXPANDED API SUITE

- AGENTIC ORCHESTRATOR LAYER:
  Implement an autonomous decision agent (using LangGraph/Groq or standard Function Calling) provided with 3 system tools:
  1. `tool_get_sla_risk(tracking_id)`
  2. `tool_estimate_causal_remediation(tracking_id)`
  3. `tool_execute_locker_reroute(tracking_id, locker_id)`
  The agent must evaluate parcels, reason through business constraints (cost, priority tier, confidence interval), invoke rerouting tools autonomously if justified, and output step-by-step reasoning traces.

- ADDITIONAL FASTAPI ENDPOINTS:
  1. GET `/analytics/roi-dashboard`
     Returns aggregate summary metrics:
     {
       "total_parcels_tracked": 5000,
       "sla_breaches_predicted": 750,
       "sla_breaches_prevented": 612,
       "adr_6hr_percentage": 81.6,
       "total_gross_penalties_saved_usd": 30600.00,
       "net_roi_usd": 27846.00
     }

  2. POST `/agent/autonomous-remediate`
     Request: {"min_lead_hours": 6, "auto_execute_budget_limit_usd": 100.00}
     Triggers the Agentic Orchestrator across all at-risk parcels and returns an agentic execution log.

  3. GET `/parcel/{tracking_id}/customer-message`
     Uses an LLM prompt template informed by SHAP root causes and DML locker updates to output a transparent customer SMS/Email notification.

  4. POST `/simulation/stress-test`
     Accepts parameters {"weather_spike": 0.8, "affected_region": "SOUTH"}, updates telemetry in real-time, and runs full batch SLA remediation.

Organize the code into modular files (`data_engine.py`, `models.py`, `causal_engine.py`, `main.py`) or a clean single-file FastAPI script with inline comments explaining DML identification and SHAP logic.