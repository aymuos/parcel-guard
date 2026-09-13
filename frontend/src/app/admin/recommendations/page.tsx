"use client";
import { FormEvent, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { api, FleetOptimizationResponse, StressTestResponse } from "@/lib/api";

export default function RecommendationsPage() {
	const [weatherSpike, setWeatherSpike] = useState("0.8");
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
			setResult(await api.runStressTest(Number(weatherSpike), region));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to run network simulation");
		} finally {
			setRunning(false);
		}
	};

	const optimizeFleet = async () => {
		setOptimizing(true); setOptimizationError("");
		try { setOptimization(await api.optimizeFleet()); }
		catch (err) { setOptimizationError(err instanceof Error ? err.message : "Unable to optimize fleet"); }
		finally { setOptimizing(false); }
	};

	return <AppShell><div className="content"><PageHeader eyebrow="Action center" title="Recommendations" description="Turn model insight into controlled interventions." /><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Simulation control</p><h2>Stress-test the network</h2></div><span className="live-label"><i />Live engine</span></div><p className="page-description">Apply a regional weather spike to the live parcel state and trigger fleet re-optimization.</p><form className="filter-row" onSubmit={runStressTest}><label>Region<select className="select-control" value={region} onChange={event => setRegion(event.target.value)}><option value="SOUTH">South</option><option value="NORTH">North</option><option value="EAST">East</option><option value="WEST">West</option><option value="ALL">All regions</option></select></label><label>Weather spike<select className="select-control" value={weatherSpike} onChange={event => setWeatherSpike(event.target.value)}><option value="0.3">Low · 0.3</option><option value="0.5">Moderate · 0.5</option><option value="0.8">High · 0.8</option><option value="1">Severe · 1.0</option></select></label><button className="button primary" type="submit" disabled={running}>{running ? "Running..." : "Run simulation"}</button></form>{error && <div className="notice error">{error}</div>}{result && <div className="notice"><strong>Simulation completed.</strong> {result.affected_parcels_count.toLocaleString()} parcels in {result.affected_region} were affected and the fleet was re-optimized.</div>}</div><div className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><div><p className="eyebrow">Fleet optimizer</p><h2>Allocate locker capacity</h2></div><button className="button secondary" onClick={optimizeFleet} disabled={optimizing}>{optimizing ? "Optimizing..." : "Optimize now"}</button></div><p className="page-description">Use the backend optimizer to assign interventions across the current at-risk fleet.</p>{optimizationError && <div className="notice error">{optimizationError}</div>}{optimization && <div className="notice"><strong>Optimization completed.</strong> {optimization.total_allocated ?? 0} interventions allocated; {optimization.total_net_dollars_saved != null ? `$${Number(optimization.total_net_dollars_saved).toFixed(0)} net value protected.` : "see the allocation response for details."}</div>}</div></div></AppShell>;
}
