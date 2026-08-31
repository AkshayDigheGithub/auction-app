"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, EmptyState } from "@/components/ui";
import { Column, ExportButton, FilterBar, Pager, RecordList, SearchInput, Select } from "./shared";

interface UserRow {
  id: string;
  phoneNumber: string;
  name: string | null;
  role: string;
  createdAt: string;
  /** Only ever set for a shop_owner — and null until they finish onboarding. */
  shop: { id: string; shopName: string; verified: boolean; suspended: boolean } | null;
  _count: { requests: number; deals: number };
}

const TAKE = 25;

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  shop_owner: "Shop owner",
  admin: "Admin",
};

const ROLE_TONE: Record<string, "neutral" | "blue" | "green" | "amber"> = {
  customer: "blue",
  shop_owner: "green",
  admin: "amber",
};

export function UsersTab() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ rows: UserRow[]; total: number } | null>(null);

  const params = useCallback(() => {
    const p: Record<string, string> = { take: String(TAKE), skip: String(skip) };
    if (q) p.q = q;
    if (role) p.role = role;
    return p;
  }, [q, role, skip]);

  const load = useCallback(() => {
    const qs = new URLSearchParams(params()).toString();
    api
      .get<{ rows: UserRow[]; total: number }>(`/admin/users?${qs}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, q]);

  const columns: Column<UserRow>[] = [
    {
      key: "user",
      header: "User",
      mobile: "title",
      cell: (u) => (
        <>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{u.name ?? "—"}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{u.phoneNumber}</p>
        </>
      ),
    },
    {
      key: "role",
      header: "Role",
      mobile: "trailing",
      cell: (u) => <Badge tone={ROLE_TONE[u.role] ?? "neutral"}>{ROLE_LABELS[u.role] ?? u.role}</Badge>,
    },
    {
      key: "shop",
      header: "Shop",
      cell: (u) => <ShopCell row={u} />,
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      cell: (u) => <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{u._count.requests}</span>,
    },
    {
      key: "deals",
      header: "Deals",
      align: "right",
      cell: (u) => <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{u._count.deals}</span>,
    },
    {
      key: "joined",
      header: "Joined",
      align: "right",
      mobile: "meta",
      cell: (u) => (
        <span className="whitespace-nowrap text-neutral-500 dark:text-neutral-400">
          {new Date(u.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
        </span>
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
          placeholder="Search name or phone…"
        />
        <Select
          value={role}
          onChange={(v) => {
            setRole(v);
            setSkip(0);
          }}
          allLabel="All roles"
          options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <ExportButton resource="users" params={params()} />
      </FilterBar>

      {!data ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="👤" title="No users match" />
      ) : (
        <>
          <RecordList
            columns={columns}
            rows={data.rows}
            rowKey={(u) => u.id}
            rowClassName={() => "hover:bg-neutral-50 dark:hover:bg-neutral-900/40"}
          />
          <Pager skip={skip} take={TAKE} total={data.total} onChange={setSkip} />
        </>
      )}
    </div>
  );
}

/**
 * A shop owner with no shop signed up and abandoned onboarding — the drop-off
 * is invisible on the Shops tab, because there is no row there to look at.
 * Worth calling out rather than showing the same "—" a customer gets.
 */
function ShopCell({ row }: { row: UserRow }) {
  if (row.shop) {
    return (
      <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span className="text-neutral-600 dark:text-neutral-300">{row.shop.shopName}</span>
        {row.shop.suspended && <Badge tone="amber">Suspended</Badge>}
        {row.shop.verified && <Badge tone="green">Verified</Badge>}
      </span>
    );
  }
  if (row.role === "shop_owner") {
    return (
      <span className="text-xs font-medium text-amber-700 dark:text-amber-400" title="Signed up but never completed shop onboarding">
        onboarding incomplete
      </span>
    );
  }
  return <span className="text-neutral-300 dark:text-neutral-600">—</span>;
}
