import numpy as np
import pandas as pd
from typing import List, Dict, Any
import pulp

PENALTY_MAP = {
    "STANDARD": 25.0,
    "EXPRESS": 50.0,
    "VIP": 100.0
}
REROUTE_COST_USD = 4.50

def calculate_financial_metrics(priority_tier: str, predicted_delay_hrs: float, estimated_hours_saved: float) -> dict:
    sla_penalty = float(PENALTY_MAP.get(str(priority_tier).upper(), 50.0))
    reroute_cost = REROUTE_COST_USD
    
    is_breach = predicted_delay_hrs > 0
    saves_time = estimated_hours_saved > 0
    
    if is_breach and saves_time:
        net_saved = max(0.0, sla_penalty - reroute_cost)
    else:
        net_saved = 0.0
        
    return {
        "sla_penalty_usd": round(sla_penalty, 2),
        "reroute_cost_usd": round(reroute_cost, 2),
        "net_dollars_saved": round(net_saved, 2)
    }

def optimize_fleet_interventions(at_risk_parcels: List[Dict[str, Any]], locker_capacities: Dict[str, int] = None) -> dict:
    """
    Solves Binary Integer Linear Programming (ILP) using PuLP / SciPy:
    - Objective: Maximize total net dollars saved across all active parcels.
    - Constraint 1: Parcel count per locker <= physical capacity.
    - Constraint 2: Only trigger reroute if CATE estimated delay reduction >= 1.5 hours.
    """
    if locker_capacities is None:
        locker_capacities = {
            "LOCKER-WEST-01": 15,
            "LOCKER-WEST-02": 20,
            "LOCKER-NORTH-01": 12,
            "LOCKER-EAST-04": 18
        }
        
    if not at_risk_parcels:
        return {
            "total_allocated": 0,
            "total_net_dollars_saved": 0.0,
            "locker_assignments": {},
            "unassigned_parcels": []
        }

    prob = pulp.LpProblem("Fleet_Locker_Optimization", pulp.LpMaximize)
    
    lockers = list(locker_capacities.keys())
    parcel_ids = [p["tracking_id"] for p in at_risk_parcels]
    
    # Decision variables x[i, j] in {0, 1}
    x = pulp.LpVariable.dicts("assign", ((i, j) for i in parcel_ids for j in lockers), cat="Binary")
    
    # Objective Function
    obj_terms = []
    for p in at_risk_parcels:
        pid = p["tracking_id"]
        cate_saved = float(p.get("estimated_hours_saved", 0.0))
        tier = p.get("priority_tier", "STANDARD")
        fin = calculate_financial_metrics(tier, p.get("predicted_delay_hrs", 1.0), cate_saved)
        net_benefit = fin["net_dollars_saved"]
        
        # Constraint 2 check: Only eligible if CATE delay reduction >= 1.5 hrs
        for j in lockers:
            if cate_saved >= 1.5:
                obj_terms.append(net_benefit * x[(pid, j)])
            else:
                # Force 0 assignment if CATE < 1.5 hrs
                prob += x[(pid, j)] == 0
                
    prob += pulp.lpSum(obj_terms)
    
    # Constraint 1: Locker capacities
    for j in lockers:
        prob += pulp.lpSum(x[(pid, j)] for pid in parcel_ids) <= locker_capacities[j]
        
    # Constraint 3: At most 1 locker per parcel
    for pid in parcel_ids:
        prob += pulp.lpSum(x[(pid, j)] for j in lockers) <= 1

    # Solve ILP
    prob.solve(pulp.PULP_CBC_CMD(msg=False))
    
    assignments = {}
    unassigned = []
    total_dollars = 0.0
    total_alloc = 0
    
    for p in at_risk_parcels:
        pid = p["tracking_id"]
        assigned_locker = None
        for j in lockers:
            if pulp.value(x[(pid, j)]) == 1:
                assigned_locker = j
                break
                
        if assigned_locker:
            tier = p.get("priority_tier", "STANDARD")
            cate_saved = float(p.get("estimated_hours_saved", 0.0))
            fin = calculate_financial_metrics(tier, p.get("predicted_delay_hrs", 1.0), cate_saved)
            total_dollars += fin["net_dollars_saved"]
            total_alloc += 1
            assignments[pid] = {
                "assigned_locker": assigned_locker,
                "estimated_hours_saved": cate_saved,
                "net_dollars_saved": fin["net_dollars_saved"],
                "confirmation_code": f"CONF-{pid[-5:]}-{assigned_locker[-2:]}"
            }
        else:
            unassigned.append(pid)
            
    return {
        "total_at_risk_processed": len(at_risk_parcels),
        "total_allocated": total_alloc,
        "total_unassigned": len(unassigned),
        "total_net_dollars_saved": round(total_dollars, 2),
        "locker_capacities": locker_capacities,
        "assignments": assignments,
        "unassigned_parcels": unassigned
    }

def render_customer_notification(tracking_id: str, root_causes: list, locker_id: str, promised_eta: str, hours_saved: float = 2.5) -> str:
    """
    Renders structured deterministic customer notification text mapped directly to SHAP drivers and locker dispatch code.
    """
    driver_strings = []
    for item in root_causes[:2]:
        feat = item.get("feature", "hub_waiting_time_hrs")
        contrib = item.get("contribution_hrs", 0.5)
        feat_name = feat.replace("_", " ").title()
        driver_strings.append(f"{feat_name} (+{contrib} hrs)")
        
    drivers_formatted = " and ".join(driver_strings) if driver_strings else "Logistics Congestion"
    confirmation_code = f"DISPATCH-{tracking_id[-5:]}-{locker_id[-2:] if locker_id else '01'}"
    
    msg = (
        f"Parcel Guard Dispatch Alert for tracking ID {tracking_id}: Delivery was impacted by {drivers_formatted}. "
        f"Proactively rerouted to parcel locker '{locker_id}' (Confirmation Code: {confirmation_code}) "
        f"to save {hours_saved} hours and protect promised delivery window by {promised_eta}."
    )
    return msg

if __name__ == "__main__":
    sample_parcels = [
        {"tracking_id": "ORD-101", "priority_tier": "VIP", "predicted_delay_hrs": 3.5, "estimated_hours_saved": 2.8},
        {"tracking_id": "ORD-102", "priority_tier": "EXPRESS", "predicted_delay_hrs": 2.0, "estimated_hours_saved": 1.8},
        {"tracking_id": "ORD-103", "priority_tier": "STANDARD", "predicted_delay_hrs": 1.0, "estimated_hours_saved": 0.8} # < 1.5 hrs
    ]
    
    res = optimize_fleet_interventions(sample_parcels)
    print("ILP Optimization Total Net Dollars Saved:", res["total_net_dollars_saved"])
    print("Assignments:", res["assignments"])
    
    msg = render_customer_notification("ORD-101", [{"feature": "weather_severity", "contribution_hrs": 1.8}], "LOCKER-WEST-01", "2026-09-15T18:00:00", 2.8)
    print("\nCustomer Message Sample:\n", msg)
