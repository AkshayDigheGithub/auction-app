"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { categoryLabel, FEE_STATUS_LABELS, formatPaise, formatRupees, SHOP_CATEGORY_LABELS } from "@/lib/money";
import { Badge, EmptyState } from "@/components/ui";
import { Column, ExportButton, FilterBar, Pager, RecordList, Select } from "./shared";

interface DealRow {
  id: string;
  finalPrice: string;
  feeAmountPaise: number | null;
  feeRateBps: number | null;
  feeCategory: string | null;
  feeStatus: string;
  qrStatus: string;
  createdAt: string;
  shop: { shopName: string };
  request: { productName: string };
  reversal: { status: string } | null;
}

const TAKE = 25;

const FEE_TONE: Record<string, "neutral" | "blue" | "green" | "amber"> = {
  shadow: "neutral",
  waived_trial: "blue",
  charged: "green",
  reversed: "amber",
};

export function DealsTab() {
  const [feeStatus, setFeeStatus] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [category, setCategory] = useState("");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ rows: DealRow[]; total: number } | null>(null);

  const params = useCallback(() => {
    const p: Record<string, string> = { take: String(TAKE), skip: String(skip) };
    if (feeStatus) p.feeStatus = feeStatus;
    if (qrStatus) p.qrStatus = qrStatus;
    if (category) p.category = category;
    return p;
  }, [feeStatus, qrStatus, category, skip]);

  const load = useCallback(() => {
    const qs = new URLSearchParams(params()).toString();
    api
      .get<{ rows: DealRow[]; total: number }>(`/admin/deals?${qs}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [params]);

  useEffect(load, [load]);

  const reset = () => setSkip(0);

  const columns: Column<DealRow>[] = [
    {
      key: "product",
      header: "Product",
      mobile: "title",
      cell: (d) => (
        <>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{d.request.productName}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{categoryLabel(d.feeCategory)}</p>
        </>
      ),
    },
    {
      key: "shop",
      header: "Shop",
      cell: (d) => <span className="text-neutral-600 dark:text-neutral-300">{d.shop.shopName}</span>,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      mobile: "trailing",
      cell: (d) => (
        <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{formatRupees(d.finalPrice)}</span>
      ),
    },
    {
      key: "fee",
      header: "Fee",
      align: "right",
      cell: (d) => (
        <span className="tabular-nums text-neutral-900 dark:text-neutral-100">
          {formatPaise(d.feeAmountPaise)}
          {d.feeRateBps != null && (
            <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">
              @{(d.feeRateBps / 100).toFixed(2)}%
            </span>
          )}
        </span>
      ),
    },
    {
      key: "feeStatus",
      header: "Fee status",
      mobile: "meta",
      cell: (d) => (
        <Badge tone={FEE_TONE[d.feeStatus] ?? "neutral"}>{FEE_STATUS_LABELS[d.feeStatus] ?? d.feeStatus}</Badge>
      ),
    },
    {
      key: "qr",
      header: "QR",
      cell: (d) => (
        <>
          <span className="text-neutral-500 dark:text-neutral-400">{d.qrStatus}</span>
          {d.reversal && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">· reported</span>}
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Select
          value={feeStatus}
          onChange={(v) => {
            setFeeStatus(v);
            reset();
          }}
          allLabel="All fee statuses"
          options={Object.entries(FEE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          value={qrStatus}
          onChange={(v) => {
            setQrStatus(v);
            reset();
          }}
          allLabel="All QR statuses"
          options={[
            { value: "pending", label: "Pending" },
            { value: "scanned", label: "Scanned" },
            { value: "confirmed", label: "Confirmed" },
          ]}
        />
        <Select
          value={category}
          onChange={(v) => {
            setCategory(v);
            reset();
          }}
          allLabel="All categories"
          options={Object.entries(SHOP_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <ExportButton resource="deals" params={params()} />
      </FilterBar>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="🤝" title="No deals match" />
      ) : (
        <>
          <RecordList columns={columns} rows={data.rows} rowKey={(d) => d.id} />
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}
    </div>
  );
}
