"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { Badge, EmptyState, LoadingScreen } from "@/components/ui";

interface RequestSummary {
  id: string;
  productName: string;
  areaText: string;
  status: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, "blue" | "amber" | "green" | "neutral"> = {
  open: "blue",
  locked: "amber",
  completed: "green",
  cancelled: "neutral",
};

export default function MyRequestsPage() {
  const { ready, user } = useRequireRole("customer");
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    api.get<RequestSummary[]>("/requests/mine").then(setRequests).catch(() => setRequests([]));
  }, [ready, user]);

  if (!ready || !user) return <LoadingScreen />;

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">My requests</h1>
        <Link href="/request/new" className="text-sm text-orange-600 underline underline-offset-2 dark:text-orange-400">
          + New
        </Link>
      </header>

      {requests === null ? (
        <LoadingScreen label="Loading your requests…" />
      ) : requests.length === 0 ? (
        <EmptyState icon="🧾" title="No requests yet" hint="Post what you want to buy and shops nearby will start bidding." />
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/request/${r.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 transition active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-800/60"
              >
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.productName}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{r.areaText}</p>
                </div>
                <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
