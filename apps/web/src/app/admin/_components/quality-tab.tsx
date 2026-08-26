"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, InfoBanner } from "@/components/ui";
import { DataTable, SectionTitle, Stat, Td, Th } from "./shared";

interface LeakageRow {
  shop_id: string;
  shop_name: string;
  locked: string;
  confirmed: string;
  reversed: string;
  confirm_ratio: number | null;
}

interface TrendRow {
  day: string;
  locked: string;
  confirmed: string;
}

export function QualityTab() {
  const [rows, setRows] = useState<LeakageRow[] | null>(null);
  const [trend, setTrend] = useState<TrendRow[] | null>(null);

  useEffect(() => {
    api.get<LeakageRow[]>("/admin/leakage?days=30").then(setRows).catch(() => setRows([]));
    api.get<TrendRow[]>("/admin/leakage/trend?days=30").then(setTrend).catch(() => setTrend([]));
  }, []);

  const totals = (trend ?? []).reduce(
    (acc, t) => ({ locked: acc.locked + Number(t.locked), confirmed: acc.confirmed + Number(t.confirmed) }),
    { locked: 0, confirmed: 0 },
  );
  const overall = totals.locked ? totals.confirmed / totals.locked : null;

  return (
    <div className="flex flex-col gap-4">
      <InfoBanner tone="neutral">
        The QR scan no longer carries the fee, so a low confirm rate is not a revenue leak any more — it is a{" "}
        <strong>quality signal</strong>. A shop with many locks and few confirms is either closing off-platform or not
        delivering what it promised.
      </InfoBanner>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Deals locked (30d)" value={totals.locked} />
        <Stat label="Confirmed" value={totals.confirmed} />
        <Stat
          label="Confirm rate"
          value={overall == null ? "—" : `${Math.round(overall * 100)}%`}
          tone={overall != null && overall < 0.5 ? "amber" : "green"}
        />
      </div>

      <SectionTitle hint="Sorted worst-first. Cross-check reversals before acting — a broken area looks like a bad shop.">
        By shop
      </SectionTitle>
      {!rows ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="📉" title="No deals in this window" hint="Confirm rates appear once deals are locked." />
      ) : (
        <DataTable
          head={
            <>
              <Th>Shop</Th>
              <Th align="right">Locked</Th>
              <Th align="right">Confirmed</Th>
              <Th align="right">Reversed</Th>
              <Th align="right">Confirm rate</Th>
            </>
          }
        >
          {rows.map((r) => {
            const ratio = r.confirm_ratio;
            const poor = ratio != null && ratio < 0.5 && Number(r.locked) >= 3;
            return (
              <tr key={r.shop_id} className={poor ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                <Td className="font-medium text-neutral-900 dark:text-neutral-100">{r.shop_name}</Td>
                <Td align="right" className="tabular-nums">{r.locked}</Td>
                <Td align="right" className="tabular-nums">{r.confirmed}</Td>
                <Td align="right" className="tabular-nums text-neutral-500 dark:text-neutral-400">{r.reversed}</Td>
                <Td
                  align="right"
                  className={`tabular-nums font-semibold ${poor ? "text-amber-700 dark:text-amber-400" : "text-neutral-700 dark:text-neutral-300"}`}
                >
                  {ratio == null ? "—" : `${Math.round(ratio * 100)}%`}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
