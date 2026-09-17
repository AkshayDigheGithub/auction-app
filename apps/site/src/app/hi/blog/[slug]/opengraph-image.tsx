import { blogOgImage, ogImageParams } from "@/components/blog-og-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt = "mivikto.store — दुकानदारों के लिए गाइड";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return ogImageParams();
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return blogOgImage(slug, "hi");
}
