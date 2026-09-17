import { Noto_Sans_Devanagari } from "next/font/google";

/**
 * Devanagari face, loaded only by the Hindi routes.
 *
 * Inter carries no Devanagari, so without this the Hindi post falls back to
 * whatever the device happens to have — which on Android is usually fine and on
 * older Windows is a noticeably worse-looking page than the English version.
 * The whole point of publishing in Hindi is that it does not read as the
 * afterthought translation, so it gets a real typeface.
 *
 * Imported from its own module rather than the root layout so English visitors
 * never pay for a font they cannot see.
 */
export const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
