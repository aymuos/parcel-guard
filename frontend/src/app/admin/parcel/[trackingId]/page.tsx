"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { AppShell, PageHeader, StatusPill } from "@/components/AppShell";
import { getPromiseWithFallback, PromiseResponse, api, CustomerMessageResponse } from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  TrendingDown,
  Layers,
  MapPin,
  MessageSquare,
  RefreshCw,
  Zap,
  Info
} from "lucide-react";

export default function AdminParcelPage({
  params,
}: {
  params: Promise<{ trackingId: string }>;
}) {
  const resolvedParams = use(params);
  const trackingId = resolvedParams.trackingId;

  const [parcel, setParcel] = useState<PromiseResponse | null>(null);
  const [mock, setMock] = useState(false);
  const [actionState, setActionState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedLocker, setSelectedLocker] = useState("LOCKER-WEST-01");
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);

  useEffect(() => {
    getPromiseWithFallback(trackingId).then((result) => {
      setParcel(result.data);
      setMock(result.isMock);
    });

    api
      .getCustomerMessage(trackingId)
      .then((res) => setCustomerMessage(res.customer_message))
      .catch(() => setCustomerMessage(null));
  }, [trackingId]);

  if (!parcel) {
    return (
      <AppShell>
        <div className="content">
          <div className="empty-state py-24">
            <RefreshCw size={28} className="animate-spin text-sky-500 mx-auto mb-3" />
            <strong className="text-base text-slate-800 block">Loading Parcel Intelligence Dossier...</strong>
            <span className="text-xs text-slate-400">Fetching TreeSHAP feature contributions & conformal intervals...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  const reroute = async () => {
    setActionState("loading");
    setActionMessage("");
    try {
      const result = await api.executeDeliveryAction(parcel.tracking_id, selectedLocker);
      setActionState("success");
      setActionMessage(
        result.status === "SUCCESS"
          ? `Diversion confirmed to ${selectedLocker}. Updated predicted delay: ${result.updated_predicted_delay_hrs.toFixed(1)}h. SLA protected!`
          : "Action completed."
      );
      // update state
      setParcel((prev) =>
        prev
          ? {
              ...prev,
              current_status: result.new_fulfillment_state,
              predicted_delay_hrs: result.updated_predicted_delay_hrs,
              sla_breach_predicted: !result.sla_saved,
            }
          : null
      );
    } catch (err) {
      setActionState("error");
      setActionMessage(err instanceof Error ? err.message : "Reroute execution failed");
    }
  };

  const isRisk = parcel.sla_breach_predicted || parcel.predicted_delay_hrs > 0.5;

  return (
    <AppShell>
      <div className="content">
        <PageHeader
          eyebrow="Parcel Telemetry & Causal Diagnostics"
          title={`Shipment ${parcel.tracking_id}`}
          description={`Comprehensive operational assessment for ${parcel.priority_tier} tier delivery commitment.`}
        >
          <Link className="button secondary" href="/admin/at-risk">
            <ArrowLeft size={14} />
            <span>Return to Risk Queue</span>
          </Link>
        </PageHeader>

        {mock && (
          <div className="notice mb-6">
            <Info size={16} className="text-amber-600 flex-none" />
            <span>
              Showing calibrated fallback dossier for <strong>{parcel.tracking_id}</strong>. Connect live backend instance to stream real-time sensor updates.
            </span>
          </div>
        )}

        <div className="parcel-grid">
          {/* Main Left Column */}
          <div className="space-y-6">
            {/* Hero Status Banner */}
            <section
              className={`hero-status ${
                isRisk ? "at-risk" : "on-track"
              }`}
            >
              <div className="hero-top">
                <span className={`status-orb ${isRisk ? "" : "green"}`}>
                  {isRisk ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                </span>
                <div>
                  <p className="eyebrow">
                    Fulfillment Commitment Status · {parcel.priority_tier}
                  </p>
                  <h1>
                    {isRisk
                      ? "Delivery Commitment at Risk of Breach"
                      : "Delivery Promise Protected and On-Schedule"}
                  </h1>
                  <p>
                    {isRisk
                      ? `Projected delay exceeds contractual threshold. ${parcel.advance_notice_hours.toFixed(1)} hours of advance notification window remains.`
                      : `All transit telemetry is currently within nominal tolerances.`}
                  </p>
                </div>
              </div>

              <div className="eta-block">
                <div>
                  <span className="eta-label">Contracted Promised ETA</span>
                  <strong className="eta-date">
                    {new Date(parcel.promised_eta).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    ·{" "}
                    {new Date(parcel.promised_eta).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                      Model Predicted Delay
                    </span>
                    <strong className="text-xl font-bold font-mono text-rose-600">
                      +{parcel.predicted_delay_hrs.toFixed(1)} Hours
                    </strong>
                  </div>
                  <StatusPill status={isRisk ? "critical" : "healthy"} />
                </div>
              </div>
            </section>

            {/* TreeSHAP Root Cause Breakdown */}
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow text-slate-500">TreeSHAP Explainability</p>
                  <h2>Delay Factor Decomposition</h2>
                </div>
                <span className="text-xs font-mono text-slate-400">Sum: +{parcel.predicted_delay_hrs.toFixed(1)}h</span>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                The gradient boosted trees ensemble isolated these micro-telemetry factors as the primary drivers of projected transit latency:
              </p>

              <div className="space-y-4">
                {parcel.root_cause_diagnosis.map((cause) => {
                  const contrib = Math.max(0, cause.contribution_hrs);
                  const maxDelay = Math.max(1, parcel.predicted_delay_hrs);
                  const pct = Math.min(100, Math.round((contrib / maxDelay) * 100));

                  return (
                    <div key={cause.feature} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div className="flex justify-between items-center mb-1.5">
                        <strong className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          {cause.feature.replaceAll("_", " ")}
                        </strong>
                        <span className="text-xs font-mono font-bold text-rose-600">
                          +{contrib.toFixed(2)} Hours Latency
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Causal Remediation Action Panel */}
            <section className="panel action-panel">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="eyebrow text-emerald-800">Causal Remediation Engine</p>
                  <h2>Recommended Counterfactual Intervention</h2>
                </div>
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Sparkles size={16} />
                </span>
              </div>

              <p>
                Rerouting this package to a regional automated locker eliminates last-mile courier dwell time, saving an estimated <strong>{parcel.recommended_action.estimated_hours_saved.toFixed(1)} hours</strong> and bringing post-intervention delay to <strong>{parcel.recommended_action.post_action_predicted_delay_hrs.toFixed(1)} hours</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs">
                  <span className="text-slate-500 block mb-0.5">Select Locker Terminal:</span>
                  <select
                    className="select-control w-full h-9 text-xs"
                    value={selectedLocker}
                    onChange={(e) => setSelectedLocker(e.target.value)}
                  >
                    <option value="LOCKER-WEST-01">LOCKER-WEST-01 · West Metro (14 Free Bays)</option>
                    <option value="LOCKER-WEST-04">LOCKER-WEST-04 · West Corridor (8 Free Bays)</option>
                    <option value="LOCKER-NORTH-01">LOCKER-NORTH-01 · North Metro (22 Free Bays)</option>
                  </select>
                </div>

                <div className="p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs flex flex-col justify-center">
                  <span className="text-slate-500 block mb-0.5">Projected Recovery Value:</span>
                  <strong className="text-emerald-700 text-base font-bold font-mono">
                    ${parcel.financial_metrics.net_dollars_saved.toFixed(0)} USD Net Saved
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="button accent px-5"
                  onClick={reroute}
                  disabled={actionState === "loading" || parcel.current_status === "REROUTED_TO_LOCKER"}
                >
                  {actionState === "loading" ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Transmitting Diversion Command...</span>
                    </>
                  ) : parcel.current_status === "REROUTED_TO_LOCKER" ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Locker Reroute Active</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      <span>Execute Smart Locker Diversion</span>
                    </>
                  )}
                </button>
              </div>

              {actionMessage && (
                <div
                  className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                    actionState === "success"
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      : "bg-rose-100 text-rose-900 border border-rose-300"
                  }`}
                >
                  <CheckCircle2 size={15} />
                  <span>{actionMessage}</span>
                </div>
              )}
            </section>

            {/* Customer Message Live Preview */}
            {customerMessage && (
              <section className="panel bg-gradient-to-br from-white to-sky-50/30 border-sky-200">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={16} className="text-sky-600" />
                  <h3 className="font-display font-bold text-slate-900 text-sm">
                    Automated Customer Notification Stream
                  </h3>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-sky-100 text-xs font-mono text-slate-800 leading-relaxed shadow-sm">
                  {customerMessage}
                </div>
                <small className="text-[11px] text-slate-400 mt-2 block">
                  Dispatched via SMS & Push notification channels upon causal intervention.
                </small>
              </section>
            )}
          </div>

          {/* Right Aside Column */}
          <aside className="space-y-6">
            {/* Promise Contract Card */}
            <section className="panel side-card">
              <h3>SLA Contract Specifications</h3>
              <div className="detail-list">
                <div>
                  <span>Tracking Identifier</span>
                  <strong className="font-mono text-cyan-700">{parcel.tracking_id}</strong>
                </div>
                <div>
                  <span>Priority Tier</span>
                  <strong>{parcel.priority_tier} Commitment</strong>
                </div>
                <div>
                  <span>Current State</span>
                  <strong className="font-mono">{parcel.current_status}</strong>
                </div>
                <div>
                  <span>Contractual Penalty</span>
                  <strong className="text-rose-600 font-mono">
                    ${parcel.financial_metrics.sla_penalty_usd.toFixed(0)}
                  </strong>
                </div>
                <div>
                  <span>Reroute Cost</span>
                  <strong className="font-mono text-slate-600">
                    ${parcel.financial_metrics.reroute_cost_usd.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>Net Savings</span>
                  <strong className="text-emerald-600 font-mono">
                    +${parcel.financial_metrics.net_dollars_saved.toFixed(2)}
                  </strong>
                </div>
              </div>
            </section>

            {/* Conformal Bounds & Survival Analytics */}
            <section className="panel side-card">
              <h3>Conformal Calibration & Survival</h3>
              <div className="space-y-3 pt-1">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold mb-1">
                    90% Conformal Interval
                  </span>
                  <strong className="text-base font-mono text-slate-800">
                    [{parcel.conformal_interval.lower_bound_hrs.toFixed(1)}h –{" "}
                    {parcel.conformal_interval.upper_bound_hrs.toFixed(1)}h]
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Calibrated marginal coverage guarantee
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold mb-2">
                    Breach Probability Curve
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">P(breach &gt; 2h):</span>
                      <strong className="font-mono">
                        {(parcel.survival_probabilities.breach_p_2h * 100).toFixed(0)}%
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">P(breach &gt; 6h):</span>
                      <strong className="font-mono">
                        {(parcel.survival_probabilities.breach_p_6h * 100).toFixed(0)}%
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">P(breach &gt; 12h):</span>
                      <strong className="font-mono">
                        {(parcel.survival_probabilities.breach_p_12h * 100).toFixed(0)}%
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Track Link */}
            <section className="panel side-card bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700">
              <h3 className="text-white">Customer View</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                View this shipment through the customer-facing tracking portal to verify the public-facing delivery promise and locker pickup instructions.
              </p>
              <Link
                href={`/track/${parcel.tracking_id}`}
                className="button primary text-xs w-full"
              >
                <span>Open in Customer Portal</span>
                <ArrowLeft size={13} className="rotate-180" />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
