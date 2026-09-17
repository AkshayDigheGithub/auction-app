import { blogIndexOgImage } from "@/components/blog-og-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt = "mivikto.store — guides for shop owners";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return blogIndexOgImage("en");
}
