"use client";

import { useEffect } from "react";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";

/**
 * Route-level error boundary for the app.
 *
 * Without one, an unhandled render error in production shows Next's bare
 * "Application error: a client-side exception has occurred" — no way back, and
 * inside an installed PWA no address bar to escape from either. A shop owner
 * mid-bid reads that as the product losing their work.
 *
 * `reset()` re-renders the segment without a full reload, which matters here:
 * a reload drops the Socket.io connection and the live bid feed has to
 * re-subscribe, so retrying in place is the cheaper recovery.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing is wired to an error reporter yet (AUC-37). Until then the
    // console is the only trail, and `digest` is the id that correlates with
    // the server-side log entry.
    console.error("Unhandled app error", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="text-4xl" aria-hidden="true">
        ⚠️
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Something went wrong
        </h1>
        <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          This screen failed to load. Nothing you had already sent — a request, a bid, a confirmed deal — is affected.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-neutral-400 dark:text-neutral-500">
            Reference: {error.digest}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <button type="button" onClick={reset} className={primaryButtonClass}>
          Try again
        </button>
        <Link href="/" className={`${secondaryButtonClass} text-center`}>
          Home
        </Link>
      </div>
    </main>
  );
}
