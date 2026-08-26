"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";

interface RequestSummary {
  id: string;
  productName: string;
  areaText: string;
  status: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  locked: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-500",
};

export default function MyRequestsPage() {
  const { ready, user } = useRequireRole("customer");
  const [requests, setRequests] = useState<RequestSummary[]>([]);

  useEffect(() => {
    if (!ready || !user) return;
    api.get<RequestSummary[]>("/requests/mine").then(setRequests).catch(() => {});
  }, [ready, user]);

  if (!ready || !user) return null;

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My requests</h1>
        <Link href="/request/new" className="text-sm text-orange-600 underline">
          + New
        </Link>
      </header>

      {requests.length === 0 && <p className="text-sm text-neutral-500">No requests yet.</p>}

      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id}>
            <Link
              href={`/request/${r.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
            >
              <div>
                <p className="font-medium">{r.productName}</p>
                <p className="text-xs text-neutral-500">{r.areaText}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs ${STATUS_COLOR[r.status] ?? ""}`}>{r.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
