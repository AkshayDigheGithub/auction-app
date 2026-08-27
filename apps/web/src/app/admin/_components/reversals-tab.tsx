"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { Badge, EmptyState, ErrorBanner, ghostButtonClass, InfoBanner } from "@/components/ui";
import { Column, FilterBar, Pager, RecordList, Select } from "./shared";

interface Reversal {
  id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  reporterTotalReports: number;
  deal: {
    id: string;
    finalPrice: string;
    feeAmountPaise: number | null;
    feeStatus: string;
    shop: { id: string; shopName: string };
    request: { productName: string };
    customer: { id: string; phoneNumber: string; name: string | null };
  };
}

const TAKE = 25;

const STATUS_TONE = {
  pending: "amber",
  approved: "green",
  rejected: "neutral",
} as const;

export function ReversalsTab() {
  const [status, setStatus] = useState("pending");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ rows: Reversal[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ take: String(TAKE), skip: String(skip), ...(status ? { status } : {}) });
    api
      .get<{ rows: Reversal[]; total: number }>(`/admin/reversals?${qs}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [status, skip]);

  useEffect(load, [load]);

  async function resolve(id: string, action: "approve" | "reject") {
    let note = "";
    if (action === "reject") {
      note = prompt("Why is this report being rejected? (min 5 characters)") ?? "";
      if (note.trim().length < 5) return;
    }
    setBusy(id);
    setError(null);
    try {
      await api.post(`/admin/reversals/${id}/${action}`, { note: note || undefined });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const columns: Column<Reversal>[] = [
    {
      key: "deal",
      header: "Deal",
      mobile: "title",
      cell: (r) => (
        <>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.deal.request.productName}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {r.deal.customer.phoneNumber}
            {r.reporterTotalReports > 2 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">· {r.reporterTotalReports} reports</span>
            )}
          </p>
        </>
      ),
    },
    {
      key: "shop",
      header: "Shop",
      cell: (r) => <span className="text-neutral-600 dark:text-neutral-300">{r.deal.shop.shopName}</span>,
    },
    {
      key: "fee",
      header: "Fee",
      align: "right",
      mobile: "trailing",
      cell: (r) => (
        <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{formatPaise(r.deal.feeAmountPaise)}</span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (r) => (
        <span className="line-clamp-2 max-w-xs text-neutral-500 dark:text-neutral-400" title={r.reason}>
          {r.reason}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <>
          <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
          {r.status === "approved" && r.resolvedByUserId == null && (
            <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">auto</span>
          )}
        </>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <div className="flex flex-wrap justify-end gap-1">
            <button className={ghostButtonClass} disabled={busy === r.id} onClick={() => resolve(r.id, "approve")}>
              Approve
            </button>
            <button className={ghostButtonClass} disabled={busy === r.id} onClick={() => resolve(r.id, "reject")}>
              Reject
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <InfoBanner>
        Reports at or below <strong>{formatPaise(30_000)}</strong> are approved automatically — contesting them costs
        more support time than they recover. Anything larger lands here.
      </InfoBanner>
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <FilterBar>
        <Select
          value={status}
          onChange={(v) => {
            setStatus(v);
            setSkip(0);
          }}
          allLabel="All statuses"
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </FilterBar>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="✅" title="Nothing to review" hint="Customer reports needing a decision appear here." />
      ) : (
        <>
          <RecordList columns={columns} rows={data.rows} rowKey={(r) => r.id} />
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}
    </div>
  );
}
