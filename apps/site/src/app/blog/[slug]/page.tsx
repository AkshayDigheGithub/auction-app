import type { Metadata } from "next";
import { PostPage, postPageMetadata, postParams } from "@/components/blog-post-page";

export function generateStaticParams() {
  return postParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return postPageMetadata(slug, "en");
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PostPage slug={slug} locale="en" />;
}
