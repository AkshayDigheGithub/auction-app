"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { LoadingScreen } from "@/components/ui";
import { OverviewTab } from "./_components/overview-tab";
import { ShopsTab } from "./_components/shops-tab";
import { DealsTab } from "./_components/deals-tab";
import { RequestsTab } from "./_components/requests-tab";
import { RatesTab } from "./_components/rates-tab";
import { ReversalsTab } from "./_components/reversals-tab";
import { QualityTab } from "./_components/quality-tab";
import { AuditTab } from "./_components/audit-tab";
import { CategoriesTab } from "./_components/categories-tab";
import { UsersTab } from "./_components/users-tab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "shops", label: "Shops" },
  { id: "users", label: "Users" },
  { id: "deals", label: "Deals" },
  { id: "requests", label: "Requests" },
  { id: "rates", label: "Rates" },
  { id: "categories", label: "Categories" },
  { id: "reports", label: "Reports" },
  { id: "quality", label: "Quality" },
  { id: "audit", label: "Audit" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const { ready, user } = useRequireRole("admin");
  const [tab, setTab] = useState<TabId>("overview");
  const [pendingReports, setPendingReports] = useState(0);

  // Remember the tab across reloads — an admin working through reports should
  // not be dropped back on Overview every time they refresh.
  //
  // This has to happen in an effect rather than a lazy initialiser: the
  // component is server-rendered first, where localStorage does not exist, and
  // reading it during render would cause a hydration mismatch.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin.tab");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted UI state on mount
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved as TabId);
    } catch {
      /* private mode / blocked storage — the default tab is fine */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("admin.tab", tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    if (!ready || !user) return;
    api
      .get<{ total: number }>("/admin/reversals?status=pending&take=1")
      .then((r) => setPendingReports(r.total))
      .catch(() => {});
  }, [ready, user, tab]);

  if (!ready || !user) return <LoadingScreen />;

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Admin</h1>

      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition ${
                tab === t.id
                  ? "bg-orange-600 text-white"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {t.label}
              {t.id === "reports" && pendingReports > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                    tab === t.id ? "bg-white/25" : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                  }`}
                >
                  {pendingReports}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {tab === "overview" && <OverviewTab />}
      {tab === "shops" && <ShopsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "deals" && <DealsTab />}
      {tab === "requests" && <RequestsTab />}
      {tab === "rates" && <RatesTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "reports" && <ReversalsTab />}
      {tab === "quality" && <QualityTab />}
      {tab === "audit" && <AuditTab />}
    </main>
  );
}
