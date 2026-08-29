"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, InfoBanner } from "@/components/ui";
import { Column, ExportButton, FilterBar, Pager, RecordList, Select } from "./shared";

interface AuditRow {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

const TAKE = 25;

const ACTIONS = [
  "wallet.adjust",
  "rate.update",
  "shop.verify",
  "shop.unverify",
  "shop.suspend",
  "shop.unsuspend",
  "shop.categories.update",
  "reversal.approve",
  "reversal.reject",
  "dispute.uphold",
  "dispute.dismiss",
  "product_category.create",
  "product_category.update",
  "product_category.deactivate",
];

export function AuditTab() {
  const [action, setAction] = useState("");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ rows: AuditRow[]; total: number } | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ take: String(TAKE), skip: String(skip), ...(action ? { action } : {}) });
    api
      .get<{ rows: AuditRow[]; total: number }>(`/admin/audit?${qs}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [action, skip]);

  useEffect(load, [load]);

  const columns: Column<AuditRow>[] = [
    {
      key: "action",
      header: "Action",
      mobile: "title",
      cell: (r) => <span className="font-medium text-neutral-900 dark:text-neutral-100">{r.action}</span>,
    },
    {
      key: "when",
      header: "When",
      mobile: "meta",
      cell: (r) => (
        <span className="text-neutral-500 dark:text-neutral-400">
          {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target",
      cell: (r) => (
        <span className="text-neutral-500 dark:text-neutral-400">
          {r.targetType}:{r.targetId.slice(0, 10)}
        </span>
      ),
    },
    {
      key: "change",
      header: "Change",
      cell: (r) => (
        <span className="line-clamp-2 max-w-md text-xs text-neutral-500 dark:text-neutral-400">
          {summarise(r.before, r.after)}
        </span>
      ),
    },
    {
      key: "admin",
      header: "Admin",
      cell: (r) => (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {r.actorUserId.slice(0, 10)}
          {r.ip ? ` · ${r.ip}` : ""}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <InfoBanner tone="neutral">
        Append-only. Entries cannot be edited or deleted from here — that is the point of having them.
      </InfoBanner>

      <FilterBar>
        <Select
          value={action}
          onChange={(v) => {
            setAction(v);
            setSkip(0);
          }}
          allLabel="All actions"
          options={ACTIONS.map((a) => ({ value: a, label: a }))}
        />
        <ExportButton resource="audit" params={action ? { action } : {}} />
      </FilterBar>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="🗂️" title="No admin actions recorded yet" />
      ) : (
        <>
          <RecordList columns={columns} rows={data.rows} rowKey={(r) => r.id} />
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}
    </div>
  );
}

function summarise(before: unknown, after: unknown): string {
  const b = before && typeof before === "object" ? (before as Record<string, unknown>) : null;
  const a = after && typeof after === "object" ? (after as Record<string, unknown>) : null;
  if (!a) return "—";

  // Show only the fields that actually moved — a full JSON dump is unreadable
  // in a table row and hides the one thing the reader is looking for.
  const changed = Object.keys(a).filter((k) => !b || JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  if (!changed.length) return JSON.stringify(a).slice(0, 120);
  return changed
    .map((k) => (b && k in b ? `${k}: ${fmt(b[k])} → ${fmt(a[k])}` : `${k}: ${fmt(a[k])}`))
    .join(", ");
}

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
