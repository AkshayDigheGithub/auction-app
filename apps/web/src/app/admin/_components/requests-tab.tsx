"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, EmptyState } from "@/components/ui";
import { Column, ExportButton, FilterBar, Pager, RecordList, SearchInput, Select } from "./shared";

interface RequestRow {
  id: string;
  productName: string;
  areaText: string;
  status: string;
  createdAt: string;
  bids: { id: string }[];
  deal: { id: string } | null;
  customer: { phoneNumber: string };
  productCategory: { id: string; name: string } | null;
}

const TAKE = 25;

const STATUS_TONE: Record<string, "neutral" | "blue" | "green" | "amber"> = {
  open: "blue",
  locked: "amber",
  completed: "green",
  cancelled: "neutral",
};

export function RequestsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ rows: RequestRow[]; total: number } | null>(null);

  const params = useCallback(() => {
    const p: Record<string, string> = { take: String(TAKE), skip: String(skip) };
    if (q) p.q = q;
    if (status) p.status = status;
    return p;
  }, [q, status, skip]);

  const load = useCallback(() => {
    const qs = new URLSearchParams(params()).toString();
    api
      .get<{ rows: RequestRow[]; total: number }>(`/admin/requests?${qs}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<RequestRow>[] = [
    {
      key: "product",
      header: "Product",
      mobile: "title",
      cell: (r) => (
        <>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.productName}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{r.customer.phoneNumber}</p>
        </>
      ),
    },
    {
      key: "area",
      header: "Area",
      cell: (r) => (
        <span className="line-clamp-2 text-neutral-600 dark:text-neutral-300 md:line-clamp-1">{r.areaText}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (r) => <span className="text-neutral-500 dark:text-neutral-400">{r.productCategory?.name ?? "—"}</span>,
    },
    {
      key: "bids",
      header: "Bids",
      align: "right",
      cell: (r) => <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{r.bids.length}</span>,
    },
    {
      key: "status",
      header: "Status",
      mobile: "trailing",
      cell: (r) => <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setSkip(0);
          }}
          placeholder="Search product…"
        />
        <Select
          value={status}
          onChange={(v) => {
            setStatus(v);
            setSkip(0);
          }}
          allLabel="All statuses"
          options={[
            { value: "open", label: "Open" },
            { value: "locked", label: "Locked" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <ExportButton resource="requests" params={params()} />
      </FilterBar>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="🗒️" title="No requests match" />
      ) : (
        <>
          <RecordList columns={columns} rows={data.rows} rowKey={(r) => r.id} />
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}
    </div>
  );
}
