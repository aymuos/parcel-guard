import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

ORIGIN_HUBS = ["HUB_SP_01", "HUB_RJ_02", "HUB_MG_01", "HUB_PR_01"]
DESTINATION_HUBS = ["HUB_SOUTH_01", "HUB_WEST_04", "HUB_NORTH_02", "HUB_EAST_01"]

FEATURE_COLS = [
    "distance_remaining_km",
    "hub_waiting_time_hrs",
    "weather_severity",
    "traffic_index",
    "locker_rerouted"
]

CATEGORICAL_COLS = ["carrier_id", "priority_tier", "origin_hub", "destination_hub"]

def load_real_orders(dataco_path="data/DataCoSupplyChainDataset.csv", olist_path="data/Brazilian E-Commerce Public Dataset by Olist.csv", sample_size=5000):
    """
    Load real order timestamps, locations, and metadata from DataCo or Olist datasets.
    """
    tracking_ids = []
    base_dates = []
    
    if os.path.exists(dataco_path):
        try:
            df_dataco = pd.read_csv(dataco_path, encoding='latin1', low_memory=False)
            if 'Order Id' in df_dataco.columns or 'shipping date (DateOrders)' in df_dataco.columns:
                sub = df_dataco.dropna(subset=['shipping date (DateOrders)']).head(sample_size) if 'shipping date (DateOrders)' in df_dataco.columns else df_dataco.head(sample_size)
                for idx, row in sub.iterrows():
                    tid = f"DC-{row.get('Order Id', idx)}"
                    dt_str = row.get('shipping date (DateOrders)', '1/1/2026 0:00')
                    try:
                        dt = pd.to_datetime(dt_str)
                    except Exception:
                        dt = datetime.now()
                    tracking_ids.append(str(tid))
                    base_dates.append(dt)
        except Exception as e:
            print(f"Error reading DataCo dataset: {e}")

    if len(tracking_ids) < sample_size and os.path.exists(olist_path):
        try:
            df_olist = pd.read_csv(olist_path, encoding='utf-8', low_memory=False)
            if 'order_id' in df_olist.columns:
                sub = df_olist.dropna(subset=['order_purchase_timestamp']).head(sample_size - len(tracking_ids))
                for idx, row in sub.iterrows():
                    tid = f"OL-{row['order_id']}"
                    dt_str = row.get('order_purchase_timestamp', '')
                    try:
                        dt = pd.to_datetime(dt_str)
                    except Exception:
                        dt = datetime.now()
                    tracking_ids.append(str(tid))
                    base_dates.append(dt)
        except Exception as e:
            print(f"Error reading Olist dataset: {e}")

    # Fallback if datasets empty/unreadable
    if not tracking_ids:
        for i in range(sample_size):
            tracking_ids.append(f"ORD-{90000 + i}")
            base_dates.append(datetime.now() - timedelta(hours=np.random.randint(1, 100)))

    return pd.DataFrame({"tracking_id": tracking_ids, "base_date": base_dates})


def generate_micro_telemetry(n_samples=5000, random_state=42):
    """
    Generates synthetic micro-telemetry stream snapshots based on real order metadata,
    injecting specific confounding, propensity, CATE, and target delay mechanisms.
    """
    np.random.seed(random_state)
    orders_df = load_real_orders(sample_size=n_samples)
    
    n = len(orders_df)
    now = datetime(2026, 9, 15, 12, 0, 0)
    
    # 1. Base features & Confounders W
    distance_remaining_km = np.random.uniform(5.0, 450.0, n)
    hub_waiting_time_hrs = np.random.exponential(scale=1.5, size=n)
    weather_severity = np.random.uniform(0.0, 1.0, n)
    traffic_index = np.random.uniform(0.0, 1.0, n)
    
    carrier_ids = np.random.choice(["CARRIER_A", "CARRIER_B", "EXPRESS_EX"], size=n)
    priority_tiers = np.random.choice(["STANDARD", "EXPRESS", "VIP"], size=n)
    origin_hubs = np.random.choice(ORIGIN_HUBS, size=n)
    destination_hubs = np.random.choice(DESTINATION_HUBS, size=n)
    
    # Lead time until promised ETA (hrs)
    lead_time_hrs = np.random.uniform(2.0, 36.0, n)
    
    current_timestamps = []
    promised_etas = []
    for i in range(n):
        curr_ts = now + timedelta(hours=float(np.random.uniform(-12, 12)))
        eta = curr_ts + timedelta(hours=float(lead_time_hrs[i]))
        current_timestamps.append(curr_ts.isoformat())
        promised_etas.append(eta.isoformat())
        
    # 2. Propensity Model & Treatment (locker_rerouted)
    # Logit: P(locker_rerouted = 1 | W) = Sigmoid(0.005 * distance + 2.0 * weather - 1.5)
    logit = 0.005 * distance_remaining_km + 2.0 * weather_severity - 1.5
    propensity = 1.0 / (1.0 + np.exp(-logit))
    locker_rerouted = np.random.binomial(1, propensity)
    
    # 3. CATE Mechanism tau(X)
    # Rerouting to a locker saves -3.0 hours if hub_waiting_time_hrs > 1.5; saves -0.5 hours otherwise
    tau = np.where(hub_waiting_time_hrs > 1.5, -3.0, -0.5)
    
    # 4. Target Delay Y (final_actual_delay_hrs)
    noise = np.random.normal(0.0, 0.5, n)
    final_actual_delay_hrs = (
        0.6 * hub_waiting_time_hrs 
        + 3.0 * weather_severity 
        + 2.5 * traffic_index 
        + tau * locker_rerouted 
        + noise
    )
    
    df = pd.DataFrame({
        "tracking_id": orders_df["tracking_id"].values,
        "current_timestamp": current_timestamps,
        "promised_eta": promised_etas,
        "distance_remaining_km": distance_remaining_km,
        "hub_waiting_time_hrs": hub_waiting_time_hrs,
        "weather_severity": weather_severity,
        "traffic_index": traffic_index,
        "carrier_id": carrier_ids,
        "priority_tier": priority_tiers,
        "origin_hub": origin_hubs,
        "destination_hub": destination_hubs,
        "locker_rerouted": locker_rerouted,
        "final_actual_delay_hrs": final_actual_delay_hrs,
        "lead_time_hrs": lead_time_hrs,
        "true_tau": tau
    })
    
    return df

if __name__ == "__main__":
    df = generate_micro_telemetry(100)
    print("Telemetry dataframe sample shape:", df.shape)
    print("Columns:", df.columns.tolist())
