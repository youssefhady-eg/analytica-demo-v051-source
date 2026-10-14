"use client";

import { useState } from "react";
import SiteNav from "@/components/SiteNav";
import AiToggle from "@/components/AiToggle";
import { DataProvider } from "@/components/DataProvider";
import { AnalystProvider } from "@/components/AnalystProvider";
import { TourProvider } from "@/components/TourProvider";
import AskPanel from "@/components/AskPanel";
import ViewHome from "@/components/ViewHome";
import ViewDetect from "@/components/ViewDetect";
import ViewCase from "@/components/ViewCase";
import ViewVerify from "@/components/ViewVerify";
import ViewUpload from "@/components/ViewUpload";
import type { View } from "@/components/ViewShell";

/**
 * Single-page shell. The demo is one double-clickable index.html — no Next.js
 * client-side routing (its RSC fetch is blocked by CORS on file://, which broke
 * navigation). Views switch in memory; all state (CSV data, watchlist, API key)
 * survives because the page never reloads.
 */
export default function Shell() {
  const [view, setView] = useState<View>("home");
  // Phase 5: the Ask drawer is global (no persistence, closes on navigation).
  const [askOpen, setAskOpen] = useState(false);

  const go = (v: View) => {
    setView(v);
    setAskOpen(false);
    window.scrollTo({ top: 0 });
  };

  const navView: View = typeof view === "string" ? view : "detect";

  return (
    <DataProvider>
      <AnalystProvider>
        {/* Phase 4: the tour drives the real app through Shell's `go` — normal
            behavior is unchanged when no tour is active. */}
        <TourProvider go={go} onAskPanel={() => setAskOpen(true)}>
          <SiteNav view={navView} onNav={go} onAsk={() => setAskOpen(true)} />
          <main className="mx-auto max-w-6xl px-4 py-8">
            {view === "home" && <ViewHome onNav={(v) => go(v)} />}
            {view === "detect" && (
              <ViewDetect
                onOpenCase={(id) => go({ case: id })}
                onVerify={() => go("verify")}
                onUpload={() => go("upload")}
              />
            )}
            {view === "upload" && <ViewUpload onDone={() => go("detect")} />}
            {view === "verify" && (
              <ViewVerify onDetect={() => go("detect")} onOpenCase={(id) => go({ case: id })} />
            )}
            {typeof view !== "string" && (
              <ViewCase
                key={view.case}
                caseId={view.case}
                onBack={() => go("detect")}
                onVerify={() => go("verify")}
                onUpload={() => go("upload")}
              />
            )}
          </main>
          <footer className="mx-auto max-w-6xl px-4 pb-28 font-mono text-xs text-slate-400">
            Analytica product sample — figures are fictional in sample mode, computed from your CSVs
            in upload mode.
          </footer>
          <AiToggle lift={typeof view !== "string"} />
          <AskPanel
            open={askOpen}
            onClose={() => setAskOpen(false)}
            onOpenCase={(id) => go({ case: id })}
          />
        </TourProvider>
      </AnalystProvider>
    </DataProvider>
  );
}
