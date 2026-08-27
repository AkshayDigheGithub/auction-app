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
    <div className="rounded-xl border border-neutral-200 px-3 py-3 sm:px-4 dark:border-neutral-800">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400 sm:text-xs dark:text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${toneClass}`}>{value}</p>
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

/** Filter bar — wraps instead of forcing a fixed column count at every width. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-48">{children}</div>;
}

// ---------------------------------------------------------------- record list

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
  /**
   * How the column behaves in the mobile card:
   *   title    — the card heading
   *   trailing — right-aligned beside the heading (amounts, status)
   *   meta     — small unlabelled line under the heading
   *   row      — a labelled line (default)
   *   hidden   — omitted on mobile
   */
  mobile?: "title" | "trailing" | "meta" | "row" | "hidden";
}

/**
 * One column definition, two layouts.
 *
 * A table forced through a 375px screen becomes a horizontal-scroll puzzle, so
 * below `md` each row is rendered as a card instead. Defining both from the same
 * columns keeps them from drifting apart, which is what usually goes wrong with
 * a separate mobile view.
 */
export function RecordList<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string;
}) {
  const title = columns.find((c) => c.mobile === "title") ?? columns[0];
  const trailing = columns.filter((c) => c.mobile === "trailing");
  const meta = columns.filter((c) => c.mobile === "meta");
  const detail = columns.filter(
    (c) => c !== title && !["trailing", "meta", "hidden", "title"].includes(c.mobile ?? "row"),
  );

  return (
    <>
      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 dark:border-neutral-800">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500 ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {rows.map((row) => (
              <tr key={rowKey(row)} className={rowClassName?.(row) ?? ""}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 align-top ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={`rounded-xl border border-neutral-200 px-3 py-3 dark:border-neutral-800 ${rowClassName?.(row) ?? ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {title.cell(row)}
              </div>
              {trailing.length > 0 && (
                <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                  {trailing.map((c) => (
                    <div key={c.key}>{c.cell(row)}</div>
                  ))}
                </div>
              )}
            </div>

            {meta.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-neutral-400 dark:text-neutral-500">
                {meta.map((c) => (
                  <span key={c.key}>{c.cell(row)}</span>
                ))}
              </div>
            )}

            {detail.length > 0 && (
              <dl className="mt-2 flex flex-col gap-1 text-xs">
                {detail.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-neutral-400 dark:text-neutral-500">{c.header}</dt>
                    <dd className="min-w-0 text-right text-neutral-700 dark:text-neutral-300">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ------------------------------------------------------------- simple table
// For small tables (2–3 columns) that fit on a phone without help.

export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 dark:border-neutral-800">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
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
  title?: string;
}) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`} title={title}>
      {children}
    </td>
  );
}

// ------------------------------------------------------------------ controls

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
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-neutral-500 dark:text-neutral-400">
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
    <button className={`${ghostButtonClass} whitespace-nowrap`} onClick={download} type="button" disabled={busy}>
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}
