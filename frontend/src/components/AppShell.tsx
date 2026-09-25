"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Boxes,
  LayoutDashboard,
  Menu,
  Route,
  ShieldCheck,
  Sparkles,
  X,
  Activity,
  Cpu,
  ArrowRight,
  ExternalLink,
  ChevronRight
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/admin", Icon: LayoutDashboard, badge: null },
  { label: "At-Risk Parcels", href: "/admin/at-risk", Icon: AlertTriangle, badge: "Live" },
  { label: "Terminal Hubs", href: "/admin/terminals", Icon: Boxes, badge: null },
  { label: "Recommendations", href: "/admin/recommendations", Icon: Sparkles, badge: "AI" },
];

export function Brand() {
  return (
    <Link href="/admin" className="brand">
      <span className="brand-mark">
        <ShieldCheck size={20} strokeWidth={2.4} />
      </span>
      <div>
        <strong>Parcel Promise</strong>
        <small>
          GUARD <span className="bg-sky-400/20 text-sky-300 px-1 py-0.2 rounded text-[8px] border border-sky-400/30">v2.1</span>
        </small>
      </div>
    </Link>
  );
}

export function AppShell({
  children,
  customer = false,
}: {
  children: React.ReactNode;
  customer?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (customer) {
    return (
      <div className="customer-shell">
        <header className="customer-header">
          <Link href="/track" className="brand">
            <span className="brand-mark">
              <ShieldCheck size={20} strokeWidth={2.4} />
            </span>
            <div>
              <strong className="text-slate-900">Parcel Promise</strong>
              <small className="text-sky-600">
                CUSTOMER PORTAL
              </small>
            </div>
          </Link>

          <nav>
            <Link
              href="/track"
              className={pathname.startsWith("/track") ? "text-sky-600 font-semibold flex items-center gap-1.5" : "flex items-center gap-1.5"}
            >
              <Route size={15} />
              <span>Track Delivery</span>
            </Link>
            <Link
              href="/admin"
              className="text-slate-600 hover:text-sky-600 flex items-center gap-1.5 transition-colors"
            >
              <LayoutDashboard size={15} />
              <span>Operations Portal</span>
              <ExternalLink size={12} className="opacity-60" />
            </Link>
            <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="health-dot" />
              <span>SLA Protected</span>
            </div>
          </nav>
        </header>

        {children}

        <footer className="mt-auto border-t border-slate-200/80 bg-white/60 backdrop-blur-md py-6 text-center text-xs text-slate-500">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="health-dot" />
              <span>Powered by Parcel Guard Continuous Causal Intelligence</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <Link href="/track" className="hover:text-slate-700 transition-colors">Tracking Support</Link>
              <span>•</span>
              <Link href="/admin" className="hover:text-slate-700 transition-colors">Carrier Operations</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="sidebar-top">
          <Brand />
          <button
            className="close-nav"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace-label">
          <span>OPERATIONS DESK</span>
          <span className="text-[9px] bg-white/10 text-cyan-300 px-1.5 py-0.5 rounded font-mono">LIVE</span>
        </div>

        <nav className="side-nav">
          {navItems.map(({ label, href, Icon, badge }) => {
            const active = pathname === href;
            return (
              <Link
                className={active ? "active" : ""}
                href={href}
                key={href}
                onClick={() => setOpen(false)}
              >
                <span className="nav-code">
                  <Icon size={16} />
                </span>
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    badge === "Live"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}

          <Link
            className="customer-nav-link"
            href="/track"
            onClick={() => setOpen(false)}
          >
            <span className="nav-code">
              <Route size={16} />
            </span>
            <span className="flex-1">Customer Tracking</span>
            <ArrowRight size={13} className="opacity-80" />
          </Link>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-2">
                <span className="health-dot" />
                <strong className="text-white font-semibold">Engine Synced</strong>
              </span>
              <span className="text-[10px] font-mono text-cyan-300">18ms</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              CatBoost Quantile + CausalForestDML running continuous lead-time screening.
            </p>
          </div>

          <div className="sidebar-user">
            <span className="avatar">OP</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <strong className="text-xs font-semibold text-white truncate">Ops Director</strong>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <small className="text-[10px] text-slate-400 block truncate">Network Operations HQ</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={16} />
              <span>Menu</span>
            </button>

            <div className="hidden md:flex items-center gap-3">
              <div className="model-pill">
                <Cpu size={13} className="text-cyan-600" />
                <span>Ensemble Quantile Risk Model</span>
              </div>
              <div className="model-pill">
                <Activity size={13} className="text-emerald-600" />
                <span>Causal Remediation v2</span>
              </div>
            </div>
          </div>

          <div className="topbar-right">
            {currentTime && (
              <span className="hidden sm:inline-block font-mono text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                {currentTime} UTC
              </span>
            )}
            <Link
              href="/track"
              className="button secondary text-xs py-1.5 px-3 h-8"
            >
              <Route size={13} />
              <span>Switch to Tracking View</span>
            </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-header animate-fade-in">
      <div>
        <p className="eyebrow flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="header-actions">{children}</div>}
    </div>
  );
}

export function StatusPill({
  status,
  labelOverride,
}: {
  status: "healthy" | "risk" | "critical" | "neutral";
  labelOverride?: string;
}) {
  const labels = {
    healthy: "On track",
    risk: "At risk",
    critical: "Likely to miss",
    neutral: "Unavailable",
  };
  return (
    <span className={`status-pill ${status}`}>
      <i />
      {labelOverride || labels[status]}
    </span>
  );
}
