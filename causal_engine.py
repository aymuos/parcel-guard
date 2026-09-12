import numpy as np
import pandas as pd
import lightgbm as lgb
from econml.dml import CausalForestDML, LinearDML

CONFOUNDERS = ["distance_remaining_km", "weather_severity", "traffic_index"]
HETERO_FEATURES = ["hub_waiting_time_hrs", "distance_remaining_km", "weather_severity", "traffic_index"]

class CausalRemediationEngine:
    def __init__(self):
        # First-stage nuisance models
        model_y = lgb.LGBMRegressor(n_estimators=100, learning_rate=0.05, max_depth=4, random_state=42, verbose=-1)
        model_t = lgb.LGBMClassifier(n_estimators=100, learning_rate=0.05, max_depth=4, random_state=42, verbose=-1)
        
        # Causal Forest DML for heterogeneous treatment effect estimation
        self.dml_model = CausalForestDML(
            model_y=model_y,
            model_t=model_t,
            n_estimators=100,
            random_state=42,
            discrete_treatment=True
        )
        self.is_fitted = False

    def fit(self, df: pd.DataFrame):
        Y = df["final_actual_delay_hrs"].values
        T = df["locker_rerouted"].values
        W = df[CONFOUNDERS].values
        X = df[HETERO_FEATURES].values
        
        self.dml_model.fit(Y, T, X=X, W=W)
        self.is_fitted = True

    def estimate_remediation_effect(self, row_df: pd.DataFrame) -> float:
        """
        Estimates the CATE tau(X) for a given parcel snapshot.
        tau(X) represents change in delay hours when treatment locker_rerouted=1 is applied.
        A negative tau(X) means delay reduction (e.g. -3.0 hours).
        Returns estimated_hours_saved = max(0.0, -tau(X)).
        """
        if not self.is_fitted:
            raise RuntimeError("Causal Engine must be fitted before estimating remediation effects.")
            
        X = row_df[HETERO_FEATURES].values
        cate_pred = self.dml_model.effect(X)
        tau_val = float(cate_pred[0])
        
        # Hours saved is positive reduction in delay
        hours_saved = max(0.0, -tau_val)
        return round(float(hours_saved), 2)

if __name__ == "__main__":
    from data_engine import generate_micro_telemetry
    df = generate_micro_telemetry(1000)
    
    causal_engine = CausalRemediationEngine()
    causal_engine.fit(df)
    
    sample_high_hub = df[df["hub_waiting_time_hrs"] > 1.5].head(1)
    saved_high = causal_engine.estimate_remediation_effect(sample_high_hub)
    print("CATE Hours Saved (high hub waiting > 1.5):", saved_high)
    
    sample_low_hub = df[df["hub_waiting_time_hrs"] <= 1.5].head(1)
    saved_low = causal_engine.estimate_remediation_effect(sample_low_hub)
    print("CATE Hours Saved (low hub waiting <= 1.5):", saved_low)
