import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";

/**
 * The shared link-preview card.
 *
 * This is the one piece of the blog most people will see and never read. These
 * posts get shared into WhatsApp groups of shop owners, where a link with no
 * preview looks like spam and a link with one looks like something a person
 * sent on purpose. That is the whole job: be recognisably ours, and say what
 * the post is about at thumbnail size.
 *
 * Rendered by Satori through next/og, which supports a subset of CSS — flex
 * only, no grid, no line clamping — hence the explicit `display: "flex"` on
 * everything with more than one child.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const INK_900 = "#1c1917";
const INK_500 = "#78716c";
const INK_200 = "#e7e3dd";
const BRAND_600 = "#ea580c";
const BRAND_700 = "#c2410c";

/**
 * The card's typeface, committed to the repo rather than fetched.
 *
 * Noto Sans Devanagari covers both scripts, so one family serves the English
 * and Hindi cards and the two look like the same publication. It is bundled
 * because next/og has to be handed a font: its built-in default is fetched at
 * render time, which fails in any environment without open egress, and a
 * build-time download from a font CDN would put a deploy at the mercy of
 * someone else's bad minute. 440KB in the repo buys a card that always renders.
 *
 * Noto Sans Devanagari, SIL Open Font License 1.1 — https://fonts.google.com/noto
 */
const FONT_DIR = join(process.cwd(), "src/assets/fonts");

export interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

export const FONT_FAMILY = "Noto Sans Devanagari";

export function ogFonts(): OgFont[] {
  return [400, 700].map((weight) => ({
    name: FONT_FAMILY,
    data: readFileSync(join(FONT_DIR, `NotoSansDevanagari-${weight}.ttf`)),
    weight: weight as 400 | 700,
    style: "normal" as const,
  }));
}

function Wordmark({ fontFamily }: { fontFamily: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 68,
          height: 68,
          borderRadius: 18,
          background: BRAND_600,
        }}
      >
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
          <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" strokeLinejoin="round" />
          <path d="m9 10 2.2 2.4L15 8.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: INK_900, fontFamily }}>
        mivikto.store
      </div>
    </div>
  );
}

export function OgCard({
  eyebrow,
  title,
  highlight,
  footer,
  fontFamily,
  script = "latin",
}: {
  eyebrow: string;
  title: string;
  /** The single number worth seeing at thumbnail size. Optional. */
  highlight?: { value: string; label: string };
  footer: string;
  fontFamily: string;
  /**
   * Which script the text is in. Only typography depends on this.
   *
   * Devanagari is not Latin with different letters: tracking pulls apart glyph
   * clusters that are meant to sit together, so the letter-spacing that makes
   * the Latin eyebrow look deliberate makes the Hindi one look broken, and the
   * negative tracking that tightens a Latin headline does the same to a
   * Devanagari one. It also hangs matras above and below the baseline, so it
   * needs more leading before two lines start colliding.
   */
  script?: "latin" | "devanagari";
}): ReactElement {
  const devanagari = script === "devanagari";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        background: "linear-gradient(135deg, #fff7ed 0%, #faf9f7 58%)",
        fontFamily,
      }}
    >
      {/* The brand orange has to survive being shrunk to a chat thumbnail, so
          it gets a full-bleed edge rather than only the logo tile. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 12,
          background: BRAND_600,
        }}
      />

      <Wordmark fontFamily={fontFamily} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: devanagari ? 0 : 3,
            textTransform: "uppercase",
            color: BRAND_600,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 62,
            fontWeight: 700,
            lineHeight: devanagari ? 1.32 : 1.12,
            letterSpacing: devanagari ? 0 : -1,
            color: INK_900,
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderTop: `2px solid ${INK_200}`,
          paddingTop: 28,
        }}
      >
        {highlight ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <div style={{ fontSize: 68, fontWeight: 700, color: BRAND_700, letterSpacing: -2 }}>
              {highlight.value}
            </div>
            <div style={{ fontSize: 26, color: INK_500 }}>{highlight.label}</div>
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div style={{ fontSize: 24, color: INK_500 }}>{footer}</div>
      </div>
    </div>
  );
}
