"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. The demo is presented live, so a render error
 * must never white-screen it: we show a calm, on-brand recovery panel with a
 * "Try again" (React resets the boundary) and a hard reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the failure visible in the console for whoever is debugging.
    console.error("Analytica view error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">
        Something broke
      </p>
      <h1 className="mb-2 mt-2 text-2xl font-bold text-slate-50">
        This view hit an error
      </h1>
      <p className="mb-6 max-w-md text-slate-400">
        The demo state is intact — nothing was lost. Retry the view, or reload
        the page to start from a clean slate.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-cyan-400 px-5 py-2.5 font-mono text-sm font-bold text-slate-950 hover:bg-cyan-300 min-h-[44px]"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-white/15 px-5 py-2.5 font-mono text-sm text-slate-200 hover:bg-white/5 min-h-[44px]"
        >
          Reload page
        </button>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-xs text-slate-500">ref: {error.digest}</p>
      )}
    </div>
  );
}
