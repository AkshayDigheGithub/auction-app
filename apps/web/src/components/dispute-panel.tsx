"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  DISPUTE_REASON_LABEL,
  DISPUTE_STATUS_TONE,
  type Dispute,
  type DisputeReason,
} from "@/lib/disputes";
import { Badge, ErrorBanner, ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

interface DisputeContext {
  reasons: DisputeReason[];
  reasonsRequiringDetails: DisputeReason[];
  detailsMinLength: number;
  windowDays: number;
  canRaise: boolean;
  mine: Dispute | null;
}

/**
 * Raising a conduct dispute on a deal (AUC-34).
 *
 * Deliberately separate from the "I didn't buy" report next to it: that one
 * asks for a fee to be reversed, this one says the shop behaved badly. Rolling
 * them together would mean a complaint about a shop quietly disappears in
 * shadow mode, where there is no fee to reverse.
 *
 * The reason list comes from the API rather than being hardcoded here, because
 * which reasons are permitted depends on which side of the deal you are on.
 */
export function DisputePanel({ dealId }: { dealId: string }) {
  const [ctx, setCtx] = useState<DisputeContext | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<DisputeContext>(`/deals/${dealId}/disputes/context`)
      .then(setCtx)
      .catch(() => setCtx(null));
  }, [dealId]);

  useEffect(load, [load]);

  if (!ctx) return null;

  const needsDetails = reason !== "" && ctx.reasonsRequiringDetails.includes(reason);
  const detailsTooShort = needsDetails && details.trim().length < ctx.detailsMinLength;

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/deals/${dealId}/disputes`, {
        reason,
        details: details.trim() || undefined,
      });
      setOpen(false);
      setReason("");
      setDetails("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your report");
    } finally {
      setBusy(false);
    }
  }

  if (ctx.mine) {
    return (
      <div className="flex flex-col gap-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {DISPUTE_REASON_LABEL[ctx.mine.reason]}
          </span>
          <Badge tone={DISPUTE_STATUS_TONE[ctx.mine.status]}>{ctx.mine.status}</Badge>
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {ctx.mine.status === "open"
            ? "We're looking into this."
            : ctx.mine.resolutionNote || "This has been reviewed."}
        </p>
      </div>
    );
  }

  if (!ctx.canRaise) return null;

  if (!open) {
    return (
      <button
        className="text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
        onClick={() => setOpen(true)}
      >
        Report a problem with this shop
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-left">
      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        What went wrong?
        <select
          className={`${inputClass} mt-1.5`}
          value={reason}
          onChange={(e) => setReason(e.target.value as DisputeReason)}
          autoFocus
        >
          <option value="">Choose one…</option>
          {ctx.reasons.map((r) => (
            <option key={r} value={r}>
              {DISPUTE_REASON_LABEL[r]}
            </option>
          ))}
        </select>
      </label>

      {reason !== "" && (
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {needsDetails ? "Tell us what happened" : "Anything to add? (optional)"}
          <textarea
            className={`${inputClass} mt-1.5 min-h-20`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="The shop quoted ₹12,000 but asked for ₹13,500 when I arrived"
          />
        </label>
      )}

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex gap-2">
        <button
          className={`${primaryButtonClass} flex-1`}
          onClick={submit}
          disabled={busy || !reason || detailsTooShort}
        >
          {busy ? "Sending…" : "Send report"}
        </button>
        <button className={ghostButtonClass} onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Goes to our team, not the shop. You can report a deal for up to {ctx.windowDays} days.
      </p>
    </div>
  );
}
