"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatRupees } from "@/lib/money";
import {
  DISPUTE_REASON_SHORT,
  DISPUTE_STATUS_TONE,
  type DisputeReason,
  type DisputeStatus,
} from "@/lib/disputes";
import { Badge, EmptyState, ErrorBanner, ghostButtonClass, InfoBanner } from "@/components/ui";
import { Column, FilterBar, Pager, RecordList, Select, contactLabel } from "./shared";

interface DisputeRow {
  id: string;
  reason: DisputeReason;
  details: string | null;
  status: DisputeStatus;
  raisedByParty: "customer" | "shop_owner";
  createdAt: string;
  resolutionNote: string | null;
  /** Complaints against this shop in total, and how many were upheld. */
  shopDisputeTotal: number;
  shopDisputeUpheld: number;
  deal: {
    id: string;
    finalPrice: string;
    qrStatus: string;
    request: { productName: string };
    customer: {
      id: string;
      phoneNumber: string | null;
      email: string | null;
      name: string | null;
    };
  };
  shop: { id: string; shopName: string; verified: boolean; suspended: boolean };
  raisedBy: {
    id: string;
    phoneNumber: string | null;
    email: string | null;
    name: string | null;
  };
}

const TAKE = 25;

/**
 * `onResolved` lets the page refresh the tab's open-count badge. Without it the
 * badge keeps claiming a backlog the admin just cleared, which is exactly when
 * they are looking at it.
 */
export function DisputesTab({ onResolved }: { onResolved?: () => void }) {
  const [status, setStatus] = useState("open");
  const [reason, setReason] = useState("");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ rows: DisputeRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({
      take: String(TAKE),
      skip: String(skip),
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
    });
    api
      .get<{ rows: DisputeRow[]; total: number }>(`/admin/disputes?${qs}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [status, reason, skip]);

  useEffect(load, [load]);

  async function resolve(id: string, outcome: "upheld" | "dismissed") {
    const note = prompt(
      outcome === "upheld"
        ? "Why does this complaint stand? (min 5 characters)"
        : "Why is this complaint being dismissed? (min 5 characters)",
    );
    if (note == null || note.trim().length < 5) return;

    setBusy(id);
    setError(null);
    try {
      await api.post(`/admin/disputes/${id}/resolve`, { outcome, note: note.trim() });
      load();
      onResolved?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const columns: Column<DisputeRow>[] = [
    {
      key: "complaint",
      header: "Complaint",
      mobile: "title",
      cell: (r) => (
        <>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            {DISPUTE_REASON_SHORT[r.reason]}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {r.raisedByParty === "customer" ? "Customer" : "Shop"} · {contactLabel(r.raisedBy)}
          </p>
          {r.details && (
            <p
              className="mt-0.5 line-clamp-2 max-w-sm text-xs text-neutral-500 dark:text-neutral-400"
              title={r.details}
            >
              “{r.details}”
            </p>
          )}
        </>
      ),
    },
    {
      key: "shop",
      header: "Shop",
      cell: (r) => (
        <>
          <span className="text-neutral-600 dark:text-neutral-300">{r.shop.shopName}</span>
          {/* One complaint is noise, a pattern is a decision — so the pattern
              is on the row rather than a click away. */}
          {r.shopDisputeTotal > 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {r.shopDisputeTotal} complaints
              {r.shopDisputeUpheld > 0 && ` · ${r.shopDisputeUpheld} upheld`}
            </p>
          )}
          {r.shop.suspended && <p className="text-xs text-red-600 dark:text-red-400">suspended</p>}
        </>
      ),
    },
    {
      key: "deal",
      header: "Deal",
      cell: (r) => (
        <>
          <span className="text-neutral-600 dark:text-neutral-300">{r.deal.request.productName}</span>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {formatRupees(r.deal.finalPrice)} · QR {r.deal.qrStatus}
          </p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <>
          <Badge tone={DISPUTE_STATUS_TONE[r.status]}>{r.status}</Badge>
          {r.resolutionNote && (
            <p
              className="mt-0.5 line-clamp-1 max-w-[12rem] text-xs text-neutral-400 dark:text-neutral-500"
              title={r.resolutionNote}
            >
              {r.resolutionNote}
            </p>
          )}
        </>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      cell: (r) =>
        r.status === "open" ? (
          <div className="flex flex-wrap justify-end gap-1">
            <button className={ghostButtonClass} disabled={busy === r.id} onClick={() => resolve(r.id, "upheld")}>
              Uphold
            </button>
            <button className={ghostButtonClass} disabled={busy === r.id} onClick={() => resolve(r.id, "dismissed")}>
              Dismiss
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <InfoBanner tone="neutral">
        Complaints about how a deal was honoured. These move no money — upholding one is the record that a later
        suspension or a withheld <strong>Verified</strong> badge rests on. Fee arguments live under Reports.
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
            { value: "open", label: "Open" },
            { value: "upheld", label: "Upheld" },
            { value: "dismissed", label: "Dismissed" },
          ]}
        />
        <Select
          value={reason}
          onChange={(v) => {
            setReason(v);
            setSkip(0);
          }}
          allLabel="All reasons"
          options={Object.entries(DISPUTE_REASON_SHORT).map(([value, label]) => ({ value, label }))}
        />
      </FilterBar>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="🤝" title="No complaints" hint="Disputes raised by customers or shops appear here." />
      ) : (
        <>
          <RecordList columns={columns} rows={data.rows} rowKey={(r) => r.id} />
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}
    </div>
  );
}
