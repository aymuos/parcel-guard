"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AppShell, PageHeader } from "@/components/AppShell";
import { api, FleetOptimizationResponse, StressTestResponse } from "@/lib/api";
import {
  CloudLightning,
  Sparkles,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Boxes,
  DollarSign,
  ArrowRight,
  TrendingUp,
  MapPin
} from "lucide-react";

const regions = [
  { id: "SOUTH", name: "South Corridor", alert: "High sensitivity" },
  { id: "NORTH", name: "North Logistics", alert: "Normal" },
  { id: "EAST", name: "East Coast Hubs", alert: "Moderate traffic" },
  { id: "WEST", name: "West Metro", alert: "High locker density" },
  { id: "ALL", name: "Full Global Network", alert: "System-wide stress" },
];

export default function RecommendationsPage() {
  const [weatherSpike, setWeatherSpike] = useState<number>(0.8);
  const [region, setRegion] = useState("SOUTH");
  const [result, setResult] = useState<StressTestResponse | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<FleetOptimizationResponse | null>(null);
  const [optimizationError, setOptimizationError] = useState("");

  const runStressTest = async (event: FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await api.runStressTest(weatherSpike, region);
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to run network simulation on backend engine."
      );
    } finally {
      setRunning(false);
    }
  };

  const optimizeFleet = async () => {
    setOptimizing(true);
    setOptimizationError("");
    setOptimization(null);
    try {
      const res = await api.optimizeFleet();
      setOptimization(res);
    } catch (err) {
      setOptimizationError(
        err instanceof Error ? err.message : "Unable to execute fleet ILP optimization"
      );
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <AppShell>
      <div className="content">
        <PageHeader
          eyebrow="Simulation Workbench & Causal Dispatch"
          title="Automated Interventions & Stress Testing"
          description="Simulate adverse weather shocks, predict downstream SLA vulnerabilities, and solve integer linear programming (ILP) fleet reallocations."
        />

        {/* 2-Column Action Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Card 1: Network Stress Testing Workbench */}
          <div className="panel bg-gradient-to-br from-white via-white to-sky-50/30 border-sky-200/80">
            <div className="panel-heading">
              <div>
                <p className="eyebrow text-sky-700">Digital Twin Simulator</p>
                <h2>Inject Weather & Congestion Shock</h2>
              </div>
              <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <CloudLightning size={19} />
              </span>
            </div>

            <p className="page-description mb-5">
              Select a target logistics corridor and inject simulated adverse meteorological conditions into the state store to evaluate model resilience.
            </p>

            <form onSubmit={runStressTest} className="space-y-4">
              {/* Region Selector Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Target Corridor Region
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {regions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRegion(r.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                        region === r.id
                          ? "border-sky-500 bg-sky-50/80 text-sky-900 font-semibold shadow-sm ring-1 ring-sky-500"
                          : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                      }`}
                    >
                      <strong className="block text-xs">{r.name}</strong>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{r.alert}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Weather Severity Slider */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Weather Severity Shock
                  </label>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    weatherSpike >= 0.8
                      ? "bg-rose-100 text-rose-800"
                      : weatherSpike >= 0.5
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {weatherSpike >= 0.8 ? "Severe Storm" : weatherSpike >= 0.5 ? "Heavy Rain" : "Moderate Squall"} · {weatherSpike.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={weatherSpike}
                  onChange={(e) => setWeatherSpike(parseFloat(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0.1 (Light Fog)</span>
                  <span>0.5 (Rainstorm)</span>
                  <span>1.0 (Severe Blizzard/Monsoon)</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={running}
                  className="button primary w-full h-11"
                >
                  {running ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Simulating Network Shock...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={15} />
                      <span>Run Network Stress Simulation</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="notice error mt-4">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="notice success mt-4 flex-col items-start gap-1 animate-scale-in">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Simulation Successfully Applied</span>
                </div>
                <p className="text-xs text-emerald-900 mt-1">
                  <strong>{result.affected_parcels_count.toLocaleString()} parcels</strong> in corridor <strong>{result.affected_region}</strong> absorbed the severity shock of {result.weather_spike_applied}. Fleet optimizer automatically evaluated counterfactual remediations.
                </p>
                <div className="mt-2">
                  <Link href="/admin/at-risk" className="text-link text-xs">
                    Inspect newly triggered at-risk shipments →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Fleet Optimization (ILP Solver) */}
          <div className="panel bg-gradient-to-br from-white via-white to-emerald-50/30 border-emerald-200/80 flex flex-col">
            <div className="panel-heading">
              <div>
                <p className="eyebrow text-emerald-700">Constrained ILP Solver</p>
                <h2>Fleet Reallocation Engine</h2>
              </div>
              <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Sparkles size={19} />
              </span>
            </div>

            <p className="page-description mb-5">
              Execute integer linear programming across all screened at-risk parcels. Assigns smart locker diversions to maximize net recovered dollars under strict terminal capacity constraints.
            </p>

            <div className="space-y-3.5 mb-6 flex-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-medium flex items-center gap-1.5">
                    <Boxes size={13} className="text-slate-500" />
                    <span>Locker Constraints Mode:</span>
                  </span>
                  <span className="font-semibold font-mono text-slate-900">Dynamic Real-Time Capacity</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-medium flex items-center gap-1.5">
                    <DollarSign size={13} className="text-slate-500" />
                    <span>Re-route Cost Factor:</span>
                  </span>
                  <span className="font-semibold font-mono text-slate-900">$4.50 USD / diversion</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-medium flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-slate-500" />
                    <span>Objective Function:</span>
                  </span>
                  <span className="font-semibold text-emerald-700">Maximize Net Savings (SLA Avoidance - Cost)</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                <strong>Lead-Time Filter Active:</strong> Only shipments with at least 2.0 hours of lead time before promised delivery are eligible for routing diversion.
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={optimizeFleet}
                disabled={optimizing}
                className="button accent w-full h-11"
              >
                {optimizing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Solving ILP Assignment...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Trigger Batch Fleet Optimization</span>
                  </>
                )}
              </button>
            </div>

            {optimizationError && (
              <div className="notice error mt-4">
                <AlertTriangle size={16} />
                <span>{optimizationError}</span>
              </div>
            )}

            {optimization && (
              <div className="notice success mt-4 flex-col items-start gap-1 animate-scale-in">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Fleet Optimization Finished</span>
                </div>
                <p className="text-xs text-emerald-900 mt-1">
                  Assigned <strong>{optimization.total_allocated ?? 0} smart locker diversions</strong>, protecting an estimated <strong>${Number(optimization.total_net_dollars_saved ?? 0).toFixed(0)} net SLA value</strong> across the network.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
