"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { analystDiagnose, analystNarrate, DEFAULT_ENDPOINT, DEFAULT_MODEL, type LlmOpts } from "@/lib/llm";

interface AnalystCtx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  endpoint: string;
  setEndpoint: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  /** Ask the live Analyst; throws on failure so callers can fall back. */
  ask: (kind: "funnel-leak" | "roas-drop", metrics: Record<string, unknown>) => Promise<string>;
  /** Live narration for a pipeline stage; throws on failure so callers can fall back. */
  narrate: (stage: string, caseTitle: string, metrics: Record<string, unknown>) => Promise<string>;
  busy: boolean;
}

const Ctx = createContext<AnalystCtx | null>(null);

export function AnalystProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [busy, setBusy] = useState(false);

  const ask = useCallback(
    async (kind: "funnel-leak" | "roas-drop", metrics: Record<string, unknown>) => {
      if (!apiKey) throw new Error("No API key set.");
      setBusy(true);
      try {
        return await analystDiagnose(kind, metrics, { apiKey, endpoint, model } satisfies LlmOpts);
      } finally {
        setBusy(false);
      }
    },
    [apiKey, endpoint, model]
  );

  const narrate = useCallback(
    async (stage: string, caseTitle: string, metrics: Record<string, unknown>) => {
      if (!apiKey) throw new Error("No API key set.");
      setBusy(true);
      try {
        return await analystNarrate(stage, caseTitle, metrics, { apiKey, endpoint, model } satisfies LlmOpts);
      } finally {
        setBusy(false);
      }
    },
    [apiKey, endpoint, model]
  );

  const value = useMemo(
    () => ({ enabled, setEnabled, apiKey, setApiKey, endpoint, setEndpoint, model, setModel, ask, narrate, busy }),
    [enabled, apiKey, endpoint, model, ask, narrate, busy]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalyst(): AnalystCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalyst must be used inside AnalystProvider");
  return ctx;
}
