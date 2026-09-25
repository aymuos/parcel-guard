"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell, PageHeader, StatusPill } from "@/components/AppShell";
import {
  Boxes,
  MapPin,
  Truck,
  CloudRain,
  Clock,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers,
  CheckCircle2,
  RefreshCw
} from "lucide-react";

interface TerminalHub {
  id: string;
  name: string;
  region: "South" | "North" | "East" | "West" | "Central";
  type: "Origin Hub" | "Destination Hub" | "Smart Locker Complex";
  activeParcels: number;
  avgDwellHrs: number;
  weatherRisk: number; // 0 to 1
  capacityUsedPct: number;
  status: "healthy" | "risk" | "critical";
  lockersAvailable: number;
  totalLockers: number;
}

const networkHubs: TerminalHub[] = [
  {
    id: "HUB_SP_01",
    name: "São Paulo Central Sorting Facility",
    region: "Central",
    type: "Origin Hub",
    activeParcels: 3840,
    avgDwellHrs: 1.4,
    weatherRisk: 0.22,
    capacityUsedPct: 78,
    status: "healthy",
    lockersAvailable: 42,
    totalLockers: 60,
  },
  {
    id: "HUB_RJ_02",
    name: "Rio de Janeiro Gateway Terminal",
    region: "East",
    type: "Origin Hub",
    activeParcels: 2490,
    avgDwellHrs: 2.1,
    weatherRisk: 0.45,
    capacityUsedPct: 84,
    status: "risk",
    lockersAvailable: 18,
    totalLockers: 50,
  },
  {
    id: "HUB_MG_01",
    name: "Minas Gerais Intermodal Depot",
    region: "North",
    type: "Origin Hub",
    activeParcels: 1820,
    avgDwellHrs: 1.2,
    weatherRisk: 0.15,
    capacityUsedPct: 62,
    status: "healthy",
    lockersAvailable: 35,
    totalLockers: 45,
  },
  {
    id: "HUB_PR_01",
    name: "Paraná Freight Corridor Hub",
    region: "South",
    type: "Origin Hub",
    activeParcels: 1450,
    avgDwellHrs: 1.3,
    weatherRisk: 0.38,
    capacityUsedPct: 70,
    status: "healthy",
    lockersAvailable: 28,
    totalLockers: 40,
  },
  {
    id: "HUB_SOUTH_01",
    name: "South Regional Distribution Center",
    region: "South",
    type: "Destination Hub",
    activeParcels: 2180,
    avgDwellHrs: 3.4,
    weatherRisk: 0.82,
    capacityUsedPct: 92,
    status: "critical",
    lockersAvailable: 8,
    totalLockers: 80,
  },
  {
    id: "HUB_WEST_04",
    name: "West Metropolitan Fulfillment Hub",
    region: "West",
    type: "Destination Hub",
    activeParcels: 2940,
    avgDwellHrs: 1.8,
    weatherRisk: 0.35,
    capacityUsedPct: 81,
    status: "risk",
    lockersAvailable: 32,
    totalLockers: 100,
  },
  {
    id: "HUB_NORTH_02",
    name: "North Logistics Nexus",
    region: "North",
    type: "Destination Hub",
    activeParcels: 1640,
    avgDwellHrs: 1.5,
    weatherRisk: 0.18,
    capacityUsedPct: 68,
    status: "healthy",
    lockersAvailable: 45,
    totalLockers: 60,
  },
  {
    id: "HUB_EAST_01",
    name: "East Coast Dispatch Terminal",
    region: "East",
    type: "Destination Hub",
    activeParcels: 1980,
    avgDwellHrs: 2.2,
    weatherRisk: 0.52,
    capacityUsedPct: 86,
    status: "risk",
    lockersAvailable: 22,
    totalLockers: 70,
  },
];

