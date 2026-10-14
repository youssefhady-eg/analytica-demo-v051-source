"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DemoData } from "@/lib/types";
import { sampleData } from "@/lib/data";
import { getCase, isWorsened, worseningMetric, type WorseningSnapshot } from "@/lib/cases";

/** Phase 2 §7.2 — what the marketer decided about a case. In-memory only
 *  (like the watchlist): lost on reload, reset on dataset change except the
 *  same-brand re-upload rule (D3). `at` is Date.now() for ordering, never shown. */
export type DismissReason = "already-handled" | "not-now" | "disagree";
export type Disposition =
  | { kind: "resolved"; at: number; reason: "already-handled" }
  | {
      kind: "snoozed";
      at: number;
      reason: "not-now";
      snapshot: WorseningSnapshot;
      resurfaced?: boolean;
    }
  | { kind: "override"; at: number; reason: "disagree"; snapshot: WorseningSnapshot };

interface DataCtx {
  data: DemoData;
  /** Load merchant-CSV data (from the uploader). */
  setCsvData: (d: DemoData) => void;
  /** Back to the synthetic sample. */
  resetSample: () => void;
  /** Case IDs the marketer decided on — the Verify watchlist. */
  watchlist: string[];
  watch: (caseId: string) => void;
  unwatch: (caseId: string) => void;
  /** Phase 2 dismiss-reason flow. */
  dispositions: Record<string, Disposition>;
  dismiss: (caseId: string, reason: DismissReason) => void;
  undoDisposition: (caseId: string) => void;
  /** Demo-only worsening overlay (§7.3) — multiplies the tracked metric. */
  simulateWorsening: (caseId: string) => void;
  /** Phase 4 presenter reset — clears watchlist, dispositions and overlay. */
  clearDecisions: () => void;
}

const Ctx = createContext<DataCtx>({
  data: sampleData,
  setCsvData: () => {},
  resetSample: () => {},
  watchlist: [],
  watch: () => {},
  unwatch: () => {},
  dispositions: {},
  dismiss: () => {},
  undoDisposition: () => {},
  simulateWorsening: () => {},
  clearDecisions: () => {},
});

/** Synthetic overlay factor that pushes the tracked metric past the 2%
 *  tolerance: POAS lower = worse, everything else higher = worse. */
function worsenFactor(kind: string): number {
  return kind === "money-offender" ? 0.9 : 1.1;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [csvData, setCsvDataState] = useState<DemoData | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [simulated, setSimulated] = useState<Record<string, number>>({});

  const data = csvData ?? sampleData;

  const setCsvData = useCallback(
    (d: DemoData) => {
      // D3: a newer CSV for the SAME brand keeps dispositions (snoozes get
      // re-evaluated against fresh numbers below). New brand → fresh slate.
      const sameBrand = csvData !== null && csvData.brand.name === d.brand.name;
      setCsvDataState(d);
      setWatchlist([]);
      setSimulated({});
      if (!sameBrand) {
        setDispositions({});
        return;
      }
      setDispositions((prev) => {
        let changed = false;
        const next: Record<string, Disposition> = {};
        for (const [id, disp] of Object.entries(prev)) {
          const c = getCase(d, id);
          if (!c) {
            changed = true; // vanished id → dropped silently (§7.8)
            continue;
          }
          if (disp.kind === "snoozed" && !disp.resurfaced) {
            if (isWorsened(disp.snapshot, worseningMetric(c, d))) {
              next[id] = { ...disp, resurfaced: true };
              changed = true;
              continue;
            }
          }
          next[id] = disp;
        }
        return changed ? next : prev;
      });
    },
    [csvData]
  );
  const resetSample = useCallback(() => {
    setCsvDataState(null);
    setWatchlist([]);
    setDispositions({});
    setSimulated({});
  }, []);
  const watch = useCallback(
    (caseId: string) => setWatchlist((w) => (w.includes(caseId) ? w : [...w, caseId])),
    []
  );
  const unwatch = useCallback(
    (caseId: string) => setWatchlist((w) => w.filter((x) => x !== caseId)),
    []
  );

  const dismiss = useCallback(
    (caseId: string, reason: DismissReason) => {
      const c = getCase(data, caseId);
      if (!c) return;
      const at = Date.now();
      if (reason === "already-handled") {
        setDispositions((prev) => ({ ...prev, [caseId]: { kind: "resolved", at, reason } }));
        return;
      }
      const snapshot: WorseningSnapshot = { kind: c.kind, value: worseningMetric(c, data) };
      if (reason === "not-now") {
        setDispositions((prev) => ({
          ...prev,
          [caseId]: { kind: "snoozed", at, reason, snapshot },
        }));
      } else {
        setDispositions((prev) => ({
          ...prev,
          [caseId]: { kind: "override", at, reason, snapshot },
        }));
      }
    },
    [data]
  );

  const undoDisposition = useCallback((caseId: string) => {
    setDispositions((prev) => {
      if (!(caseId in prev)) return prev;
      const next = { ...prev };
      delete next[caseId];
      return next;
    });
  }, []);

  const clearDecisions = useCallback(() => {
    setWatchlist([]);
    setDispositions({});
    setSimulated({});
  }, []);

  const simulateWorsening = useCallback(
    (caseId: string) => {
      const c = getCase(data, caseId);
      if (!c) return;
      const next = (simulated[caseId] ?? 1) * worsenFactor(c.kind);
      setSimulated((s) => ({ ...s, [caseId]: next }));
      setDispositions((prev) => {
        const disp = prev[caseId];
        if (!disp || disp.kind !== "snoozed" || disp.resurfaced) return prev;
        if (!isWorsened(disp.snapshot, worseningMetric(c, data, next))) return prev;
        return { ...prev, [caseId]: { ...disp, resurfaced: true } };
      });
    },
    [data, simulated]
  );

  const value = useMemo<DataCtx>(
    () => ({
      data,
      setCsvData,
      resetSample,
      watchlist,
      watch,
      unwatch,
      dispositions,
      dismiss,
      undoDisposition,
      simulateWorsening,
      clearDecisions,
    }),
    [
      data,
      setCsvData,
      resetSample,
      watchlist,
      watch,
      unwatch,
      dispositions,
      dismiss,
      undoDisposition,
      simulateWorsening,
      clearDecisions,
    ]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Frames read everything through this hook — static sample by default,
 *  merchant CSV data after an upload. */
export function useDemoData(): DataCtx {
  return useContext(Ctx);
}
