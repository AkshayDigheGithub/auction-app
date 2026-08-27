"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { categoryLabel, SHOP_CATEGORY_LABELS } from "@/lib/money";
import {
  Badge,
  ErrorBanner,
  ghostButtonClass,
  InfoBanner,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";
import { SectionTitle } from "./shared";

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  shopCategories: string[];
  sortOrder: number;
  active: boolean;
  /** Shops reachable through this category, counted once each (AUC-72). */
  shopCount: number;
  _count: { requests: number; children: number };
}

const SHOP_CATEGORY_VALUES = Object.keys(SHOP_CATEGORY_LABELS);

/** "Mobile Phones & Tablets" -> "mobile-phones-tablets", matching the API's slug rule. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/**
 * Product category management (AUC-72).
 *
 * The taxonomy is two levels deep and drives both the customer's picker and
 * category-aware matching, so every destructive-looking control here shows what
 * it touches first — an admin should never deactivate a category without seeing
 * the shops and requests behind it.
 */
export function CategoriesTab() {
  const [rows, setRows] = useState<ProductCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductCategory | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<ProductCategory[]>("/admin/product-categories")
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => {
        setRows([]);
        setError((e as Error).message);
      });
  }, []);
  useEffect(load, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (!rows) return <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading…</p>;

  const parents = rows.filter((r) => !r.parentId);
  const childrenOf = (id: string) => rows.filter((r) => r.parentId === id);

  /**
   * Move one category within its sibling group.
   *
   * The whole group is renumbered rather than swapping two `sortOrder` values:
   * seeded categories all sit at 0, where a swap would be a silent no-op. Only
   * the rows whose position actually changed are written, to keep the audit log
   * readable.
   */
  function reorder(row: ProductCategory, direction: -1 | 1) {
    const siblings = rows!.filter((r) => r.parentId === row.parentId);
    const from = siblings.findIndex((r) => r.id === row.id);
    const to = from + direction;
    if (to < 0 || to >= siblings.length) return;

    const next = [...siblings];
    [next[from], next[to]] = [next[to], next[from]];
    const changed = next.map((r, i) => ({ row: r, index: i })).filter((x) => x.row.sortOrder !== x.index);

    act(async () => {
      for (const { row: r, index } of changed) {
        await api.put(`/admin/product-categories/${r.id}`, { sortOrder: index });
      }
    });
  }

  function toggleActive(row: ProductCategory) {
    if (row.active) {
      const impact = [
        plural(row.shopCount, "shop"),
        plural(row._count.requests, "past request"),
        ...(row._count.children > 0
          ? [`${plural(row._count.children, "sub-category", "sub-categories")} (deactivated too)`]
          : []),
      ].join(" · ");
      const ok = confirm(
        `Deactivate "${row.name}"?\n\nAffects: ${impact}\n\n` +
          `Customers stop being offered it and shops stop being matched on it. ` +
          `Past requests keep the category — nothing is deleted.`,
      );
      if (!ok) return;
    }
    act(() => api.put(`/admin/product-categories/${row.id}/active`, { active: !row.active }));
  }

  function renderRow(row: ProductCategory, opts: { child?: boolean } = {}) {
    const siblings = rows!.filter((r) => r.parentId === row.parentId);
    const index = siblings.findIndex((r) => r.id === row.id);

    return (
      <div
        key={row.id}
        className={`flex flex-col gap-2 border-neutral-100 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 dark:border-neutral-800/60 ${
          opts.child ? "border-t pl-4 sm:pl-6" : ""
        } ${row.active ? "" : "opacity-55"}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{row.name}</span>
            <code className="text-xs text-neutral-400 dark:text-neutral-500">{row.slug}</code>
            {!row.active && <Badge tone="amber">Inactive</Badge>}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1">
            {row.shopCategories.map((c) => (
              <Badge key={c} tone="blue">
                {categoryLabel(c)}
              </Badge>
            ))}
          </div>

          <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            {plural(row.shopCount, "shop")} reachable · {plural(row._count.requests, "request")}
            {row._count.children > 0 && ` · ${plural(row._count.children, "sub-category", "sub-categories")}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            className={ghostButtonClass}
            disabled={busy || index === 0}
            onClick={() => reorder(row, -1)}
            aria-label={`Move ${row.name} up`}
            title="Move up"
          >
            ↑
          </button>
          <button
            className={ghostButtonClass}
            disabled={busy || index === siblings.length - 1}
            onClick={() => reorder(row, 1)}
            aria-label={`Move ${row.name} down`}
            title="Move down"
          >
            ↓
          </button>
          <button
            className={ghostButtonClass}
            disabled={busy}
            onClick={() => setEditing(editing !== "new" && editing?.id === row.id ? null : row)}
          >
            {editing !== "new" && editing?.id === row.id ? "Cancel" : "Edit"}
          </button>
          <button className={ghostButtonClass} disabled={busy} onClick={() => toggleActive(row)}>
            {row.active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <InfoBanner>
        Categories are <strong>never deleted</strong>, only deactivated. Past requests reference them, and removing one
        would rewrite what customers actually asked for. A deactivated category disappears from the customer picker and
        from matching, and takes its sub-categories with it.
      </InfoBanner>
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex justify-end">
        <button
          className={primaryButtonClass}
          disabled={busy}
          onClick={() => setEditing(editing === "new" ? null : "new")}
        >
          {editing === "new" ? "Cancel" : "New category"}
        </button>
      </div>

      {editing && (
        <CategoryEditor
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          all={rows}
          onDone={() => {
            setEditing(null);
            setError(null);
            load();
          }}
          onError={setError}
        />
      )}

      {parents.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">
          No categories yet. Add one to sharpen matching — until then every request falls back to shop-category level.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {parents.map((p) => (
            <div key={p.id}>
              {renderRow(p)}
              {childrenOf(p.id).map((c) => renderRow(c, { child: true }))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryEditor({
  category,
  all,
  onDone,
  onError,
}: {
  category: ProductCategory | null;
  all: ProductCategory[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // Only auto-fill the slug while it is still untouched. Once a category exists
  // its slug is a stable identifier, so editing never rewrites it from the name.
  const [slugTouched, setSlugTouched] = useState(category != null);
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [shopCategories, setShopCategories] = useState<string[]>(category?.shopCategories ?? []);
  const [busy, setBusy] = useState(false);

  // A category with children cannot itself become a child — the taxonomy is
  // deliberately two levels deep, and the API rejects it.
  const hasChildren = (category?._count.children ?? 0) > 0;
  const parentOptions = all.filter((r) => !r.parentId && r.id !== category?.id);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugValid = /^[a-z0-9-]+$/.test(effectiveSlug);
  const valid = name.trim().length >= 2 && slugValid && shopCategories.length > 0;

  function toggleShopCategory(value: string) {
    setShopCategories((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        slug: effectiveSlug,
        parentId: parentId === "" ? null : parentId,
        shopCategories,
      };
      if (category) await api.put(`/admin/product-categories/${category.id}`, payload);
      else await api.post("/admin/product-categories", payload);
      onDone();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <SectionTitle hint="Every change is recorded against your admin account in the audit log.">
        {category ? `Edit ${category.name}` : "New category"}
      </SectionTitle>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smartphones"
          />
        </label>
        <label className={labelClass}>
          Slug
          <input
            className={inputClass}
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="smartphones"
          />
        </label>
      </div>

      <label className={`${labelClass} mt-3`}>
        Parent category
        <select
          className={inputClass}
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          disabled={hasChildren}
        >
          <option value="">None — this is a top-level category</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {hasChildren && (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          This category has sub-categories, so it has to stay top-level. Move them out first to nest it.
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Served by shop categories</legend>
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          Which kinds of shop get woken up for a request in this category. At least one is required — a category that
          maps to nothing would silently match no shops.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SHOP_CATEGORY_VALUES.map((value) => {
            const on = shopCategories.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleShopCategory(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "bg-orange-600 text-white"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                }`}
              >
                {categoryLabel(value)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {category && (category.shopCount > 0 || category._count.requests > 0) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {plural(category.shopCount, "shop")} and {plural(category._count.requests, "past request")} sit behind this
          category. Changing the shop-category mapping changes who gets matched on future requests.
        </p>
      )}

      {!slugValid && effectiveSlug !== "" && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          Slug must be lowercase letters, numbers and hyphens only.
        </p>
      )}

      <button className={`${primaryButtonClass} mt-4 w-full sm:w-auto`} onClick={save} disabled={busy || !valid}>
        {busy ? "Saving…" : category ? "Save category" : "Create category"}
      </button>
    </div>
  );
}
