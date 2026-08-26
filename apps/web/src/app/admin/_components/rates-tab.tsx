"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { categoryLabel, formatBps, formatPaise } from "@/lib/money";
import { ErrorBanner, ghostButtonClass, InfoBanner, inputClass, primaryButtonClass } from "@/components/ui";
import { DataTable, SectionTitle, Td, Th } from "./shared";

interface Rate {
  category: string;
  rateBps: number;
  capPaise: number | null;
  floorPaise: number;
  flatFeePaise: number | null;
  active: boolean;
  preview: { pricePaise: number; feePaise: number }[];
}

/** Mirrors the API's RATE_SANITY_THRESHOLD_BPS. */
const SANITY_BPS = 500;

export function RatesTab() {
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Rate[]>("/admin/rates").then(setRates).catch(() => setRates([]));
  }, []);
  useEffect(load, [load]);

  if (!rates) return <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      <InfoBanner>
        Rates apply to <strong>future deals only</strong>. Deals already locked keep the rate they were charged at, so
        history never changes under you. Every edit is audit-logged.
      </InfoBanner>
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <DataTable
        head={
          <>
            <Th>Category</Th>
            <Th align="right">Rate</Th>
            <Th align="right">Cap</Th>
            <Th align="right">Floor</Th>
            <Th>Fee on ₹5k / ₹30k / ₹70k</Th>
            <Th> </Th>
          </>
        }
      >
        {rates.map((r) => (
          <tr key={r.category} className={r.active ? "" : "opacity-50"}>
            <Td className="font-medium text-neutral-900 dark:text-neutral-100">{categoryLabel(r.category)}</Td>
            <Td align="right" className="tabular-nums">
              {r.flatFeePaise != null ? `${formatPaise(r.flatFeePaise)} flat` : formatBps(r.rateBps)}
            </Td>
            <Td align="right" className="tabular-nums text-neutral-500 dark:text-neutral-400">
              {r.capPaise == null ? "—" : formatPaise(r.capPaise)}
            </Td>
            <Td align="right" className="tabular-nums text-neutral-500 dark:text-neutral-400">
              {formatPaise(r.floorPaise)}
            </Td>
            <Td className="text-neutral-500 dark:text-neutral-400">
              {r.preview.map((p) => formatPaise(p.feePaise)).join(" / ")}
            </Td>
            <Td align="right">
              <button className={ghostButtonClass} onClick={() => setEditing(editing === r.category ? null : r.category)}>
                {editing === r.category ? "Cancel" : "Edit"}
              </button>
            </Td>
          </tr>
        ))}
      </DataTable>

      {editing && (
        <RateEditor
          rate={rates.find((r) => r.category === editing)!}
          onDone={() => {
            setEditing(null);
            setError(null);
            load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function RateEditor({
  rate,
  onDone,
  onError,
}: {
  rate: Rate;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [ratePct, setRatePct] = useState((rate.rateBps / 100).toString());
  const [capRupees, setCapRupees] = useState(rate.capPaise == null ? "" : (rate.capPaise / 100).toString());
  const [floorRupees, setFloorRupees] = useState((rate.floorPaise / 100).toString());
  const [busy, setBusy] = useState(false);

  const bps = Math.round(Number(ratePct) * 100);
  const capPaise = capRupees === "" ? null : Math.round(Number(capRupees) * 100);
  const floorPaise = Math.round(Number(floorRupees) * 100);
  const high = Number.isFinite(bps) && bps > SANITY_BPS;

  // Live preview of what this rate would actually charge. "0.6% capped ₹300" is
  // abstract; "a ₹70,000 phone earns ₹300" is not.
  const samples = [500_000, 3_000_000, 7_000_000].map((price) => {
    if (rate.flatFeePaise != null) return { price, fee: Math.min(rate.flatFeePaise, price) };
    let fee = Math.round((price * (Number.isFinite(bps) ? bps : 0)) / 10_000);
    fee = Math.max(fee, Number.isFinite(floorPaise) ? floorPaise : 0);
    if (capPaise != null) fee = Math.min(fee, capPaise);
    return { price, fee: Math.min(fee, price) };
  });

  async function save() {
    setBusy(true);
    try {
      await api.put(`/admin/rates/${rate.category}`, {
        rateBps: bps,
        capPaise,
        floorPaise,
        ...(high ? { confirmHighRate: true } : {}),
      });
      onDone();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <SectionTitle>{categoryLabel(rate.category)}</SectionTitle>
      {rate.flatFeePaise != null && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          This category uses a flat {formatPaise(rate.flatFeePaise)} per deal, so rate and cap do not apply.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-300">
          Rate %
          <input className={inputClass} value={ratePct} onChange={(e) => setRatePct(e.target.value)} inputMode="decimal" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-300">
          Cap ₹ (blank = none)
          <input className={inputClass} value={capRupees} onChange={(e) => setCapRupees(e.target.value)} inputMode="decimal" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-300">
          Floor ₹
          <input className={inputClass} value={floorRupees} onChange={(e) => setFloorRupees(e.target.value)} inputMode="decimal" />
        </label>
      </div>

      <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Preview</p>
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
          {samples.map((s) => (
            <li key={s.price} className="text-neutral-700 dark:text-neutral-300">
              {formatPaise(s.price)} deal → <strong className="tabular-nums">{formatPaise(s.fee)}</strong>
            </li>
          ))}
        </ul>
      </div>

      {high && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {formatBps(bps)} is above the {formatBps(SANITY_BPS)} sanity threshold. On thin-margin retail this can take
          most of a shop&apos;s profit. Saving will confirm it deliberately.
        </p>
      )}

      <button className={`${primaryButtonClass} mt-3`} onClick={save} disabled={busy || !Number.isFinite(bps)}>
        {busy ? "Saving…" : "Save rate"}
      </button>
    </div>
  );
}
