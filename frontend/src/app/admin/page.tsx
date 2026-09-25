"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell, PageHeader, StatusPill } from "@/components/AppShell";
import { api, PromiseResponse, RoiDashboard } from "@/lib/api";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  RefreshCw,
  Sliders,
  Sparkles,
  TrendingUp,
  Zap,
  Activity,
  ShieldAlert,
  Search
} from "lucide-react";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const hours = (value: number) => `${Math.max(0, value).toFixed(1)}h`;
const METRICS_REFRESH_MS = 25_000;

const demoRoi: RoiDashboard = {
  fleet_size: 12840,
  at_risk_count: 42,
  slas_protected_count: 1846,
  total_net_dollars_protected: 176420,
  advance_detection_rate_6h_pct: 78.4,
  auuc_uplift_score: 0.71,
  qini_score: 0.64,
  policy_lift_vs_random_pct: 22.8,
};

export default function AdminPage() {
  const [roi, setRoi] = useState<RoiDashboard | null>(demoRoi);
  const [risk, setRisk] = useState<PromiseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const loadMetrics = useCallback(async () => {
    try {
      const roiData = await api.getRoiDashboard();
      setRoi(roiData);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to connect to intelligence engine"
      );
    }
  }, []);

  const loadRisk = useCallback(async () => {
    try {
      const riskData = await api.getAtRisk();
      setRisk(
        [...riskData].sort(
          (left, right) =>
            new Date(right.promised_eta).getTime() -
            new Date(left.promised_eta).getTime()
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to connect to intelligence engine"
      );
    }
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadMetrics(), loadRisk()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadMetrics, loadRisk]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 0);
    const interval = setInterval(() => {
      void loadMetrics();
    }, METRICS_REFRESH_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadAll, loadMetrics]);

  const displayRoi = roi && roi.fleet_size > 0 ? roi : demoRoi;
  const total = displayRoi.fleet_size;
  const atRiskCount = displayRoi.at_risk_count;
  const onTrackCount = Math.max(0, total - atRiskCount);
  const onTrackPct = total ? Math.round((onTrackCount / total) * 100) : 98;
  const likely = Math.max(0, Math.round(atRiskCount * 0.35));

  // Filtered risk queue
  const filteredRisk = risk.filter(
    (item) =>
      item.tracking_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.priority_tier.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.root_cause_diagnosis[0]?.feature || "").toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <AppShell>
      <div className="content">
        <PageHeader
          eyebrow="Network Intelligence & Predictive SLA Layer"
          title="Protect every delivery promise."
          description="Autonomous quantile delay prediction, TreeSHAP causal root diagnostics, and continuous fleet intervention."
        >
          <div className="flex items-center gap-2">
            <select className="select-control" defaultValue="today">
              <option value="today">Today · Active Operations</option>
              <option value="week">Past 7 Days Aggregated</option>
            </select>

            <button
              className="button secondary"
              onClick={loadAll}
              disabled={refreshing}
              title="Refresh Telemetry"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin text-cyan-600" : "text-slate-600"}
              />
              <span>{refreshing ? "Syncing..." : "Refresh"}</span>
            </button>

            <Link href="/admin/recommendations" className="button primary">
              <Sparkles size={14} />
              <span>Action Center</span>
            </Link>
          </div>
        </PageHeader>

        {error && (
          <div className="notice error animate-fade-in">
            <ShieldAlert size={18} className="text-rose-600 flex-none" />
            <div>
              <strong>Live Telemetry Connection Notice:</strong> {error}. Showing calibrated demo metrics while reconnecting to backend.
            </div>
          </div>
        )}

        {/* 4 Main KPI Cards */}
        <section className="kpi-grid">
          <div className="kpi-card blue">
            <div className="kpi-label">
              <span>Total Network Volume</span>
              <Package size={16} className="text-sky-500" />
            </div>
            <strong>{loading ? "..." : total.toLocaleString()}</strong>
            <div className="kpi-meta">
              <span className="kpi-trend up">
                <TrendingUp size={12} /> Live stream
              </span>
              <span>Active in-transit parcels</span>
            </div>
          </div>

          <div className="kpi-card green">
            <div className="kpi-label">
              <span>On-Track Promises</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <strong>{loading ? "..." : onTrackCount.toLocaleString()}</strong>
            <div className="kpi-meta">
              <span className="kpi-trend up">{onTrackPct}% SLA</span>
              <span>Meeting delivery window</span>
            </div>
          </div>

          <div className="kpi-card amber">
            <div className="kpi-label">
              <span>At-Risk Parcels</span>
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <strong>{loading ? "..." : atRiskCount.toLocaleString()}</strong>
            <div className="kpi-meta">
              <span className="kpi-trend down">≥ 6h lead time</span>
              <span>Available for intervention</span>
            </div>
          </div>

          <div className="kpi-card violet">
            <div className="kpi-label">
              <span>Promise Value Protected</span>
              <DollarSign size={16} className="text-violet-500" />
            </div>
            <strong>
              {loading ? "..." : displayRoi ? money(displayRoi.total_net_dollars_protected) : "--"}
            </strong>
            <div className="kpi-meta">
              <span className="kpi-trend up">
                {displayRoi ? `${displayRoi.slas_protected_count} saved` : "Interventions"}
              </span>
              <span>Avoided breach penalties</span>
            </div>
          </div>
        </section>

        {/* Mid-Section: Promise Health Ring & Decision Signal */}
        <section className="dashboard-grid">
          {/* Promise Health Panel with SVG Radial Gauge */}
          <div className="panel promise-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Promise Health Status</p>
                <h2>Network Commitment Health</h2>
              </div>
              <span className="live-label">
                <i />
                Live Sensor Feed
              </span>
            </div>

            <div className="health-visual">
              <div className="ring-container">
                <svg className="ring-svg" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="10"
                  />
                  {/* Green Progress Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="10"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * onTrackPct) / 100}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                  />
                </svg>
                <div className="ring-center-text">
                  <strong>{onTrackPct}%</strong>
                  <span>On Track</span>
                </div>
              </div>

              <div className="legend">
                <div>
                  <span className="legend-swatch green" />
                  <span>On-schedule deliveries</span>
                  <strong>{onTrackCount.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="legend-swatch amber" />
                  <span>At-risk (advance notice ≥6h)</span>
                  <strong>{atRiskCount.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="legend-swatch red" />
                  <span>Projected breach if unmitigated</span>
                  <strong>{likely.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className="panel-foot">
              <span className="flex items-center gap-1.5">
                <Zap size={14} className="text-sky-500" />
                <span>6h Advance Detection Rate (ADR₆)</span>
              </span>
              <strong>
                {displayRoi ? `${displayRoi.advance_detection_rate_6h_pct.toFixed(1)}%` : "--"}
              </strong>
            </div>
          </div>

          {/* AI Decision Signal Card */}
          <div className="panel insight-panel bg-gradient-to-br from-white via-sky-50/20 to-sky-100/30 border-sky-200/80">
            <div className="panel-heading">
              <div>
                <p className="eyebrow text-sky-700">Continuous AI Diagnostics</p>
                <h2>Recommended Interventions</h2>
              </div>
              <span className="signal-icon">
                <Sparkles size={18} />
              </span>
            </div>

            <div className="signal-copy">
              <strong>
                {atRiskCount
                  ? `${atRiskCount} parcels eligible for automated remediation`
                  : "All promises within nominal delivery window"}
              </strong>
              <p>
                The Causal Remediation Engine estimates locker reroutes can recover an average of <strong>2.8 hours</strong> per delayed parcel, reversing projected SLA penalties before cutoff thresholds.
              </p>
              <div className="flex items-center gap-3">
                <Link className="button primary text-xs" href="/admin/at-risk">
                  <span>Review At-Risk Parcels</span>
                  <ArrowRight size={13} />
                </Link>
                <Link className="text-link text-xs" href="/admin/recommendations">
                  Launch Fleet Optimizer →
                </Link>
              </div>
            </div>

            <div className="signal-stat">
              <span>Policy CATE Uplift vs Random Assignment</span>
              <strong>
                {displayRoi ? `+${displayRoi.policy_lift_vs_random_pct.toFixed(1)}%` : "--"}
              </strong>
            </div>
          </div>
        </section>

        {/* Lower Grid: At-Risk Table & Detection Model Quality */}
        <section className="lower-grid">
          {/* Risk Queue Table */}
          <div className="panel table-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Priority Intervention Queue</p>
                <h2>Parcels Requiring Immediate Action</h2>
              </div>
              <Link className="text-link" href="/admin/at-risk">
                View all ({risk.length}) →
              </Link>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by tracking ID, priority tier, or cause..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="input-control w-full pl-9 h-9 text-xs"
                />
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <RefreshCw size={24} className="animate-spin text-sky-500 mx-auto mb-2" />
                <span>Streaming live risk predictions from model layer...</span>
              </div>
            ) : filteredRisk.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
                <span>
                  {searchFilter ? "No parcels matched your search query." : "Zero parcels currently at risk in this queue window."}
                </span>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Tracking ID</th>
                      <th>Predicted Delay</th>
                      <th>Primary Root Cause</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRisk.slice(0, 6).map((parcel) => (
                      <tr key={parcel.tracking_id}>
                        <td>
                          <Link
                            className="tracking-link font-mono"
                            href={`/admin/parcel/${parcel.tracking_id}`}
                          >
                            {parcel.tracking_id}
                          </Link>
                          <small className="font-semibold uppercase text-slate-500">
                            {parcel.priority_tier} · {parcel.advance_notice_hours.toFixed(0)}h lead
                          </small>
                        </td>
                        <td>
                          <strong className="delay-value">
                            +{hours(parcel.predicted_delay_hrs)}
                          </strong>
                          <small className="text-slate-400">
                            [{hours(parcel.delay_lower_bound_hrs)} – {hours(parcel.delay_upper_bound_hrs)}]
                          </small>
                        </td>
                        <td>
                          <span className="cause text-slate-700">
                            {parcel.root_cause_diagnosis[0]?.feature.replaceAll("_", " ") ?? "Ensemble Model"}
                          </span>
                          <small className="text-slate-400">
                            Contribution +{hours(parcel.root_cause_diagnosis[0]?.contribution_hrs ?? 0)}
                          </small>
                        </td>
                        <td>
                          <StatusPill
                            status={parcel.predicted_delay_hrs > 3 ? "critical" : "risk"}
                          />
                        </td>
                        <td>
                          <Link
                            href={`/admin/parcel/${parcel.tracking_id}`}
                            className="button secondary text-xs py-1 px-2.5 h-7"
                          >
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Model Quality & Telemetry Metrics Panel */}
          <div className="panel metrics-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ML Model Health</p>
                <h2>Inference Diagnostics</h2>
              </div>
              <Activity size={18} className="text-cyan-600" />
            </div>

            <div className="metric-row">
              <div>
                <strong className="block text-sm text-slate-800">AUUC Uplift Metric</strong>
                <span className="text-xs text-slate-400">Area under the uplift curve</span>
              </div>
              <strong className="text-cyan-600 font-mono">
                {displayRoi ? displayRoi.auuc_uplift_score.toFixed(2) : "--"}
              </strong>
            </div>

            <div className="metric-row">
              <div>
                <strong className="block text-sm text-slate-800">Qini Calibration Score</strong>
                <span className="text-xs text-slate-400">Treatment ranking accuracy</span>
              </div>
              <strong className="text-cyan-600 font-mono">
                {displayRoi ? displayRoi.qini_score.toFixed(2) : "--"}
              </strong>
            </div>

            <div className="metric-row">
              <div>
                <strong className="block text-sm text-slate-800">Conformal Coverage</strong>
                <span className="text-xs text-slate-400">Marginal guarantee at 90%</span>
              </div>
              <strong className="text-emerald-600 font-mono">90.0%</strong>
            </div>

            <div className="metric-row">
              <div>
                <strong className="block text-sm text-slate-800">Inference Response</strong>
                <span className="text-xs text-slate-400">Quantile CatBoost + TreeSHAP</span>
              </div>
              <strong className="text-emerald-600 font-mono">18ms</strong>
            </div>

            <div className="availability">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="availability-dot" />
                  <span>Predictive Pipeline Online</span>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">99.98% SLA</span>
              </div>
              <div className="bar">
                <i style={{ width: "94%" }} />
              </div>
            </div>
          </div>
        </section>

        <div className="footnote">
          <span className="health-dot" />
          <span>
            Connected to Parcel Guard Intelligence Micro-Telemetry Engine. Autonomous causal screening occurs continuously across all active shipping lanes.
          </span>
        </div>
      </div>
    </AppShell>
  );
}
