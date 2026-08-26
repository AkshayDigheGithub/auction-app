"use client";

import { useState, type ReactNode } from "react";
import { API_BASE_URL } from "@/lib/api";
import { ghostButtonClass, inputClass } from "@/components/ui";

/** A labelled figure. The workhorse of the dashboard. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "orange" | "green" | "amber";
}) {
  const toneClass = {
    neutral: "text-neutral-900 dark:text-neutral-50",
    orange: "text-orange-700 dark:text-orange-300",
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
  }[tone];

  return (
    <div className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mt-2">
      <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{children}</h2>
      {hint && <p className="text-xs text-neutral-400 dark:text-neutral-500">{hint}</p>}
    </div>
  );
}

/** Horizontal scroll container — wide tables must never scroll the page body. */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-${align} text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
  title,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  /** Tooltip for cells whose content is truncated. */
  title?: string;
}) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 text-${align} ${className}`} title={title}>
      {children}
    </td>
  );
}

export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <TableScroll>
      <table className="w-full min-w-max text-sm">
        <thead className="border-b border-neutral-200 dark:border-neutral-800">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">{children}</tbody>
      </table>
    </TableScroll>
  );
}

export function Pager({
  skip,
  take,
  total,
  onChange,
}: {
  skip: number;
  take: number;
  total: number;
  onChange: (skip: number) => void;
}) {
  if (total <= take) return null;
  const from = skip + 1;
  const to = Math.min(skip + take, total);
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-sm text-neutral-500 dark:text-neutral-400">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <button className={ghostButtonClass} disabled={skip === 0} onClick={() => onChange(Math.max(skip - take, 0))}>
          Previous
        </button>
        <button className={ghostButtonClass} disabled={to >= total} onClick={() => onChange(skip + take)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className={inputClass}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      type="search"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * CSV export.
 *
 * Fetched with the token in the Authorization header and turned into a blob,
 * rather than opening a URL with the token in the query string — a JWT in a URL
 * ends up in browser history, server logs and any referrer header.
 */
export function ExportButton({ resource, params = {} }: { resource: string; params?: Record<string, string> }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const token = (() => {
        try {
          return (JSON.parse(localStorage.getItem("auth") ?? "{}") as { token?: string }).token ?? "";
        } catch {
          return "";
        }
      })();
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE_URL}/admin/export/${resource}${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const blob = new Blob([await res.text()], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={ghostButtonClass} onClick={download} type="button" disabled={busy}>
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}