export default function TerminalsPage() {
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [selectedHub, setSelectedHub] = useState<TerminalHub | null>(null);

  const filteredHubs = networkHubs.filter(
    (hub) => regionFilter === "ALL" || hub.region.toUpperCase() === regionFilter
  );

  return (
    <AppShell>
      <div className="content">
        <PageHeader
          eyebrow="Network Topology & Terminal Health"
          title="Fulfillment Terminals & Locker Hubs"
          description="Real-time capacity tracking, micro-telemetry dwell times, and regional weather severity across all intermodal depots."
        >
          <div className="flex items-center gap-2">
            <select
              className="select-control text-xs"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="ALL">All Network Regions</option>
              <option value="CENTRAL">Central Region</option>
              <option value="SOUTH">South Corridor</option>
              <option value="WEST">West Region</option>
              <option value="NORTH">North Region</option>
              <option value="EAST">East Region</option>
            </select>
          </div>
        </PageHeader>

        {/* Aggregate Summary */}
        <section className="kpi-grid mb-6">
          <div className="kpi-card blue">
            <div className="kpi-label">
              <span>Monitored Hubs</span>
              <Boxes size={16} className="text-sky-500" />
            </div>
            <strong>{networkHubs.length} Facilities</strong>
            <span className="kpi-meta">8 Primary corridor hubs active</span>
          </div>

          <div className="kpi-card green">
            <div className="kpi-label">
              <span>Smart Locker Capacity</span>
              <ShieldCheck size={16} className="text-emerald-500" />
            </div>
            <strong>230 Bays</strong>
            <span className="kpi-meta">Available for rapid reroute</span>
          </div>

          <div className="kpi-card amber">
            <div className="kpi-label">
              <span>Congestion Bottleneck</span>
              <Clock size={16} className="text-amber-500" />
            </div>
            <strong>HUB_SOUTH_01</strong>
            <span className="kpi-meta">Avg dwell time: 3.4 hours</span>
          </div>

          <div className="kpi-card violet">
            <div className="kpi-label">
              <span>Weather Front</span>
              <CloudRain size={16} className="text-violet-500" />
            </div>
            <strong>Severe (0.82)</strong>
            <span className="kpi-meta">South corridor weather alert</span>
          </div>
        </section>

        {/* Hub Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {filteredHubs.map((hub) => {
            const isSelected = selectedHub?.id === hub.id;
            return (
              <div
                key={hub.id}
                onClick={() => setSelectedHub(isSelected ? null : hub)}
                className={`panel p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 ${
                  isSelected
                    ? "ring-2 ring-cyan-500 shadow-md bg-sky-50/20"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded inline-block mb-1">
                      {hub.id}
                    </span>
                    <h3 className="font-display font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                      {hub.name}
                    </h3>
                  </div>
                  <StatusPill status={hub.status} />
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Truck size={13} />
                      <span>Active Flow</span>
                    </span>
                    <strong className="text-slate-900 font-mono">
                      {hub.activeParcels.toLocaleString()} parcels
                    </strong>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={13} />
                      <span>Avg Waiting Time</span>
                    </span>
                    <strong className={`font-mono ${hub.avgDwellHrs > 2.5 ? "text-rose-600" : "text-slate-800"}`}>
                      {hub.avgDwellHrs}h
                    </strong>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <CloudRain size={13} />
                      <span>Weather Severity</span>
                    </span>
                    <strong className={`font-mono ${hub.weatherRisk > 0.6 ? "text-amber-600" : "text-slate-800"}`}>
                      {(hub.weatherRisk * 100).toFixed(0)}%
                    </strong>
                  </div>

                  {/* Capacity Bar */}
                  <div className="pt-1">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-500">Facility Load</span>
                      <span className="font-semibold text-slate-700">{hub.capacityUsedPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          hub.capacityUsedPct > 85
                            ? "bg-rose-500"
                            : hub.capacityUsedPct > 70
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${hub.capacityUsedPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Locker Bay Availability:</span>
                    <span className="font-semibold text-emerald-600 font-mono">
                      {hub.lockersAvailable}/{hub.totalLockers} Free
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Hub Deep Dive */}
        {selectedHub ? (
          <div className="panel bg-gradient-to-br from-white to-sky-50/40 border-sky-200 p-6 animate-scale-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300">
                    {selectedHub.id}
                  </span>
                  <StatusPill status={selectedHub.status} />
                  <span className="text-xs font-medium text-slate-500">{selectedHub.type}</span>
                </div>
                <h2 className="text-xl font-bold font-display text-slate-900">{selectedHub.name}</h2>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/admin/at-risk"
                  className="button primary text-xs py-2 px-3.5"
                >
                  <span>Filter At-Risk Through This Hub</span>
                  <ArrowRight size={13} />
                </Link>
                <button
                  onClick={() => setSelectedHub(null)}
                  className="button secondary text-xs"
                >
                  Close Detail
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="p-4 bg-white rounded-xl border border-slate-200/80">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Telemetry Stream Metrics
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Continuous sensor updates indicate <strong>{selectedHub.activeParcels}</strong> active containers in the yard with an average dwell duration of <strong>{selectedHub.avgDwellHrs} hours</strong>.
                </p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200/80">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Locker Intervention Readiness
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  <strong>{selectedHub.lockersAvailable}</strong> out of {selectedHub.totalLockers} smart locker bays are currently vacant and configured for automated parcel diversion.
                </p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200/80">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Corridor Risk Evaluation
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Weather risk index of <strong>{(selectedHub.weatherRisk * 100).toFixed(0)}%</strong> is evaluated in real-time by the TreeSHAP causal remediation pipeline.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-center text-xs text-slate-500">
            Click on any terminal hub above to inspect live throughput telemetry, locker bay headroom, and regional sensor risk.
          </div>
        )}
      </div>
    </AppShell>
  );
}
