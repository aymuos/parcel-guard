"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { AppShell } from "@/components/AppShell";
import {
  api,
  getPromiseWithFallback,
  PromiseResponse,
  CustomerMessageResponse,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Truck,
  Sparkles,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink
} from "lucide-react";

const dateText = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(value));
  } catch {
    return "Scheduled Delivery";
  }
};

const timeText = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "17:00";
  }
};

const friendlyCause = (feature: string) => {
  const map: Record<string, { title: string; desc: string }> = {
    hub_waiting_time_hrs: {
      title: "Sorting Facility Dwell",
      desc: "Package processing in the intermediate transit depot took longer than baseline.",
    },
    traffic_index: {
      title: "Corridor Highway Congestion",
      desc: "Heavy metropolitan freight traffic along the primary highway route.",
    },
    weather_severity: {
      title: "Adverse Weather System",
      desc: "Severe local precipitation slowed regional line-haul transportation.",
    },
    distance_remaining_km: {
      title: "Extended Last-Mile Route",
      desc: "Suburban transit corridor distance required supplemental vehicle scheduling.",
    },
  };
  return (
    map[feature] || {
      title: feature.replaceAll("_", " "),
      desc: "Sensor variance identified along the logistics pathway.",
    }
  );
};

export default function TrackingDetail({
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
      <AppShell customer>
        <div className="parcel-wrap">
          <div className="empty-state py-24">
            <RefreshCw size={28} className="animate-spin text-sky-500 mx-auto mb-3" />
            <strong className="text-base text-slate-800 block">Connecting to Live Tracking Stream...</strong>
            <span className="text-xs text-slate-400">Verifying delivery promise and route sensors for {trackingId}...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  const executeReroute = async () => {
    setActionState("loading");
    setActionMessage("");
    try {
      const result = await api.executeDeliveryAction(parcel.tracking_id, "LOCKER-WEST-01");
      setActionState("success");
      setActionMessage(
        result.status === "SUCCESS"
          ? `Locker reservation confirmed! Your delivery is now routed to Smart Locker Hub (West Metro). Projected delay reduced to ${result.updated_predicted_delay_hrs.toFixed(1)}h.`
          : "Diversion command processed."
      );
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
      setActionMessage(
        err instanceof Error ? err.message : "Unable to complete locker diversion at this time."
      );
    }
  };

  const isRisk = parcel.sla_breach_predicted || parcel.predicted_delay_hrs > 0.5;
  const isLocker = parcel.current_status === "REROUTED_TO_LOCKER";

  // Calculate adjusted delivery window
  const baseEtaMs = new Date(parcel.promised_eta).getTime();
  const adjustedArrivalMs = baseEtaMs + parcel.predicted_delay_hrs * 3600000;
  const adjustedWindowEndMs = adjustedArrivalMs + 2 * 3600000;

  return (
    <AppShell customer>
      <main className="parcel-wrap animate-fade-in">
        {/* Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="crumb mb-0">
            <Link href="/track" className="hover:underline flex items-center gap-1">
              <ArrowLeft size={13} />
              <span>Tracking Home</span>
            </Link>
            <span>/</span>
            <span className="font-mono font-bold text-slate-800">{trackingId}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-200">
              {parcel.priority_tier} Guaranteed Delivery
            </span>
            <Link
              href={`/admin/parcel/${trackingId}`}
              className="text-xs text-slate-500 hover:text-sky-600 flex items-center gap-1 transition-colors"
            >
              <span>Carrier View</span>
              <ExternalLink size={11} />
            </Link>
          </div>
        </div>

        {mock && (
          <div className="notice mb-6">
            <Info size={16} className="text-amber-600 flex-none" />
            <span>
              Displaying simulated tracking stream for demo shipment <strong>{parcel.tracking_id}</strong>. Real-time actions remain active.
            </span>
          </div>
        )}

        <div className="parcel-grid">
          {/* Main Column */}
          <div className="space-y-6">
            {/* Hero Delivery Status Banner */}
            <section
              className={`hero-status ${
                isLocker
                  ? "on-track"
                  : isRisk
                  ? "at-risk"
                  : "on-track"
              }`}
            >
              <div className="hero-top">
                <span className={`status-orb ${isLocker || !isRisk ? "green" : ""}`}>
                  {isLocker || !isRisk ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                </span>
                <div>
                  <p className="eyebrow">
                    {isLocker
                      ? "Intervention Active · Smart Locker Diverted"
                      : isRisk
                      ? "Promise Under Continuous Monitoring · Potential Delay"
                      : "Promise On Schedule · Normal Transit"}
                  </p>
                  <h1>
                    {isLocker
                      ? "Your delivery is secured at a Smart Locker"
                      : isRisk
                      ? "A slight delay was detected on your route"
                      : "Your package is arriving as promised"}
                  </h1>
                  <p>
                    {isLocker
                      ? "Your parcel will be safely deposited in a 24/7 temperature-controlled locker bay."
                      : isRisk
                      ? "Our predictive system detected transit congestion. You can keep your window or reroute to a 24/7 locker."
                      : "All sensors report nominal line-haul speeds. We expect on-time delivery."}
                  </p>
                </div>
              </div>

              <div className="eta-block">
                <div>
                  <span className="eta-label">Expected Delivery Window</span>
                  <strong className="eta-date">{dateText(parcel.promised_eta)}</strong>
                </div>

                <div className="eta-range">
                  {timeText(new Date(adjustedArrivalMs).toISOString())} –{" "}
                  {timeText(new Date(adjustedWindowEndMs).toISOString())}
                </div>
              </div>
            </section>

            {/* Visual Delivery Journey Stepper */}
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow text-slate-500">Live Journey Tracking</p>
                  <h2>Delivery Milestones</h2>
                </div>
                <span className="live-label">
                  <i />
                  Sensor Synced
                </span>
              </div>

              <div className="journey-stepper">
                {/* Step 1 */}
                <div className="step-item completed">
                  <div className="step-icon-container">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="step-content">
                    <strong>Package Picked Up & Dispatched</strong>
                    <small>Processed through origin sort center · São Paulo Central</small>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="step-item completed">
                  <div className="step-icon-container">
                    <Truck size={16} />
                  </div>
                  <div className="step-content">
                    <strong>In Transit · Highway Corridor</strong>
                    <small>Real-time vehicle telemetry verified · Telemetry active</small>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`step-item ${isLocker ? "completed" : isRisk ? "active" : "completed"}`}>
                  <div className="step-icon-container">
                    {isRisk && !isLocker ? <Sparkles size={16} /> : <CheckCircle2 size={16} />}
                  </div>
                  <div className="step-content">
                    <strong>
                      {isLocker
                        ? "Smart Locker Diversion Confirmed"
                        : isRisk
                        ? "Predictive SLA Guard Alert Triggered"
                        : "Regional Depot Arrival on Schedule"}
                    </strong>
                    <small>
                      {isLocker
                        ? "Bypassed last-mile courier queue · Routed to West Metro Locker"
                        : isRisk
                        ? `Advance alert generated with ${parcel.advance_notice_hours.toFixed(0)}h notice to protect your delivery window`
                        : "Passed intermediate checkpoint without delay"}
                    </small>
                  </div>
                </div>

                {/* Step 4 */}
                <div className={`step-item ${isLocker ? "active" : ""}`}>
                  <div className="step-icon-container">
                    {isLocker ? <Lock size={16} /> : <MapPin size={16} />}
                  </div>
                  <div className="step-content">
                    <strong>
                      {isLocker ? "Out for Final Drop at Smart Locker Bay" : "Final Delivery to Destination Address"}
                    </strong>
                    <small>
                      {isLocker
                        ? "Pickup PIN will be texted upon driver locker deposit"
                        : "Courier scheduled for standard doorstep delivery"}
                    </small>
                  </div>
                </div>
              </div>
            </section>

            {/* Promise Comparison Panel */}
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow text-slate-500">Delivery Commitment</p>
                  <h2>Promise Timeline Comparison</h2>
                </div>
              </div>

              <div className="comparison">
                <div className="compare-item">
                  <span>Contracted Promised ETA</span>
                  <strong>
                    {timeText(parcel.promised_eta)} · {dateText(parcel.promised_eta).split(",")[0]}
                  </strong>
                </div>

                <div className={`compare-item ${isRisk && !isLocker ? "alert" : ""}`}>
                  <span>Current Projected Time</span>
                  <strong>
                    {isRisk && !isLocker
                      ? `+${parcel.predicted_delay_hrs.toFixed(1)}h Adjustment`
                      : "On Schedule (0.0h)"}
                  </strong>
                </div>

                <div className="compare-item">
                  <span>Confidence Level</span>
                  <strong className="text-emerald-600">
                    {Math.round(parcel.conformal_interval.confidence_level * 100)}% Certainty
                  </strong>
                </div>
              </div>
            </section>

            {/* Why Is It Delayed? (Root Causes) */}
            {parcel.root_cause_diagnosis.length > 0 && (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow text-slate-500">Full Transparency</p>
                    <h2>Transit Factors Observed on Route</h2>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-4">
                  Our system continuously ingests road conditions, facility processing dwell times, and localized weather. Here is what impacted this shipment:
                </p>

                <div className="space-y-3">
                  {parcel.root_cause_diagnosis.map((cause) => {
                    const info = friendlyCause(cause.feature);
                    return (
                      <div
                        key={cause.feature}
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3.5"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-none mt-0.5">
                          <AlertTriangle size={15} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <strong className="text-sm font-semibold text-slate-900">
                              {info.title}
                            </strong>
                            <span className="text-xs font-mono font-bold text-amber-700">
                              +{cause.contribution_hrs.toFixed(1)}h
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {info.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Reroute to Locker Customer Action Panel */}
            <section className="panel action-panel">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="eyebrow text-emerald-800">Customer Self-Service Control</p>
                  <h2>Avoid Delay with Smart Locker Pickup</h2>
                </div>
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Lock size={16} />
                </span>
              </div>

              <p>
                Reroute your package to a secure neighborhood <strong>24/7 Smart Locker</strong>. The predictive engine calculates this recovers <strong>{parcel.recommended_action.estimated_hours_saved.toFixed(1)} hours</strong> by eliminating courier traffic delays.
              </p>

              <div className="p-3.5 bg-white/90 rounded-xl border border-emerald-200 text-xs text-slate-700 space-y-1.5 my-3">
                <div className="flex items-center gap-2 font-semibold text-emerald-900">
                  <MapPin size={14} className="text-emerald-600" />
                  <span>Assigned Hub: Parcel Guard Smart Locker · West Metro Station</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 pl-5">
                  <Clock size={13} />
                  <span>Accessible 24 Hours a day · 7 Days a week · Fully illuminated</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  className="button accent px-6"
                  onClick={executeReroute}
                  disabled={actionState === "loading" || isLocker}
                >
                  {actionState === "loading" ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Reserving Secure Locker Bay...</span>
                    </>
                  ) : isLocker ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Locker Reroute Confirmed</span>
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>Reroute to Smart Locker Now</span>
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
          </div>

          {/* Right Column / Aside */}
          <aside className="space-y-6">
            {/* Shipment Snapshot */}
            <section className="panel side-card">
              <h3>Shipment Snapshot</h3>
              <div className="detail-list">
                <div>
                  <span>Tracking Number</span>
                  <strong className="font-mono text-slate-800">{parcel.tracking_id}</strong>
                </div>
                <div>
                  <span>Carrier Service</span>
                  <strong>{parcel.priority_tier} Expedited</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong className="font-mono text-cyan-700">{parcel.current_status}</strong>
                </div>
                <div>
                  <span>Advance Notice</span>
                  <strong>{parcel.advance_notice_hours.toFixed(0)} hours early warning</strong>
                </div>
              </div>
            </section>

            {/* Live SMS Message Preview */}
            {customerMessage && (
              <section className="panel side-card bg-gradient-to-br from-white to-sky-50 border-sky-200">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={16} className="text-sky-600" />
                  <h3 className="mb-0 text-slate-900">Your SMS & Push Alert</h3>
                </div>
                <div className="p-3 bg-white rounded-lg border border-sky-200 text-xs font-mono text-slate-700 leading-relaxed shadow-sm mt-2">
                  {customerMessage}
                </div>
                <small className="text-[11px] text-slate-400 mt-2 block">
                  Automated update sent to recipient mobile device.
                </small>
              </section>
            )}

            {/* Reassurance Card */}
            <section className="panel side-card reassurance">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} className="text-cyan-400" />
                <h3 className="mb-0">The Parcel Promise</h3>
              </div>
              <p>
                Our AI continuously tracks weather, highway incidents, and depot sorting lines. If anything risks your delivery date, we take proactive steps before you even notice.
              </p>
            </section>

            {/* Support / Contact */}
            <section className="panel side-card">
              <h3>Need Delivery Assistance?</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                Questions about pickup codes or locker accessibility? Our 24/7 logistics care team is on standby.
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 flex justify-between items-center">
                <span>Direct Support Line</span>
                <strong className="font-mono text-sky-700">1-800-PARCEL-G</strong>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
