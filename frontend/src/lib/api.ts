// API client for the backend service, with TypeScript types for responses and a mock fallback for development.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";


export type RootCause = { feature: string; contribution_hrs: number };
export type PromiseResponse = {
  tracking_id: string;
  promised_eta: string;
  predicted_delay_hrs: number;
  delay_lower_bound_hrs: number;
  delay_upper_bound_hrs: number;
  sla_breach_predicted: boolean;
  advance_notice_hours: number;
  current_status: string;
  priority_tier: string;
  root_cause_diagnosis: RootCause[];
  recommended_action: { action_type: string; estimated_hours_saved: number; post_action_predicted_delay_hrs: number };
  conformal_interval: { lower_bound_hrs: number; upper_bound_hrs: number; confidence_level: number };
  survival_probabilities: { breach_p_2h: number; breach_p_6h: number; breach_p_12h: number; breach_p_24h: number };
  financial_metrics: { sla_penalty_usd: number; reroute_cost_usd: number; net_dollars_saved: number };
};
export type RoiDashboard = {
  fleet_size: number;
  at_risk_count: number;
  slas_protected_count: number;
  total_net_dollars_protected: number;
  advance_detection_rate_6h_pct: number;
  auuc_uplift_score: number;
  qini_score: number;
  policy_lift_vs_random_pct: number;
};
export type DeliveryActionResponse = {
  tracking_id: string;
  status: string;
  new_fulfillment_state: string;
  updated_predicted_delay_hrs: number;
  sla_saved: boolean;
};
export type StressTestResponse = {
  simulation_status: string;
  weather_spike_applied: number;
  affected_region: string;
  affected_parcels_count: number;
  reallocation_summary: { total_allocated?: number; total_net_dollars_saved?: number; [key: string]: unknown };
};
export type FleetOptimizationResponse = { total_allocated?: number; total_net_dollars_saved?: number; [key: string]: unknown };
export type CustomerMessageResponse = { tracking_id: string; customer_message: string; notification_channel: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getPromise: (trackingId: string) => request<PromiseResponse>(`/parcel/${encodeURIComponent(trackingId)}/promise`),
  getAtRisk: () => request<PromiseResponse[]>("/parcels/at-risk?min_lead_hours=6"),
  getRoiDashboard: () => request<RoiDashboard>("/analytics/roi-dashboard"),
  runStressTest: (weatherSpike: number, affectedRegion: string) => request<StressTestResponse>("/simulation/stress-test", { method: "POST", body: JSON.stringify({ weather_spike: weatherSpike, affected_region: affectedRegion }) }),
  executeDeliveryAction: (trackingId: string, lockerId: string) => request<DeliveryActionResponse>(`/parcel/${encodeURIComponent(trackingId)}/delivery-action`, { method: "POST", body: JSON.stringify({ action: "REROUTE_TO_LOCKER", locker_id: lockerId }) }),
  optimizeFleet: () => request<FleetOptimizationResponse>("/fleet/optimize-batch", { method: "POST", body: JSON.stringify({ locker_capacities: null }) }),
  getCustomerMessage: (trackingId: string) => request<CustomerMessageResponse>(`/parcel/${encodeURIComponent(trackingId)}/customer-message`),
};

export const SAMPLE_TRACKING_ID = "DC-77202";

export const mockPromise: PromiseResponse = {
  tracking_id: SAMPLE_TRACKING_ID,
  promised_eta: "2026-09-17T17:00:00",
  predicted_delay_hrs: 4.2,
  delay_lower_bound_hrs: 3.1,
  delay_upper_bound_hrs: 5.4,
  sla_breach_predicted: true,
  advance_notice_hours: 35.9,
  current_status: "STANDARD_DELIVERY",
  priority_tier: "EXPRESS",
  root_cause_diagnosis: [{ feature: "hub_waiting_time_hrs", contribution_hrs: 1.63 }, { feature: "traffic_index", contribution_hrs: 0.58 }, { feature: "weather_severity", contribution_hrs: 0.55 }],
  recommended_action: { action_type: "REROUTE_TO_LOCKER", estimated_hours_saved: 2.8, post_action_predicted_delay_hrs: 1.4 },
  conformal_interval: { lower_bound_hrs: 3.4, upper_bound_hrs: 5, confidence_level: 0.9 },
  survival_probabilities: { breach_p_2h: 0.95, breach_p_6h: 0.82, breach_p_12h: 0.54, breach_p_24h: 0.21 },
  financial_metrics: { sla_penalty_usd: 100, reroute_cost_usd: 4.5, net_dollars_saved: 95.5 },
};

export async function getPromiseWithFallback(trackingId: string) {
  try { return { data: await api.getPromise(trackingId), isMock: false }; }
  catch { return { data: { ...mockPromise, tracking_id: trackingId }, isMock: true }; }
}
