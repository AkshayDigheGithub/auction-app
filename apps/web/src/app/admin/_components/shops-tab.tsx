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
import { Column, ExportButton, FilterBar, Pager, RecordList, SearchInput, SectionTitle, Select, Stat, contactLabel } from "./shared";
import {
  DISPUTE_REASON_SHORT,
  DISPUTE_STATUS_TONE,
  type DisputeReason,
  type DisputeStatus,
} from "@/lib/disputes";

interface ShopRow {
  id: string;
  shopName: string;
  address: string;
  latitude: number;
  longitude: number;
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
  contactPhone: string | null;
  owner: { phoneNumber: string | null; email: string | null; name: string | null };
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
  /** Conduct complaint history — what the verify/suspend buttons below rest on (AUC-34). */
  disputes: {
    open: number;
    upheld: number;
    dismissed: number;
    total: number;
    recent: {
      id: string;
      reason: DisputeReason;
      details: string | null;
      status: DisputeStatus;
      createdAt: string;
    }[];
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

const SHOP_CATEGORY_VALUES = Object.keys(SHOP_CATEGORY_LABELS);

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
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{s.contactPhone || contactLabel(s.owner)}</p>
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
          placeholder="Search name, address, phone or email…"
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
  const [editingCategories, setEditingCategories] = useState(false);
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
              {detail.shop.address} · {detail.shop.contactPhone || contactLabel(detail.shop.owner)}
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="blue">{categoryLabel(detail.shop.category)}</Badge>
              {detail.shop.secondaryCategories.map((c) => (
                <Badge key={c}>{categoryLabel(c)}</Badge>
              ))}
              {detail.shop.verified && <Badge tone="green">Verified</Badge>}
              {detail.shop.suspended && <Badge tone="amber">Suspended</Badge>}
            </div>

            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              UPI: {detail.shop.upiId ?? "not provided"}
              {" · "}
              {/* A link rather than an embedded map: this panel is opened
                  constantly, and every render of a live map is a billable Maps
                  load (AUC-20 capped that spend deliberately). */}
              <a
                className="underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
                href={`https://www.google.com/maps/search/?api=1&query=${detail.shop.latitude},${detail.shop.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                View location on map
              </a>
            </p>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Stat label="Balance" value={formatPaise(detail.shop.walletBalancePaise, { decimals: true })} />
              <Stat label="Free deals left" value={detail.freeDealsRemaining} />
              <Stat label="Bids placed" value={detail.stats.bids} />
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
              <Stat
                label="Complaints"
                value={detail.disputes.total}
                hint={
                  detail.disputes.total === 0
                    ? "None raised"
                    : `${detail.disputes.upheld} upheld · ${detail.disputes.open} open`
                }
                tone={detail.disputes.upheld > 0 ? "amber" : "neutral"}
              />
            </div>

            {/* Sits directly above Verify/Suspend on purpose: this is the
                evidence those buttons are supposed to be acting on. */}
            {detail.disputes.recent.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <SectionTitle hint="Most recent first. Full history is on the Disputes tab.">
                  Complaints
                </SectionTitle>
                {detail.disputes.recent.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-700 dark:text-neutral-200">
                        {DISPUTE_REASON_SHORT[d.reason]}
                      </p>
                      {d.details && (
                        <p className="truncate text-xs text-neutral-400 dark:text-neutral-500" title={d.details}>
                          {d.details}
                        </p>
                      )}
                    </div>
                    <Badge tone={DISPUTE_STATUS_TONE[d.status]}>{d.status}</Badge>
                  </div>
                ))}
              </div>
            )}

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
              <button className={ghostButtonClass} disabled={busy} onClick={() => setEditingCategories((v) => !v)}>
                {editingCategories ? "Cancel categories" : "Edit categories"}
              </button>
            </div>

            {editingCategories && (
              <ShopCategoryEditor
                shopId={shopId}
                primary={detail.shop.category}
                secondary={detail.shop.secondaryCategories}
                onDone={() => {
                  setEditingCategories(false);
                  load();
                  onChanged();
                }}
                onError={setError}
              />
            )}
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

/**
 * Edit which categories a shop serves (AUC-60 / AUC-67).
 *
 * The primary category is what the shop is listed as; the secondaries widen
 * what it gets matched on. The fee is NOT set by either — it follows the
 * category the *request* falls under, which is what stops a shop registering
 * as jewellery (0.30%) and taking electronics deals at a third of the rate.
 * That is worth saying on screen, because the opposite is the natural guess.
 */
function ShopCategoryEditor({
  shopId,
  primary,
  secondary,
  onDone,
  onError,
}: {
  shopId: string;
  primary: string;
  secondary: string[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [nextPrimary, setNextPrimary] = useState(primary);
  const [nextSecondary, setNextSecondary] = useState<string[]>(secondary);
  const [busy, setBusy] = useState(false);

  // A category cannot be both primary and secondary — picking it as primary
  // silently drops it from the secondaries rather than rejecting the change.
  const secondaries = nextSecondary.filter((c) => c !== nextPrimary);
  const dirty =
    nextPrimary !== primary ||
    secondaries.length !== secondary.length ||
    secondaries.some((c) => !secondary.includes(c));

  async function save() {
    setBusy(true);
    try {
      await api.put(`/admin/shops/${shopId}/categories`, {
        category: nextPrimary,
        secondaryCategories: secondaries,
      });
      onDone();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 px-3 py-3 dark:border-neutral-800">
      <SectionTitle hint="Changes take effect on the next request matched — deals already locked keep their rate.">
        Categories
      </SectionTitle>

      <label className={`${labelClass} mt-3`}>
        Primary
        <select className={inputClass} value={nextPrimary} onChange={(e) => setNextPrimary(e.target.value)}>
          {SHOP_CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">Also serves</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SHOP_CATEGORY_VALUES.filter((c) => c !== nextPrimary).map((c) => {
          const on = secondaries.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setNextSecondary((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
              }
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                on ? "bg-orange-600 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {categoryLabel(c)}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        The fee always follows the category the <strong>request</strong> falls under, not the shop&apos;s primary — a
        furniture shop winning an electronics deal pays the electronics rate.
      </p>

      <button className={`${primaryButtonClass} mt-3 w-full sm:w-auto`} onClick={save} disabled={busy || !dirty}>
        {busy ? "Saving…" : "Save categories"}
      </button>
    </div>
  );
}
