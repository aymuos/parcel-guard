import numpy as np
import pandas as pd
import lightgbm as lgb
import shap

FEATURE_COLS = [
    "distance_remaining_km",
    "hub_waiting_time_hrs",
    "weather_severity",
    "traffic_index",
    "locker_rerouted"
]

class PredictiveGuard:
    def __init__(self):
        self.model = lgb.LGBMRegressor(
            n_estimators=150,
            learning_rate=0.05,
            max_depth=5,
            random_state=42,
            verbose=-1
        )
        self.explainer = None
        self.feature_names = FEATURE_COLS

    def fit(self, df: pd.DataFrame):
        X = df[self.feature_names]
        y = df["final_actual_delay_hrs"]
        
        self.model.fit(X, y)
        
        # Initialize TreeSHAP explainer
        try:
            self.explainer = shap.TreeExplainer(self.model)
        except Exception:
            self.explainer = shap.Explainer(self.model, X)

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        X = df[self.feature_names]
        return self.model.predict(X)

    def compute_advance_detection_rate(self, df: pd.DataFrame, n_hours: float = 6.0) -> float:
        """
        ADR_N = (Breaches detected >= N hours before promised_eta) / (Total actual breaches)
        A breach is defined as final_actual_delay_hrs > 0.
        A breach is detected if predicted_delay_hrs > 0 when lead_time_hrs >= n_hours.
        """
        y_pred = self.predict(df)
        actual_breaches = df["final_actual_delay_hrs"] > 0
        
        total_actual_breaches = actual_breaches.sum()
        if total_actual_breaches == 0:
            return 1.0
            
        detected_in_advance = (
            actual_breaches & 
            (y_pred > 0) & 
            (df["lead_time_hrs"] >= n_hours)
        ).sum()
        
        adr = float(detected_in_advance / total_actual_breaches)
        return adr

    def get_root_causes(self, row_df: pd.DataFrame, top_k: int = 3):
        """
        Computes TreeSHAP feature contributions for a given sample,
        returning top_k features contributing positively to delay.
        Format: [{'feature': name, 'contribution_hrs': float}]
        """
        X = row_df[self.feature_names]
        shap_vals = self.explainer.shap_values(X)
        
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[0]
            
        if len(shap_vals.shape) > 1:
            vals = shap_vals[0]
        else:
            vals = shap_vals
            
        # Pair feature names with SHAP contribution
        contributions = []
        for feat, val in zip(self.feature_names, vals):
            # Focus on features driving positive delay
            if val > 0:
                contributions.append({
                    "feature": feat,
                    "contribution_hrs": round(float(val), 2)
                })
                
        # Sort descending by contribution
        contributions = sorted(contributions, key=lambda x: x["contribution_hrs"], reverse=True)
        
        # If no positive drivers found, return top impact features overall
        if not contributions:
            all_contribs = [
                {"feature": feat, "contribution_hrs": round(float(abs(val)), 2)}
                for feat, val in zip(self.feature_names, vals)
            ]
            contributions = sorted(all_contribs, key=lambda x: x["contribution_hrs"], reverse=True)

        return contributions[:top_k]

if __name__ == "__main__":
    from data_engine import generate_micro_telemetry
    df = generate_micro_telemetry(1000)
    
    guard = PredictiveGuard()
    guard.fit(df)
    
    adr6 = guard.compute_advance_detection_rate(df, n_hours=6.0)
    print(f"6-Hour Advance Detection Rate (ADR_6): {adr6:.4f}")
    
    sample_row = df.head(1)
    root_causes = guard.get_root_causes(sample_row)
    print("Sample Root Causes:", root_causes)
