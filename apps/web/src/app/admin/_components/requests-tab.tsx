"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, EmptyState } from "@/components/ui";
import { DataTable, ExportButton, Pager, SearchInput, Select, Td, Th } from "./shared";

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

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <SearchInput value={q} onChange={(v) => { setQ(v); setSkip(0); }} placeholder="Search product…" />
        <Select
          value={status}
          onChange={(v) => { setStatus(v); setSkip(0); }}
          allLabel="All statuses"
          options={[
            { value: "open", label: "Open" },
            { value: "locked", label: "Locked" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <ExportButton resource="requests" params={params()} />
      </div>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="🗒️" title="No requests match" />
      ) : (
        <>
          <DataTable
            head={
              <>
                <Th>Product</Th>
                <Th>Area</Th>
                <Th>Category</Th>
                <Th align="right">Bids</Th>
                <Th>Status</Th>
              </>
            }
          >
            {data.rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.productName}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{r.customer.phoneNumber}</p>
                </Td>
                <Td className="max-w-xs truncate text-neutral-600 dark:text-neutral-300">{r.areaText}</Td>
                <Td className="text-neutral-500 dark:text-neutral-400">{r.productCategory?.name ?? "—"}</Td>
                <Td align="right" className="tabular-nums">{r.bids.length}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                </Td>
              </tr>
            ))}
          </DataTable>
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}
    </div>
  );
}
