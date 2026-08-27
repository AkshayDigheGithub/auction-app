"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { categoryLabel, formatPaise } from "@/lib/money";
import { Badge, InfoBanner } from "@/components/ui";
import { DataTable, SectionTitle, Stat, Td, Th } from "./shared";

interface Revenue {
  billingMode: "shadow" | "live";
  feesEarnedPaise: number;
  chargedDeals: number;
  averageFeePaise: number;
  wouldBeRevenuePaise: number;
  shadowDeals: number;
  trialWaivedPaise: number;
  trialDeals: number;
  reversedPaise: number;
  reversedDeals: number;
  byCategory: { feeCategory: string | null; _sum: { feeAmountPaise: number | null }; _count: { _all: number } }[];
  wallet: {
    floatOutstandingPaise: number;
    rechargedPaise: number;
    bonusGrantedPaise: number;
    feesConsumedPaise: number;
    reversedPaise: number;
  };
  activeShops: number;
  monthlyCostBandPaise: { low: number; high: number };
}

interface TrialCohorts {
  freeDealsPerShop: number;
  inTrial: { count: number };
  converted: { count: number };
  lapsed: { count: number };
  conversionRate: number | null;
}

export function OverviewTab() {
  const [rev, setRev] = useState<Revenue | null>(null);
  const [trial, setTrial] = useState<TrialCohorts | null>(null);

  useEffect(() => {
    api.get<Revenue>("/admin/revenue").then(setRev).catch(() => {});
    api.get<TrialCohorts>("/admin/trial-cohorts").then(setTrial).catch(() => {});
  }, []);

  if (!rev) return <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>;

  const shadow = rev.billingMode === "shadow";
  const costLow = rev.monthlyCostBandPaise.low;
  const costHigh = rev.monthlyCostBandPaise.high;
  const headline = shadow ? rev.wouldBeRevenuePaise : rev.feesEarnedPaise;

  return (
    <div className="flex flex-col gap-4">
      {shadow && (
        <InfoBanner tone="green">
          <strong>Shadow billing.</strong> No shop is being charged. Fees are computed and recorded on every deal so
          the pricing can be judged on real numbers before collection is switched on.
        </InfoBanner>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <Stat
          label={shadow ? "Would-be revenue" : "Fees earned"}
          value={formatPaise(headline)}
          hint={`${shadow ? rev.shadowDeals : rev.chargedDeals} deals`}
          tone="orange"
        />
        <Stat
          label="Avg fee / deal"
          value={formatPaise(shadow && rev.shadowDeals ? Math.round(rev.wouldBeRevenuePaise / rev.shadowDeals) : rev.averageFeePaise)}
        />
        <Stat label="Active shops" value={rev.activeShops} />
        <Stat
          label="Break-even"
          value={
            headline >= costLow ? (
              <span className="text-green-700 dark:text-green-400">Covered</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                {Math.max(costLow - headline, 0) > 0 ? formatPaise(costLow - headline) : "—"}
              </span>
            )
          }
          hint={`Costs ${formatPaise(costLow)}–${formatPaise(costHigh)}/mo`}
        />
      </div>

      <SectionTitle hint="Money shops have paid in but not yet used is a liability — service owed, not revenue earned. It is deliberately kept apart from fees.">
        Wallet
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <Stat label="Float outstanding" value={formatPaise(rev.wallet.floatOutstandingPaise)} hint="Liability" tone="amber" />
        <Stat label="Topped up" value={formatPaise(rev.wallet.rechargedPaise)} />
        <Stat label="Fees consumed" value={formatPaise(rev.wallet.feesConsumedPaise)} />
        <Stat label="Bonus granted" value={formatPaise(rev.wallet.bonusGrantedPaise)} />
      </div>

      <SectionTitle hint="Trial cost is acquisition spend, not lost revenue. Reversals are a deduction.">
        Adjustments
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <Stat
          label="Trial waived"
          value={formatPaise(rev.trialWaivedPaise)}
          hint={`${rev.trialDeals} deals · acquisition spend`}
          tone="green"
        />
        <Stat label="Reversed" value={formatPaise(rev.reversedPaise)} hint={`${rev.reversedDeals} deals`} />
        {trial && (
          <>
            <Stat
              label="Trial → paid"
              value={trial.conversionRate == null ? "—" : `${Math.round(trial.conversionRate * 100)}%`}
              hint={`${trial.converted.count} of ${trial.converted.count + trial.lapsed.count} finished trial`}
            />
            <Stat label="In trial now" value={trial.inTrial.count} hint={`${trial.freeDealsPerShop} free deals each`} />
          </>
        )}
      </div>

      <SectionTitle>By category</SectionTitle>
      {rev.byCategory.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No deals yet.</p>
      ) : (
        <DataTable
          head={
            <>
              <Th>Category</Th>
              <Th align="right">Deals</Th>
              <Th align="right">Fees</Th>
            </>
          }
        >
          {rev.byCategory.map((c) => (
            <tr key={c.feeCategory ?? "none"}>
              <Td>
                {c.feeCategory ? (
                  categoryLabel(c.feeCategory)
                ) : (
                  <Badge>Uncategorised</Badge>
                )}
              </Td>
              <Td align="right" className="tabular-nums">
                {c._count._all}
              </Td>
              <Td align="right" className="tabular-nums">
                {formatPaise(c._sum.feeAmountPaise ?? 0)}
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
