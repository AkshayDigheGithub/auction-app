import type { ReactNode } from "react";
import { devanagari } from "@/lib/fonts";

/**
 * Everything under /hi gets the Devanagari face.
 *
 * Scoped to this segment rather than the root layout so the English pages do
 * not download a font they never render. The `lang` attribute itself is set on
 * the article, not here: only the root layout owns <html>, and a wrapper div
 * claiming hi-IN around a shared header and footer written in English would be
 * a worse signal than none.
 */
export default function HindiLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${devanagari.variable} font-[family-name:var(--font-devanagari)]`}>
      {children}
    </div>
  );
}
