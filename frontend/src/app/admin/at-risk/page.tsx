"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { AppShell, PageHeader, StatusPill } from "@/components/AppShell";
import { api, PromiseResponse } from "@/lib/api";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  DollarSign,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  Zap
} from "lucide-react";

export default function AtRiskPage() {
  const [items, setItems] = useState<PromiseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [delayFilter, setDelayFilter] = useState<string>("ALL");

  const sortNewest = (values: PromiseResponse[]) =>
    [...values].sort(
      (left, right) =>
        new Date(right.promised_eta).getTime() - new Date(left.promised_eta).getTime()
    );

  const fetchItems = async () => {
    setRefreshing(true);
    try {
      const values = await api.getAtRisk();
      setItems(sortNewest(values));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesQuery =
        item.tracking_id.toLowerCase().includes(query.toLowerCase()) ||
        item.priority_tier.toLowerCase().includes(query.toLowerCase()) ||
        (item.root_cause_diagnosis[0]?.feature || "").toLowerCase().includes(query.toLowerCase());

      const matchesPriority =
        priorityFilter === "ALL" || item.priority_tier.toUpperCase() === priorityFilter;

      const matchesDelay =
        delayFilter === "ALL" ||
        (delayFilter === "CRITICAL" && item.predicted_delay_hrs >= 3.0) ||
        (delayFilter === "MODERATE" && item.predicted_delay_hrs < 3.0);

      return matchesQuery && matchesPriority && matchesDelay;
    });
  }, [items, query, priorityFilter, delayFilter]);

  // Aggregate stats
  const totalValueAtRisk = useMemo(
    () => filtered.reduce((acc, curr) => acc + (curr.financial_metrics.sla_penalty_usd || 0), 0),
    [filtered]
  );
  const totalRecoverable = useMemo(
    () => filtered.reduce((acc, curr) => acc + (curr.financial_metrics.net_dollars_saved || 0), 0),
    [filtered]
  );
  const avgDelay = useMemo(() => {
    if (!filtered.length) return 0;
    return filtered.reduce((acc, curr) => acc + curr.predicted_delay_hrs, 0) / filtered.length;
  }, [filtered]);

  return (
    <AppShell>
      <div className="content">
        <PageHeader
          eyebrow="Continuous Threat Detection Queue"
          title="At-Risk Delivery Commitments"
          description="Live operational queue of shipments projected to breach SLA windows within the 6-hour advance intervention horizon."
        >
          <button
            className="button secondary"
            onClick={fetchItems}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin text-cyan-600" : "text-slate-600"}
            />
            <span>{refreshing ? "Screening..." : "Refresh Queue"}</span>
          </button>
        </PageHeader>

        {/* Quick KPI Banner */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="panel bg-gradient-to-br from-white to-amber-50/40 border-amber-200/60 p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-none">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Screened Commitments
              </span>
              <strong className="text-2xl font-bold font-display text-slate-900 block mt-0.5">
                {items.length} Parcels
              </strong>
              <small className="text-xs text-amber-700 font-medium">≥ 6h advance lead time</small>
            </div>
          </div>

          <div className="panel bg-gradient-to-br from-white to-rose-50/40 border-rose-200/60 p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-none">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Average Projected Delay
              </span>
              <strong className="text-2xl font-bold font-display text-slate-900 block mt-0.5">
                +{avgDelay.toFixed(1)} Hours
              </strong>
              <small className="text-xs text-rose-700 font-medium">Quantile upper-bound risk</small>
            </div>
          </div>

          <div className="panel bg-gradient-to-br from-white to-emerald-50/40 border-emerald-200/60 p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-none">
              <DollarSign size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Recoverable SLA Value
              </span>
              <strong className="text-2xl font-bold font-display text-slate-900 block mt-0.5">
                ${totalRecoverable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </strong>
              <small className="text-xs text-emerald-700 font-medium">Via causal locker reallocation</small>
            </div>
          </div>
        </section>

        {/* Filter and Table Panel */}
        <div className="panel table-panel">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                className="input-control w-full pl-10"
                placeholder="Search by Tracking ID, carrier, or root factor..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
                <Filter size={13} />
                <span>Filters:</span>
              </div>

              <select
                className="select-control text-xs"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="ALL">All Priorities</option>
                <option value="EXPRESS">Express Only</option>
                <option value="STANDARD">Standard Only</option>
                <option value="BULK">Bulk Logistics</option>
              </select>

              <select
                className="select-control text-xs"
                value={delayFilter}
                onChange={(e) => setDelayFilter(e.target.value)}
              >
                <option value="ALL">All Delays</option>
                <option value="CRITICAL">Critical (≥ 3h)</option>
                <option value="MODERATE">Moderate (&lt; 3h)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-1">
            <span>
              Showing <strong>{filtered.length}</strong> of {items.length} candidate parcels sorted by promise deadline
            </span>
            <span className="font-mono text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
              Causal Remediation: Automated
            </span>
          </div>

          {loading ? (
            <div className="empty-state py-16">
              <RefreshCw size={24} className="animate-spin text-sky-500 mx-auto mb-2" />
              <span>Screening network state store...</span>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tracking ID</th>
                    <th>Risk Severity</th>
                    <th>Predicted Delay</th>
                    <th>Lead Horizon</th>
                    <th>Primary TreeSHAP Driver</th>
                    <th>Recovery Value</th>
                    <th>Remediation</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.tracking_id}>
                      <td>
                        <Link
                          className="tracking-link font-mono"
                          href={`/admin/parcel/${item.tracking_id}`}
                        >
                          {item.tracking_id}
                        </Link>
                        <small className="font-semibold uppercase text-slate-500">
                          {item.priority_tier} Tier
                        </small>
                      </td>
                      <td>
                        <StatusPill
                          status={item.predicted_delay_hrs > 3 ? "critical" : "risk"}
                        />
                      </td>
                      <td>
                        <strong className="delay-value">
                          +{item.predicted_delay_hrs.toFixed(1)}h
                        </strong>
                        <small className="text-slate-400">
                          {item.delay_lower_bound_hrs.toFixed(1)}h – {item.delay_upper_bound_hrs.toFixed(1)}h (90% Conf)
                        </small>
                      </td>
                      <td>
                        <span className="font-medium text-slate-700">
                          {item.advance_notice_hours.toFixed(1)}h remaining
                        </span>
                        <small className="text-slate-400">Before promised ETA</small>
                      </td>
                      <td>
                        <span className="cause text-slate-800">
                          {item.root_cause_diagnosis[0]?.feature.replaceAll("_", " ") || "Sensor Variance"}
                        </span>
                        <small className="text-slate-400">
                          +{item.root_cause_diagnosis[0]?.contribution_hrs.toFixed(2)}h impact
                        </small>
                      </td>
                      <td>
                        <strong className="text-emerald-700 font-mono">
                          ${item.financial_metrics.net_dollars_saved.toFixed(0)} saved
                        </strong>
                        <small className="text-slate-400">
                          ${item.financial_metrics.sla_penalty_usd.toFixed(0)} penalty
                        </small>
                      </td>
                      <td>
                        <Link
                          className="button primary text-xs py-1.5 px-3 h-8"
                          href={`/admin/parcel/${item.tracking_id}`}
                        >
                          <span>Inspect</span>
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && !loading && (
                <div className="empty-state py-12">
                  <ShieldCheck size={32} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No parcels match the selected filters.</p>
                  <span className="text-xs text-slate-400">All matching shipments are currently within compliant delivery intervals.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
