"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { categoryLabel, describeFee, formatPaise, TXN_TYPE_LABELS } from "@/lib/money";
import {
  Badge,
  cardRowClass,
  EmptyState,
  InfoBanner,
  LoadingScreen,
  linkClass,
  primaryButtonClass,
} from "@/components/ui";

interface WalletMe {
  shopId: string;
  category: string;
  billingMode: "shadow" | "live";
  balancePaise: number;
  freeDealsRemaining: number;
  freeDealsTotal: number;
  suspended: boolean;
  pricing: {
    rateBps: number;
    capPaise: number | null;
    floorPaise: number;
    flatFeePaise: number | null;
    maxFeePaise: number;
  };
  eligibleForLeads: boolean;
  rechargeSlabs: { id: string; payPaise: number; bonusPaise: number; approxDeals: string }[];
}

interface LedgerRow {
  id: string;
  type: string;
  amountPaise: number;
  balanceAfterPaise: number;
  reason: string;
  createdAt: string;
}

export default function WalletPage() {
  const { ready, user } = useRequireRole("shop_owner");
  const [wallet, setWallet] = useState<WalletMe | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [noShop, setNoShop] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    api
      .get<WalletMe>("/wallet/me")
      .then(setWallet)
      .catch(() => setNoShop(true));
    api
      .get<{ rows: LedgerRow[] }>("/wallet/me/ledger")
      .then((r) => setLedger(r.rows))
      .catch(() => setLedger([]));
  }, [ready, user]);

  if (!ready || !user) return <LoadingScreen />;

  if (noShop) {
    return (
      <main className="flex flex-1 flex-col gap-4 px-6 py-8">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Account</h1>
        <EmptyState
          icon="🏪"
          title="No shop profile yet"
          hint="Create your shop to start receiving customers."
          action={
            <Link href="/onboard" className={`${primaryButtonClass} mt-2 inline-block`}>
              Set up my shop
            </Link>
          }
        />
      </main>
    );
  }

  if (!wallet) return <LoadingScreen label="Loading your account…" />;

  const onTrial = wallet.freeDealsRemaining > 0;

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-8">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Account</h1>

      {/* In the pilot nothing is charged at all. Say so plainly rather than
          showing a balance that implies money is at stake. */}
      {wallet.billingMode === "shadow" && (
        <InfoBanner tone="green">
          <strong>Free during the pilot.</strong> You are not being charged for any deal right now. Pricing starts
          after the pilot, and we will tell you before it does.
        </InfoBanner>
      )}

      {wallet.suspended && (
        <InfoBanner tone="amber">
          Your shop is suspended and is not receiving customers. Please contact support.
        </InfoBanner>
      )}

      {/* Trial: framed as deals, not days — that is how it actually works. */}
      {onTrial && (
        <div className="rounded-xl bg-green-50 px-4 py-3 dark:bg-green-950/30">
          <p className="text-lg font-semibold text-green-700 dark:text-green-300">
            {wallet.freeDealsRemaining} free {wallet.freeDealsRemaining === 1 ? "deal" : "deals"} left
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Your first {wallet.freeDealsTotal} deals cost you nothing. You only pay once you have already sold.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-neutral-200 px-4 py-4 dark:border-neutral-800">
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Balance</p>
        <p className="mt-1 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
          {formatPaise(wallet.balancePaise, { decimals: true })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <Badge tone="blue">{categoryLabel(wallet.category)}</Badge>
          <span>{describeFee(wallet.pricing)}</span>
        </div>
        {!wallet.eligibleForLeads && !wallet.suspended && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            You are not receiving new customers because your balance is below {formatPaise(wallet.pricing.maxFeePaise)}.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Top up</h2>
        <div className="grid grid-cols-3 gap-2">
          {wallet.rechargeSlabs.map((slab) => (
            <div
              key={slab.id}
              className="rounded-xl border border-neutral-200 px-3 py-3 text-center dark:border-neutral-800"
            >
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">{formatPaise(slab.payPaise)}</p>
              {slab.bonusPaise > 0 ? (
                <p className="text-xs font-medium text-green-600 dark:text-green-400">
                  +{formatPaise(slab.bonusPaise)} free
                </p>
              ) : (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">&nbsp;</p>
              )}
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{slab.approxDeals} deals</p>
            </div>
          ))}
        </div>
        <button className={primaryButtonClass} disabled title="Top-ups are not enabled yet">
          Top-ups not available yet
        </button>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Payments are not switched on during the pilot, so there is nothing to pay.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">History</h2>
        {ledger === null ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
        ) : ledger.length === 0 ? (
          <EmptyState icon="🧾" title="Nothing here yet" hint="Your deals and top-ups will appear here." />
        ) : (
          <ul className="flex flex-col gap-2">
            {ledger.map((row) => (
              <li key={row.id} className={cardRowClass}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {TXN_TYPE_LABELS[row.type] ?? row.type}
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      row.amountPaise > 0
                        ? "text-green-600 dark:text-green-400"
                        : row.amountPaise < 0
                          ? "text-neutral-900 dark:text-neutral-100"
                          : "text-neutral-400 dark:text-neutral-500"
                    }`}
                  >
                    {row.amountPaise > 0 ? "+" : ""}
                    {formatPaise(row.amountPaise, { decimals: true })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                  {row.reason} · balance {formatPaise(row.balanceAfterPaise, { decimals: true })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/nearby" className={`${linkClass} text-sm`}>
        ← Back to nearby requests
      </Link>
    </main>
  );
}
