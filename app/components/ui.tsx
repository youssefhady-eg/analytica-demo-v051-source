"use client";

import type { ReactNode, UIEvent } from "react";

/**
 * Dark ops-room primitives — drop-in replacements for the Tremor components
 * the demo used. Same prop surface, new skin.
 */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] ${className}`}>
      {children}
    </div>
  );
}

export function Metric({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-3xl font-bold tabular-nums text-slate-50 ${className}`}>
      {children}
    </p>
  );
}

export function Text({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm text-slate-400 ${className}`}>{children}</p>;
}

export function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-base font-semibold text-slate-100 ${className}`}>{children}</h3>;
}

export function Table({
  children,
  className = "",
  onScroll,
}: {
  children: ReactNode;
  className?: string;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className="overflow-x-auto" onScroll={onScroll}>
      <table className={`w-full text-left text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={`border-t border-white/5 ${className}`}>{children}</tr>;
}

export function TableHeaderCell({ children }: { children: ReactNode }) {
  return (
    <th className="px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 text-slate-300 ${className}`}>{children}</td>;
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`mr-1 inline-block rounded-full px-2 py-0.5 font-mono text-xs ${className}`}>
      {children}
    </span>
  );
}

/** Small mono eyebrow label, ops-room style. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 ${className}`}
    >
      {children}
    </p>
  );
}
