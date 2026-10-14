"use client";

import { useEffect, useRef, useState } from "react";
import { useAnalyst } from "./AnalystProvider";

/** Floating Level-2 toggle. Deterministic rules are the default; flipping this
 *  on routes diagnosis text through a live model (bring your own key).
 *  P1-08: the FAB always opens the Analyst dialog (never toggles directly);
 *  the dialog carries the on/off switch, key/endpoint/model fields and
 *  Disconnect — with dialog semantics (Esc, backdrop, focus in/restore). */
export default function AiToggle({ lift }: { lift?: boolean }) {
  const { enabled, setEnabled, apiKey, setApiKey, endpoint, setEndpoint, model, setModel } =
    useAnalyst();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [needKey, setNeedKey] = useState(false);
  const keyRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setDraft("");
    setNeedKey(false);
  };

  // P1-08: Esc closes; focus moves into the dialog and is restored on close.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    keyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => {
          setDraft("");
          setNeedKey(false);
          setOpen(true);
        }}
        title="Analyst settings — rules narration by default, live mode with your key"
        aria-label="Analyst settings"
        aria-pressed={enabled}
        // P3-04: on case screens below md the sticky action bar owns the
        // bottom edge — the FAB docks above it so it never covers a CTA.
        className={`fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-lg ring-1 transition ${
          lift ? "bottom-24 md:bottom-4" : "bottom-4"
        } ${
          enabled
            ? "bg-cyan-400 text-slate-950 ring-cyan-300"
            : "bg-white/10 text-slate-300 ring-white/20 hover:bg-white/15"
        }`}
      >
        ✨
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="analyst-dialog-title"
            className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d1420] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="analyst-dialog-title" className="mb-1 text-lg font-bold text-slate-100">
              Live Analyst
            </h2>
            <p className="mb-4 text-sm text-slate-400">
              {apiKey
                ? "Key set — it lives in this page's memory only, never saved or baked into the demo. Only already-computed metrics are sent, never raw customer data."
                : "Rules narration is active. Paste a key for an OpenAI-compatible chat API to hear steps re-verbalized live — the key lives in this page's memory only."}
            </p>

            <label className="mb-3 flex min-h-[44px] cursor-pointer items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
              <span className="font-mono text-sm font-medium text-slate-200">Live narration</span>
              <input
                type="checkbox"
                role="switch"
                aria-label="Live narration"
                checked={enabled}
                onChange={(e) => {
                  if (e.target.checked && !apiKey && !draft.trim()) {
                    setNeedKey(true);
                    keyRef.current?.focus();
                    return;
                  }
                  setEnabled(e.target.checked);
                }}
                className="h-5 w-5 accent-cyan-400"
              />
            </label>
            {needKey && !apiKey && (
              <p className="mb-3 font-mono text-xs text-amber-300">
                Paste your API key below first, then flip the switch.
              </p>
            )}

            <label className="mb-1 block font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
              API key
            </label>
            <input
              ref={keyRef}
              type="password"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setNeedKey(false);
              }}
              placeholder={apiKey ? "•••••••• (key set)" : "sk-…"}
              className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-slate-200 placeholder:text-slate-400"
            />
            <label className="mb-1 block font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
              Endpoint
            </label>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-slate-200 placeholder:text-slate-400"
            />
            <label className="mb-1 block font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
              Model
            </label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mb-4 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-slate-300"
            />
            <div className="flex flex-wrap justify-end gap-2">
              {apiKey && (
                <button
                  onClick={() => {
                    setApiKey("");
                    setEnabled(false);
                    setDraft("");
                  }}
                  className="rounded-md border border-rose-500/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10 min-h-[44px]"
                >
                  Disconnect (clear key)
                </button>
              )}
              <button
                onClick={close}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setApiKey(draft.trim());
                  setDraft("");
                  setNeedKey(false);
                  close();
                  setEnabled(true);
                }}
                disabled={!draft.trim()}
                className="rounded-md bg-cyan-400 px-4 py-2 font-mono text-sm font-bold text-slate-950 disabled:opacity-40 min-h-[44px]"
              >
                Connect & enable
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
