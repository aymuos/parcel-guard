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

2. PREDICTIVE GUARD (Ensemble Quantile Model & Risk Engine)
- Build a multi-model ensemble combining LightGBM and CatBoost:
  a. CatBoost Regressor: Train on raw categorical features [carrier_id, priority_tier, origin_hub, destination_hub] alongside continuous telemetry.
  b. LightGBM Quantile Regressors: Train three models with `objective='quantile'` at alpha levels [0.10, 0.50, 0.90] to predict lower, median, and upper delay bounds.
  c. Meta-Ensemble: Combine median LightGBM (alpha=0.50) and CatBoost predictions using a weighted average stacking layer to produce `predicted_delay_hrs`.
- Output Empirical Risk Intervals:
  Assign `delay_lower_bound_hrs = q10_prediction` and `delay_upper_bound_hrs = q90_prediction`. Flag SLA breach risk if `delay_upper_bound_hrs > 0`.
- Metric Evaluation:
  Compute the N-Hour Advance Detection Rate (ADR_N) at N = 6 hours advance notice window across all snapshot timestamps.

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


6. ADVANCED CAUSAL, SURVIVAL & TECHNICAL DEPTH ADDITIONS

- Causal Discovery & Structural Learning:
  Implement `discover_causal_dag(df)` using `lingam.DirectLiNGAM` or `causal-learn` to empirically infer directed causal edges between telemetry variables [distance, weather, traffic, hub_waiting_time] and outcome [actual_delay]. Validate the inferred DAG against the DoWhy model definition.

- Survival Analysis for Lead-Time Probability:
  Train a `lifelines.CoxPHFitter` or `RandomSurvivalForest` model on time-to-delivery data to estimate dynamic survival probability curves S(t) = P(Delay <= 0 | t_remaining). Compute exact P(Breach) at N = 2, 6, 12, 24 hours.

- Conformal Uncertainty Bounds (MAPIE):
  Compute empirical 90% coverage prediction intervals [delay_lower_bound_hrs, delay_upper_bound_hrs] for predicted_delay_hrs using MAPIE or quantile residuals.

- DoWhy Multi-Method Refutation Suite:
  Add a `validate_causal_robustness()` function executing 3 refutation tests:
  1. Placebo Treatment Refuter
  2. Random Common Cause Refuter
  3. Data Subset Refuter
  Log refutation p-values to prove treatment effect resilience against unobserved confounding.

- Causal Policy Evaluation & AUUC (CausalML):
  Plot and calculate the Area Under the Uplift Curve (AUUC) and Qini score comparing the DML policy against Random Rerouting and Naive Supervised Targeting.

7. DETERMINISTIC OR ENGINE & EXPANDED FASTAPI SUITE

- FLEET-WIDE CAPACITY OPTIMIZATION ENGINE (scipy.optimize / PuLP):
  Implement `optimize_fleet_interventions(at_risk_parcels, locker_capacities)` using Binary Integer Linear Programming (ILP):
  - Objective: Maximize total net dollars saved across all active parcels.
  - Constraint 1: Parcel count per locker <= physical capacity.
  - Constraint 2: Only trigger reroute if CATE estimated delay reduction >= 1.5 hours.

- DETERMINISTIC FINANCIAL LOGIC:
  In GET /parcel/{tracking_id}/promise:
  - penalty_map = {"STANDARD": 25.0, "EXPRESS": 50.0, "VIP": 100.0}
  - sla_penalty_usd = penalty_map.get(priority_tier, 50.0)
  - reroute_cost_usd = 4.50
  - net_dollars_saved = (sla_penalty_usd - reroute_cost_usd) if (sla_breach_predicted and estimated_hours_saved > 0) else 0.0

- TEMPLATE-BASED DISPATCH & CUSTOMER NOTIFICATIONS:
  Replace LLM text generation with structured, deterministic text rendering (Jinja2/f-strings) mapped directly to SHAP delay drivers (e.g., weather vs hub congestion) and locker dispatch confirmation codes.

- EXPANDED FASTAPI ENDPOINTS:
  1. GET `/analytics/roi-dashboard`: Aggregates fleet metrics (SLAs saved, AUUC metric, net dollars protected, 6-hour ADR %).
  2. POST `/fleet/optimize-batch`: Runs Integer Linear Programming fleet optimization over all at-risk shipments and returns slot assignments.
  3. GET `/parcel/{tracking_id}/customer-message`: Renders deterministic customer notification strings based on SHAP root causes.
  4. POST `/simulation/stress-test`: Accepts {"weather_spike": 0.8, "affected_region": "SOUTH"}, mutates in-memory state, and triggers batch LP re-allocation.

Organize the code into modular files (`data_engine.py`, `models.py`, `causal_engine.py`, `main.py`) or a clean single-file FastAPI script with inline comments explaining DML identification and SHAP logic.