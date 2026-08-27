"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { categoryLabel, formatPaise, SHOP_CATEGORY_LABELS, TXN_TYPE_LABELS } from "@/lib/money";
import {
  Badge,
  ErrorBanner,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";
import {
  Column,
  ExportButton,
  FilterBar,
  Pager,
  RecordList,
  SearchInput,
  SectionTitle,
  Select,
  Stat,
} from "./shared";

interface ShopRow {
  id: string;
  shopName: string;
  address: string;
  category: string;
  secondaryCategories: string[];
  verified: boolean;
  suspended: boolean;
  walletBalancePaise: number;
  freeDealsUsed: number;
  freeDealsRemaining: number;
  requiredBalancePaise: number;
  onTrial: boolean;
  lowBalance: boolean;
  owner: { phoneNumber: string; name: string | null };
  _count: { bids: number; deals: number };
}

interface ShopDetail {
  shop: ShopRow & { suspendedReason: string | null; upiId: string | null };
  pricing: { rateBps: number; capPaise: number | null; floorPaise: number; flatFeePaise: number | null } | null;
  freeDealsRemaining: number;
  stats: {
    bids: number;
    dealsLocked: number;
    dealsConfirmed: number;
    lockToConfirmRatio: number | null;
    feesChargedPaise: number;
    chargedDeals: number;
  };
  recentLedger: {
    id: string;
    type: string;
    amountPaise: number;
    balanceAfterPaise: number;
    reason: string;
    createdAt: string;
  }[];
  recentDeals: {
    id: string;
    finalPrice: string;
    feeAmountPaise: number | null;
    feeStatus: string;
    qrStatus: string;
    request: { productName: string };
  }[];
}

const TAKE = 25;

export function ShopsTab() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ rows: ShopRow[]; total: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const params = useCallback(() => {
    const p: Record<string, string> = { take: String(TAKE), skip: String(skip) };
    if (q) p.q = q;
    if (category) p.category = category;
    if (lowOnly) p.lowBalance = "true";
    return p;
  }, [q, category, lowOnly, skip]);

  const load = useCallback(() => {
    const qs = new URLSearchParams(params()).toString();
    api
      .get<{ rows: ShopRow[]; total: number }>(`/admin/shops?${qs}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<ShopRow>[] = [
    {
      key: "shop",
      header: "Shop",
      mobile: "title",
      cell: (s) => (
        <>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{s.shopName}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{s.owner.phoneNumber}</p>
        </>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (s) => <span className="text-neutral-600 dark:text-neutral-300">{categoryLabel(s.category)}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      mobile: "trailing",
      cell: (s) => (
        <span
          className={`tabular-nums ${s.lowBalance ? "font-semibold text-amber-700 dark:text-amber-400" : "text-neutral-900 dark:text-neutral-100"}`}
        >
          {formatPaise(s.walletBalancePaise)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.suspended && <Badge tone="amber">Suspended</Badge>}
          {s.verified && <Badge tone="green">Verified</Badge>}
          {s.onTrial && <Badge tone="blue">Trial {s.freeDealsRemaining}</Badge>}
          {s.lowBalance && <Badge tone="amber">Low</Badge>}
        </div>
      ),
    },
    {
      key: "deals",
      header: "Deals",
      align: "right",
      cell: (s) => <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{s._count.deals}</span>,
    },
    {
      key: "action",
      header: "",
      align: "right",
      cell: (s) => (
        <button className={ghostButtonClass} onClick={() => setSelected(s.id)}>
          View
        </button>
      ),
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
          placeholder="Search name, address, phone…"
        />
        <Select
          value={category}
          onChange={(v) => {
            setCategory(v);
            setSkip(0);
          }}
          allLabel="All categories"
          options={Object.entries(SHOP_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setLowOnly(e.target.checked);
              setSkip(0);
            }}
          />
          Low balance only
        </label>
        <ExportButton resource="shops" params={params()} />
      </FilterBar>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No shops match.</p>
      ) : (
        <>
          <RecordList
            columns={columns}
            rows={data.rows}
            rowKey={(s) => s.id}
            rowClassName={() => "hover:bg-neutral-50 dark:hover:bg-neutral-900/40"}
          />
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}

      {selected && <ShopDetailPanel shopId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function ShopDetailPanel({
  shopId,
  onClose,
  onChanged,
}: {
  shopId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjustRupees, setAdjustRupees] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<ShopDetail>(`/admin/shops/${shopId}`).then(setDetail).catch((e) => setError((e as Error).message));
  }, [shopId]);

  useEffect(load, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function adjust() {
    const rupees = Number(adjustRupees);
    if (!Number.isFinite(rupees) || rupees === 0) {
      setError("Enter a non-zero amount in rupees (negative to debit).");
      return;
    }
    await act(async () => {
      await api.post(`/admin/shops/${shopId}/wallet/adjust`, {
        amountPaise: Math.round(rupees * 100),
        reason: adjustReason,
      });
      setAdjustRupees("");
      setAdjustReason("");
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto bg-white px-4 py-5 shadow-xl sm:px-5 sm:py-6 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {detail?.shop.shopName ?? "Shop"}
          </h2>
          <button className={`${ghostButtonClass} shrink-0`} onClick={onClose}>
            Close
          </button>
        </div>

        {error && (
          <div className="mt-3">
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        )}
        {!detail ? (
          <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {detail.shop.address} · {detail.shop.owner.phoneNumber}
            </p>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Stat label="Balance" value={formatPaise(detail.shop.walletBalancePaise, { decimals: true })} />
              <Stat label="Free deals left" value={detail.freeDealsRemaining} />
              <Stat label="Deals locked" value={detail.stats.dealsLocked} />
              <Stat
                label="Lock → confirm"
                value={
                  detail.stats.lockToConfirmRatio == null
                    ? "—"
                    : `${Math.round(detail.stats.lockToConfirmRatio * 100)}%`
                }
                hint={`${detail.stats.dealsConfirmed} confirmed`}
                tone={
                  detail.stats.lockToConfirmRatio != null && detail.stats.lockToConfirmRatio < 0.5 ? "amber" : "neutral"
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={ghostButtonClass}
                disabled={busy}
                onClick={() =>
                  act(() => api.put(`/admin/shops/${shopId}/verify`, { verified: !detail.shop.verified }))
                }
              >
                {detail.shop.verified ? "Remove verified" : "Mark verified"}
              </button>
              <button
                className={ghostButtonClass}
                disabled={busy}
                onClick={() => {
                  if (detail.shop.suspended) {
                    act(() => api.put(`/admin/shops/${shopId}/suspend`, { suspended: false }));
                  } else {
                    const reason = prompt("Why is this shop being suspended? (min 5 characters)");
                    if (reason) act(() => api.put(`/admin/shops/${shopId}/suspend`, { suspended: true, reason }));
                  }
                }}
              >
                {detail.shop.suspended ? "Unsuspend" : "Suspend"}
              </button>
            </div>
            {detail.shop.suspended && detail.shop.suspendedReason && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Reason: {detail.shop.suspendedReason}</p>
            )}

            <SectionTitle hint="Every adjustment is recorded against your admin account in the audit log.">
              Adjust wallet
            </SectionTitle>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Amount in ₹ (negative to debit)
                <input
                  className={inputClass}
                  value={adjustRupees}
                  onChange={(e) => setAdjustRupees(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 1000 or -250"
                />
              </label>
              <label className={labelClass}>
                Reason (required)
                <input
                  className={inputClass}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Goodwill credit after failed top-up"
                />
              </label>
              {adjustRupees && Number(adjustRupees) !== 0 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  New balance would be{" "}
                  <strong>
                    {formatPaise(detail.shop.walletBalancePaise + Math.round(Number(adjustRupees) * 100), {
                      decimals: true,
                    })}
                  </strong>
                </p>
              )}
              <button className={primaryButtonClass} onClick={adjust} disabled={busy || adjustReason.trim().length < 5}>
                Apply adjustment
              </button>
            </div>

            <SectionTitle>Recent ledger</SectionTitle>
            {detail.recentLedger.length === 0 ? (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No transactions.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {detail.recentLedger.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-neutral-600 dark:text-neutral-300">
                      {TXN_TYPE_LABELS[r.type] ?? r.type}
                      <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">{r.reason}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-neutral-900 dark:text-neutral-100">
                      {r.amountPaise > 0 ? "+" : ""}
                      {formatPaise(r.amountPaise, { decimals: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <SectionTitle>Recent deals</SectionTitle>
            {detail.recentDeals.length === 0 ? (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No deals.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {detail.recentDeals.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-neutral-600 dark:text-neutral-300">
                      {d.request.productName}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                      {formatPaise(d.feeAmountPaise)} · {d.feeStatus} · {d.qrStatus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
