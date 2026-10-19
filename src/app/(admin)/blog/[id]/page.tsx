"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BlogPostEditor } from "@/components/blog/BlogPostEditor";
import { getApiErrorMessage } from "@/lib/axios";
import { fetchBlogPost } from "@/lib/api/blog";

export default function EditBlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-blog-post", id],
    queryFn: () => fetchBlogPost(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-white/70">{getApiErrorMessage(error, "Blog post not found")}</p>
        <Link href="/blog" className="text-sm text-[#98E32F] hover:underline">
          Back to all posts
        </Link>
      </div>
    );
  }

  return <BlogPostEditor key={data.id} post={data} />;
}
