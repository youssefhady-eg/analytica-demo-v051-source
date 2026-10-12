"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDemoData } from "./DataProvider";
import type { View } from "./ViewShell";
import {
  resolveTopCase,
  tourContext,
  trackSteps,
  TOP_CASE,
  type TourContext,
  type TourStep,
  type Track,
} from "@/lib/tour";

interface TourCtxValue {
  active: boolean;
  track: Track | null;
  index: number;
  steps: TourStep[];
  /** Current step with TOP_CASE resolved (case view falls back to detect). */
  step: TourStep | null;
  ctx: TourContext;
  cleanView: boolean;
  setCleanView: (v: boolean) => void;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  start: (t: Track) => void;
  exit: () => void;
  next: () => void;
  back: () => void;
  /** The Detect log is forced open while true (current step asks for it). */
  expandLog: boolean;
  /** Demo-only controls hide while true (Clean view, unless step needs them). */
  hideDemoControls: boolean;
  /** Full reset: watchlist + dispositions + tour. */
  resetDemo: () => void;
}

const TourCtx = createContext<TourCtxValue>({
  active: false,
  track: null,
  index: 0,
  steps: [],
  step: null,
  ctx: { roas: "", poas: "", over: "", waitingCount: 0, topTitle: "", topImpact: "" },
  cleanView: false,
  setCleanView: () => {},
  pickerOpen: false,
  setPickerOpen: () => {},
  start: () => {},
  exit: () => {},
  next: () => {},
  back: () => {},
  expandLog: false,
  hideDemoControls: false,
  resetDemo: () => {},
});

export function useTour(): TourCtxValue {
  return useContext(TourCtx);
}

function resolveView(view: View, topId: string | null): View {
  if (typeof view !== "string" && view.case === TOP_CASE) {
    return topId ? { case: topId } : "detect";
  }
  return view;
}

/**
 * Phase 4 — guided presenter mode. Wraps the nav + views inside the data
 * providers (needs watch/dismiss) and receives Shell's `go` to drive the
 * real app: view navigation, case stages (ViewCase follows context), layer
 * reveals, log pre-expansion and explicit demo actions. Everything is
 * in-memory; normal (non-tour) behavior is untouched.
 */
export function TourProvider({
  go,
  children,
}: {
  go: (v: View) => void;
  children: ReactNode;
}) {
  const { data, watchlist, dispositions, watch, dismiss, clearDecisions } = useDemoData();
  const [track, setTrack] = useState<Track | null>(null);
  const [index, setIndex] = useState(0);
  const [cleanView, setCleanView] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Shell's go is a new identity every render — effects use the ref.
  const goRef = useRef(go);
  goRef.current = go;

  const active = track !== null;
  const steps = useMemo(() => (track ? trackSteps(track) : []), [track]);
  const ctx = useMemo(
    () => tourContext(data, watchlist, dispositions),
    [data, watchlist, dispositions]
  );

  // Drive the app on arrival: demo action first (against pre-arrival state),
  // then navigation. All actions are idempotent — Back/Next revisits are safe.
  useEffect(() => {
    if (!track) return;
    const arriving = trackSteps(track)[index];
    if (!arriving) return;
    const topId = resolveTopCase(data, watchlist, dispositions);
    if (arriving.demoAction === "approve-top") {
      if (topId) watch(topId);
    } else if (arriving.demoAction === "snooze-top") {
      if (topId) dismiss(topId, "not-now");
    } else if (arriving.demoAction === "disagree-top") {
      if (topId) dismiss(topId, "disagree");
    } else if (arriving.demoAction === "reset") {
      clearDecisions();
    }
    goRef.current(resolveView(arriving.view, topId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, index]);

  const step: TourStep | null = useMemo(() => {
    if (!track) return null;
    const raw = steps[index];
    if (!raw) return null;
    if (typeof raw.view !== "string" && raw.view.case === TOP_CASE) {
      const topId = resolveTopCase(data, watchlist, dispositions);
      return { ...raw, view: resolveView(raw.view, topId) };
    }
    return raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, index, data, watchlist, dispositions]);

  // Spotlight: ring the target without touching layout; missing targets are
  // fine (caption still shows). Respects reduced motion (no smooth scroll).
  useEffect(() => {
    document.querySelectorAll(".tour-spotlight").forEach((el) => el.classList.remove("tour-spotlight"));
    if (!track || !step?.target) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let tries = 0;
    const paint = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        el.classList.add("tour-spotlight");
        el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      } else if (tries < 3) {
        tries += 1;
        window.setTimeout(paint, 350);
      }
    };
    paint();
    return () => {
      cancelled = true;
    };
  }, [track, index, step]);

  const start = useCallback((t: Track) => {
    setTrack(t);
    setIndex(0);
    setCleanView(false);
    setPickerOpen(false);
  }, []);
  const exit = useCallback(() => {
    setTrack(null);
    setIndex(0);
    document.querySelectorAll(".tour-spotlight").forEach((el) => el.classList.remove("tour-spotlight"));
  }, []);
  const next = useCallback(() => {
    setIndex((i) => {
      const n = trackSteps(track as Track).length;
      return i < n - 1 ? i + 1 : i;
    });
  }, [track ]);
  const back = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);
  const resetDemo = useCallback(() => {
    clearDecisions();
    exit();
  }, [clearDecisions, exit]);

  // Keyboard: → / ← step, Esc exits (or closes the picker). Ignored while
  // typing (the Upload step has real inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (pickerOpen) {
        if (e.key === "Escape") setPickerOpen(false);
        return;
      }
      if (!track) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Escape") exit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickerOpen, track, next, back, exit]);

  const value = useMemo<TourCtxValue>(
    () => ({
      active,
      track,
      index,
      steps,
      step,
      ctx,
      cleanView,
      setCleanView,
      pickerOpen,
      setPickerOpen,
      start,
      exit,
      next,
      back,
      expandLog: active && step?.expandLog === true,
      hideDemoControls: active && cleanView,
      resetDemo,
    }),
    [active, track, index, steps, step, ctx, cleanView, pickerOpen, start, exit, next, back, resetDemo]
  );

  return (
    <TourCtx.Provider value={value}>
      {children}
      {pickerOpen && <TrackPicker />}
      {active && step && <CoachPanel />}
    </TourCtx.Provider>
  );
}

