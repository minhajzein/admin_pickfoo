import api, { getApiErrorMessage } from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type BlogPostStatus = "draft" | "published";

export type BlogFaq = { question: string; answer: string };

export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  faqs?: BlogFaq[];
  coverImageUrl: string;
  coverImageAlt: string;
  author: string;
  tags: string[];
  status: BlogPostStatus;
  publishedAt: string | null;
  metaTitle: string;
  metaDescription: string;
  createdAt?: string;
  updatedAt?: string;
}

export type BlogPostInput = {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  faqs: BlogFaq[];
  coverImageUrl: string;
  coverImageAlt: string;
  author: string;
  tags: string[];
  status: BlogPostStatus;
  publishedAt: string | null;
  metaTitle: string;
  metaDescription: string;
};

type ItemResponse = { success: boolean; data?: AdminBlogPost; message?: string };

export async function fetchBlogPosts(params?: {
  page?: number;
  limit?: number;
  status?: BlogPostStatus | "all";
  search?: string;
}): Promise<PaginatedResult<AdminBlogPost>> {
  const { data } = await api.get("/blog", {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
      ...(params?.status && params.status !== "all" ? { status: params.status } : {}),
      ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
    },
  });
  return parsePaginatedResponse<AdminBlogPost>(data);
}

export async function fetchBlogPost(id: string): Promise<AdminBlogPost> {
  const { data } = await api.get<ItemResponse>(`/blog/${id}`);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Blog post not found");
  }
  return data.data;
}

export async function createBlogPost(input: BlogPostInput): Promise<AdminBlogPost> {
  const { data } = await api.post<ItemResponse>("/blog", input);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to create blog post");
  }
  return data.data;
}

export async function updateBlogPost(
  id: string,
  patch: Partial<BlogPostInput>,
): Promise<AdminBlogPost> {
  const { data } = await api.patch<ItemResponse>(`/blog/${id}`, patch);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to update blog post");
  }
  return data.data;
}

export async function deleteBlogPost(id: string): Promise<void> {
  await api.delete(`/blog/${id}`);
}

export async function uploadBlogImage(
  file: File,
): Promise<{ staticUrl: string; fileUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  try {
    const { data } = await api.post<{
      success: boolean;
      data?: { fileUrl?: string; staticUrl?: string };
      message?: string;
    }>("/blog/upload", form, { timeout: 120_000 });
    if (!data.success || !data.data?.staticUrl) {
      throw new Error(data.message || "Upload failed");
    }
    return {
      staticUrl: data.data.staticUrl,
      fileUrl: data.data.fileUrl || data.data.staticUrl,
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Upload failed"));
  }
}
