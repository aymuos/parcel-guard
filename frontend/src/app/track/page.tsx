"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SAMPLE_TRACKING_ID } from "@/lib/api";
import {
  Search,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Truck,
  MapPin,
  CheckCircle2,
  Lock,
  Layers,
  ChevronRight
} from "lucide-react";

const popularSamples = [
  { id: SAMPLE_TRACKING_ID, tag: "Express In-Transit" },
  { id: "DC-77203", tag: "Locker Diversion" },
  { id: "DC-77204", tag: "Weather Re-routed" },
];

export default function TrackPage() {
  const router = useRouter();
  const [trackingId, setTrackingId] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = trackingId.trim() || SAMPLE_TRACKING_ID;
    router.push(`/track/${encodeURIComponent(id)}`);
  };

  const handleSampleClick = (id: string) => {
    router.push(`/track/${encodeURIComponent(id)}`);
  };

  return (
    <AppShell customer>
      <main className="track-wrap animate-fade-in">
        {/* Intro Hero */}
        <div className="track-intro">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/80 border border-sky-200/80 text-sky-800 text-xs font-semibold mb-4 shadow-sm">
            <ShieldCheck size={14} className="text-sky-600" />
            <span>Parcel Promise Guard · Predictive Delivery Assurance</span>
          </div>

          <h1>Track your shipment with absolute certainty.</h1>
          <p>
            Experience continuous delivery monitoring backed by predictive intelligence. When delays threaten your promise, we resolve them proactively.
          </p>
        </div>

        {/* Search Container */}
        <div className="track-form-container">
          <form className="track-form" onSubmit={submit}>
            <Search size={20} className="text-slate-400 ml-2 flex-none" />
            <input
              aria-label="Tracking ID"
              placeholder="Enter your parcel tracking ID (e.g., DC-77202)..."
              value={trackingId}
              onChange={(event) => setTrackingId(event.target.value)}
            />
            <button type="submit">
              <span>Track Shipment</span>
              <ArrowRight size={15} />
            </button>
          </form>

          {/* Quick Demo Samples */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-400">Try live demo parcel:</span>
            {popularSamples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSampleClick(sample.id)}
                className="demo-pill"
              >
                <span>{sample.id}</span>
                <span className="text-[10px] text-sky-700/80 font-normal">({sample.tag})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3 Core Value Pillars */}
        <div className="track-features">
          <div className="feature group">
            <div className="feature-mark group-hover:scale-110 transition-transform">
              <Clock size={22} />
            </div>
            <b>Know the Moment</b>
            <span>
              Real-time ETA windows powered by high-precision quantile machine learning that adapt to transit reality.
            </span>
          </div>

          <div className="feature group">
            <div className="feature-mark group-hover:scale-110 transition-transform">
              <Sparkles size={22} />
            </div>
            <b>Understand the Why</b>
            <span>
              Clear, transparent explanations when weather, traffic, or transit congestion threaten your delivery promise.
            </span>
          </div>

          <div className="feature group">
            <div className="feature-mark group-hover:scale-110 transition-transform">
              <Lock size={22} />
            </div>
            <b>Choose What Happens Next</b>
            <span>
              Instant 1-click rerouting to secure 24/7 neighborhood smart lockers to avoid courier delay cutoffs.
            </span>
          </div>
        </div>

        {/* Live Reassurance Banner */}
        <div className="mt-14 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/80 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center flex-none">
              <ShieldCheck size={26} />
            </div>
            <div>
              <strong className="text-base font-display font-bold block text-white">
                The Parcel Promise Protection Guarantee
              </strong>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                If network congestion puts your promised delivery at risk, our intelligence engine reserves an automated smart locker bay in advance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSampleClick(SAMPLE_TRACKING_ID)}
            className="button primary text-xs py-2 px-4 whitespace-nowrap flex-none"
          >
            <span>Preview Live Tracking Demo</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </main>
    </AppShell>
  );
}
