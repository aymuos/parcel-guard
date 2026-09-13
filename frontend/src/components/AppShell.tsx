"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Boxes, LayoutDashboard, Menu, Route, ShieldCheck, Sparkles, X } from "lucide-react";

const navItems = [
  ["Overview", "/admin", LayoutDashboard],
  ["At-risk parcels", "/admin/at-risk", AlertTriangle],
  ["Terminals", "/admin/terminals", Boxes],
  ["Recommendations", "/admin/recommendations", Sparkles],
];

export function Brand() { return <div className="brand"><span className="brand-mark"><ShieldCheck size={17} /></span><span><strong>Parcel Promise</strong><small>GUARD</small></span></div>; }

export function AppShell({ children, customer = false }: { children: React.ReactNode; customer?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (customer) return <div className="customer-shell"><header className="customer-header"><Brand /><nav><Link href="/track">Track</Link><Link href="/admin">Operations</Link><span className="avatar">JD</span></nav></header>{children}</div>;
  return <div className="app-shell"><aside className={open ? "sidebar open" : "sidebar"}><div className="sidebar-top"><Brand /><button className="close-nav" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} /></button></div><div className="workspace-label">OPERATIONS CONTROL</div><nav className="side-nav">{navItems.map(([label, href, Icon]) => <Link className={pathname === href ? "active" : ""} href={href as string} key={href as string} onClick={() => setOpen(false)}><span className="nav-code">{typeof Icon === "function" && <Icon size={15} />}</span>{label as string}</Link>)}<Link className="customer-nav-link" href="/track" onClick={() => setOpen(false)}><span className="nav-code"><Route size={15} /></span>Customer tracking</Link></nav><div className="sidebar-footer"><div className="health-dot" />Live intelligence engine<div className="sidebar-user"><span className="avatar">JD</span><span><strong>J. Dahl</strong><small>Network operations</small></span></div></div></aside><main className="main-shell"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={16} /> <span>Menu</span></button>{children}</main></div>;
}

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) { return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div><div className="header-actions">{children}</div></div>; }
export function StatusPill({ status }: { status: "healthy" | "risk" | "critical" | "neutral" }) { const labels = { healthy: "On track", risk: "At risk", critical: "Likely to miss", neutral: "Unavailable" }; return <span className={`status-pill ${status}`}><i />{labels[status]}</span>; }