function TrackPicker() {
  const { setPickerOpen, start } = useTour();
  const close = () => setPickerOpen(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-picker-title"
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d1420] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="tour-picker-title" className="mb-1 text-lg font-bold text-slate-100">
          Present
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          A scripted walkthrough that drives the real app — no fake data. Pick your audience.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => start("vondera")}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-4 py-2 text-left ring-1 ring-white/10 hover:bg-white/[0.06]"
          >
            <span>
              <span className="block font-semibold text-slate-100">Vondera track</span>
              <span className="block text-sm text-slate-400">Ecosystem, product thesis, honesty · ~6 min</span>
            </span>
            <span className="font-mono text-cyan-300">→</span>
          </button>
          <button
            onClick={() => start("marketer")}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-4 py-2 text-left ring-1 ring-white/10 hover:bg-white/[0.06]"
          >
            <span>
              <span className="block font-semibold text-slate-100">Marketer track</span>
              <span className="block text-sm text-slate-400">Workflow, investigation, your own data · ~6 min</span>
            </span>
            <span className="font-mono text-cyan-300">→</span>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={close}
            className="flex min-h-[44px] items-center rounded-md border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CoachPanel() {
  const { track, index, steps, step, ctx, cleanView, setCleanView, next, back, exit, resetDemo } =
    useTour();
  if (!step) return null;
  const last = index >= steps.length - 1;
  return (
    <div
      role="region"
      aria-label="Presenter coach"
      className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:top-24 sm:bottom-auto sm:w-96"
    >
      <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-cyan-400/25 bg-[#0d1420]/95 p-5 shadow-2xl backdrop-blur sm:max-h-none">
        <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Presenting · {track} track
        </p>
        <h2 className="text-lg font-bold text-slate-50">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-200">{step.caption(ctx)}</p>
        <p className="mt-2 font-mono text-xs text-slate-400">
          Step {index + 1} of {steps.length}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={back}
            disabled={index === 0}
            className="flex min-h-[44px] items-center rounded-md border border-white/15 px-4 py-2 font-mono text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40"
          >
            Back
          </button>
          {!last ? (
            <button
              onClick={next}
              className="flex min-h-[44px] items-center rounded-md bg-cyan-400 px-4 py-2 font-mono text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Next
            </button>
          ) : null}
          <button
            onClick={exit}
            className="flex min-h-[44px] items-center rounded-md px-4 py-2 font-mono text-sm text-slate-400 hover:text-slate-200"
          >
            Exit
          </button>
        </div>
        {!cleanView && (
          <details className="mt-3 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
            <summary className="cursor-pointer font-mono text-xs font-medium text-slate-300">
              Notes
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.notes}</p>
          </details>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 font-mono text-xs text-slate-300">
            <input
              type="checkbox"
              checked={cleanView}
              onChange={(e) => setCleanView(e.target.checked)}
              className="h-5 w-5 accent-cyan-400"
            />
            Clean view
          </label>
          <button
            onClick={resetDemo}
            className="flex min-h-[44px] items-center font-mono text-xs text-slate-400 hover:text-rose-300"
            title="Clear the watchlist, dispositions and the tour"
          >
            Reset demo state
          </button>
        </div>
      </div>
    </div>
  );
}
