"use client";

import { useEffect, useRef } from "react";
import { useDemoData } from "./DataProvider";
import DataBadge from "./DataBadge";
import type { View } from "./ViewShell";

/** P3-01: two rows max on phones — row 1 wordmark + data badge, row 2 a
 *  horizontally scrollable nav (no wrap, snap). The active tab is scrolled
 *  into view; every target is ≥ 44px (P3-07). */
export default function SiteNav({ view, onNav }: { view: View; onNav: (v: View) => void }) {
  const { watchlist } = useDemoData();
  const navRef = useRef<HTMLElement>(null);
  const LINKS: { id: View; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "detect", label: "Detect" },
    { id: "verify", label: `Verify${watchlist.length > 0 ? ` (${watchlist.length})` : ""}` },
  ];
  // Keep the active tab in view inside the scroller (container-only scroll).
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector("[data-active='true']");
    if (nav && active) {
      const target = (active as HTMLElement).offsetLeft - 16;
      if (target < nav.scrollLeft || target > nav.scrollLeft + nav.clientWidth - 120) {
        nav.scrollLeft = Math.max(0, target);
      }
    }
  }, [view]);

  return (
    <header className="border-b border-white/10 bg-[#0a0f18]/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNav("home")}
            className="flex min-h-[44px] items-center text-lg font-bold text-slate-100"
          >
            Analytica <span className="font-mono text-xs font-normal uppercase tracking-[0.2em] text-cyan-400">· ops</span>
          </button>
          <div className="ml-auto">
            <DataBadge />
          </div>
        </div>
        <nav
          ref={navRef}
          aria-label="Primary"
          className="mt-1 flex snap-x items-center gap-1 overflow-x-auto pb-1"
        >
          {LINKS.map((l) => (
            <button
              key={l.label}
              data-active={view === l.id}
              onClick={() => onNav(l.id)}
              aria-current={view === l.id ? "page" : undefined}
              className={`flex min-h-[44px] flex-none snap-start items-center rounded-md px-3 py-1.5 font-mono text-[13px] font-medium ${
                view === l.id ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {l.label}
            </button>
          ))}
          <span className="hidden flex-none px-2 py-1.5 font-mono text-xs text-slate-400 xl:inline">
            isolate → diagnose → decide happen inside a case
          </span>
          <button
            onClick={() => onNav("upload")}
            data-active={view === "upload"}
            aria-current={view === "upload" ? "page" : undefined}
            className={`flex min-h-[44px] flex-none snap-start items-center rounded-md px-3 py-1.5 font-mono text-[13px] font-medium ${
              view === "upload"
                ? "bg-emerald-400 text-slate-950"
                : "text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-400/10"
            }`}
          >
            ↑ Load your CSVs
          </button>
        </nav>
      </div>
    </header>
  );
}
