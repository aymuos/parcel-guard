import numpy as np
import pandas as pd
import lightgbm as lgb
from catboost import CatBoostRegressor
import shap

FEATURE_COLS = [
    "distance_remaining_km",
    "hub_waiting_time_hrs",
    "weather_severity",
    "traffic_index",
    "locker_rerouted"
]

CATEGORICAL_COLS = ["carrier_id", "priority_tier", "origin_hub", "destination_hub"]
ALL_INPUT_COLS = FEATURE_COLS + CATEGORICAL_COLS

class PredictiveGuard:
    """
    Ensemble Quantile Model & Risk Engine combining:
    - CatBoost Regressor trained on raw categorical & continuous features
    - LightGBM Quantile Regressors (alpha = [0.10, 0.50, 0.90])
    - Meta-Ensemble stacking layer combining median LightGBM (alpha=0.50) and CatBoost predictions.
    """
    def __init__(self):
        # 1. CatBoost Regressor
        self.catboost_model = CatBoostRegressor(
            iterations=150,
            learning_rate=0.05,
            depth=5,
            cat_features=CATEGORICAL_COLS,
            random_seed=42,
            verbose=0
        )
        
        # 2. LightGBM Quantile Regressors at alpha = [0.10, 0.50, 0.90]
        self.lgb_q10 = lgb.LGBMRegressor(
            objective="quantile", alpha=0.10, n_estimators=120, learning_rate=0.05, max_depth=5, random_state=42, verbose=-1
        )
        self.lgb_q50 = lgb.LGBMRegressor(
            objective="quantile", alpha=0.50, n_estimators=120, learning_rate=0.05, max_depth=5, random_state=42, verbose=-1
        )
        self.lgb_q90 = lgb.LGBMRegressor(
            objective="quantile", alpha=0.90, n_estimators=120, learning_rate=0.05, max_depth=5, random_state=42, verbose=-1
        )
        
        self.explainer = None
        self.feature_names = FEATURE_COLS
        self.weight_lgb = 0.5
        self.weight_cat = 0.5

    def _prepare_df(self, df: pd.DataFrame) -> pd.DataFrame:
        X = df.copy()
        for col in CATEGORICAL_COLS:
            if col not in X.columns:
                X[col] = "UNKNOWN"
            X[col] = X[col].astype(str)
        return X

    def fit(self, df: pd.DataFrame):
        X = self._prepare_df(df)
        y = df["final_actual_delay_hrs"].values
        
        # Train CatBoost Regressor
        X_cat = X[ALL_INPUT_COLS]
        self.catboost_model.fit(X_cat, y)
        
        # Train LightGBM Quantile Regressors
        X_num = X[FEATURE_COLS]
        self.lgb_q10.fit(X_num, y)
        self.lgb_q50.fit(X_num, y)
        self.lgb_q90.fit(X_num, y)
        
        # Initialize TreeSHAP explainer on median LightGBM model
        try:
            self.explainer = shap.TreeExplainer(self.lgb_q50)
        except Exception:
            self.explainer = shap.Explainer(self.lgb_q50, X_num)

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """
        Meta-Ensemble prediction: Weighted average stacking layer of median LightGBM (alpha=0.50) and CatBoost.
        """
        X = self._prepare_df(df)
        pred_cat = self.catboost_model.predict(X[ALL_INPUT_COLS])
        pred_lgb_q50 = self.lgb_q50.predict(X[FEATURE_COLS])
        
        meta_pred = self.weight_lgb * pred_lgb_q50 + self.weight_cat * pred_cat
        return meta_pred

    def predict_quantile_bounds(self, df: pd.DataFrame) -> dict:
        """
        Computes q10, q50, q90 predictions and risk bounds:
        delay_lower_bound_hrs = q10_prediction
        delay_upper_bound_hrs = q90_prediction
        """
        X = self._prepare_df(df)
        X_num = X[FEATURE_COLS]
        
        q10 = self.lgb_q10.predict(X_num)
        q50 = self.lgb_q50.predict(X_num)
        q90 = self.lgb_q90.predict(X_num)
        
        meta_pred = self.predict(df)
        
        # SLA breach risk flagged if delay_upper_bound_hrs (q90) > 0
        breach_flag = bool(q90[0] > 0)
        
        return {
            "predicted_delay_hrs": round(float(meta_pred[0]), 1),
            "delay_lower_bound_hrs": round(float(q10[0]), 1),
            "delay_median_hrs": round(float(q50[0]), 1),
            "delay_upper_bound_hrs": round(float(q90[0]), 1),
            "sla_breach_risk_flag": breach_flag
        }

    def compute_advance_detection_rate(self, df: pd.DataFrame, n_hours: float = 6.0) -> float:
        """
        ADR_N = (Breaches detected >= N hours before promised_eta) / (Total actual breaches)
        Breach risk flagged if delay_upper_bound_hrs (q90) > 0 or meta prediction > 0.
        """
        X_prep = self._prepare_df(df)
        q90 = self.lgb_q90.predict(X_prep[FEATURE_COLS])
        y_pred = self.predict(df)
        actual_breaches = df["final_actual_delay_hrs"] > 0
        
        total_actual_breaches = actual_breaches.sum()
        if total_actual_breaches == 0:
            return 1.0
            
        detected_in_advance = (
            actual_breaches & 
            ((y_pred > 0) | (q90 > 0)) & 
            (df["lead_time_hrs"] >= n_hours)
        ).sum()
        
        adr = float(detected_in_advance / total_actual_breaches)
        return adr

    def get_root_causes(self, row_df: pd.DataFrame, top_k: int = 3):
        """
        TreeSHAP feature attributions on median LightGBM model.
        Returns top_k positive delay drivers.
        """
        X_num = row_df[self.feature_names]
        shap_vals = self.explainer.shap_values(X_num)
        
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[0]
            
        if len(shap_vals.shape) > 1:
            vals = shap_vals[0]
        else:
            vals = shap_vals
            
        contributions = []
        for feat, val in zip(self.feature_names, vals):
            if val > 0:
                contributions.append({
                    "feature": feat,
                    "contribution_hrs": round(float(val), 2)
                })
                
        contributions = sorted(contributions, key=lambda x: x["contribution_hrs"], reverse=True)
        
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
    
    bounds = guard.predict_quantile_bounds(df.head(1))
    print("Sample Risk Bounds:", bounds)
