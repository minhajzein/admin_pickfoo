"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/axios";
import {
  createBlogPost,
  updateBlogPost,
  uploadBlogImage,
  type AdminBlogPost,
  type BlogPostInput,
  type BlogPostStatus,
} from "@/lib/api/blog";

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://www.pickfoo.in";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** ISO string → value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

type FormState = Omit<BlogPostInput, "tags" | "slug"> & { slug: string; tagsText: string };

function initialState(post?: AdminBlogPost): FormState {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    coverImageUrl: post?.coverImageUrl ?? "",
    coverImageAlt: post?.coverImageAlt ?? "",
    author: post?.author ?? "Pickfoo Team",
    tagsText: (post?.tags ?? []).join(", "),
    status: post?.status ?? "draft",
    publishedAt: post?.publishedAt ?? null,
    metaTitle: post?.metaTitle ?? "",
    metaDescription: post?.metaDescription ?? "",
  };
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-white/80">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

export function BlogPostEditor({ post }: { post?: AdminBlogPost }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(() => initialState(post));
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((cur) => ({ ...cur, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async (statusOverride?: BlogPostStatus) => {
      const payload: BlogPostInput = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim(),
        content: form.content,
        coverImageUrl: form.coverImageUrl,
        coverImageAlt: form.coverImageAlt.trim(),
        author: form.author.trim(),
        tags: form.tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: statusOverride ?? form.status,
        publishedAt: form.publishedAt,
        metaTitle: form.metaTitle.trim(),
        metaDescription: form.metaDescription.trim(),
      };
      return post ? updateBlogPost(post.id, payload) : createBlogPost(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      queryClient.setQueryData(["admin-blog-post", saved.id], saved);
      setForm(initialState(saved));
      toast.success(saved.status === "published" ? "Post published" : "Draft saved");
      if (!post) router.replace(`/blog/${saved.id}`);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Failed to save post"));
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { staticUrl } = await uploadBlogImage(file);
      set("coverImageUrl", staticUrl);
      toast.success("Cover image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saving = saveMutation.isPending;
  const canSave = form.title.trim().length > 0 && !saving && !uploading;
  const isLive =
    post?.status === "published" &&
    !!post.publishedAt &&
    new Date(post.publishedAt).getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/blog">
              <ArrowLeft className="mr-1 h-4 w-4" />
              All posts
            </Link>
          </Button>
          <h2 className="text-2xl font-bold tracking-tight">
            {post ? "Edit post" : "New post"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {isLive ? (
            <Button asChild variant="outline">
              <a href={`${WEBSITE_URL}/blog/${post.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View on website
              </a>
            </Button>
          ) : null}
          {form.status === "published" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={!canSave}
                onClick={() => saveMutation.mutate("draft")}
              >
                Unpublish
              </Button>
              <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate(undefined)}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={!canSave}
                onClick={() => saveMutation.mutate("draft")}
              >
                Save draft
              </Button>
              <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate("published")}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-white/10 bg-[#002833] lg:col-span-2">
          <CardContent className="space-y-5 pt-6">
            <Field label="Title" htmlFor="blog-title">
              <Input
                id="blog-title"
                value={form.title}
                maxLength={200}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((cur) => ({
                    ...cur,
                    title,
                    slug: slugTouched ? cur.slug : slugify(title),
                  }));
                }}
                placeholder="The best biriyani spots in Mananthavady"
              />
            </Field>
            <Field
              label="URL slug"
              htmlFor="blog-slug"
              hint={`${WEBSITE_URL}/blog/${form.slug || "your-post-slug"}`}
            >
              <Input
                id="blog-slug"
                value={form.slug}
                maxLength={120}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field
              label="Excerpt"
              htmlFor="blog-excerpt"
              hint="Short summary shown on the blog list and in search results."
            >
              <Textarea
                id="blog-excerpt"
                value={form.excerpt}
                maxLength={500}
                rows={3}
                onChange={(e) => set("excerpt", e.target.value)}
              />
            </Field>
            <Field
              label="Content"
              htmlFor="blog-content"
              hint="Markdown supported: ## Heading, **bold**, *italic*, [link](https://…), - lists, > quotes, ![alt](image-url)."
            >
              <Textarea
                id="blog-content"
                value={form.content}
                rows={24}
                className="font-mono text-sm"
                onChange={(e) => set("content", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-[#002833]">
            <CardHeader>
              <CardTitle className="text-base">Cover image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.coverImageUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.coverImageUrl}
                    alt={form.coverImageAlt || "Cover preview"}
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => set("coverImageUrl", "")}
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-red-300 hover:text-red-200"
                    aria-label="Remove cover image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                {form.coverImageUrl ? "Replace image" : "Upload image"}
              </Button>
              <Field label="Alt text" htmlFor="blog-cover-alt">
                <Input
                  id="blog-cover-alt"
                  value={form.coverImageAlt}
                  maxLength={200}
                  onChange={(e) => set("coverImageAlt", e.target.value)}
                  placeholder="Describe the image"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#002833]">
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Author" htmlFor="blog-author">
                <Input
                  id="blog-author"
                  value={form.author}
                  maxLength={100}
                  onChange={(e) => set("author", e.target.value)}
                />
              </Field>
              <Field label="Tags" htmlFor="blog-tags" hint="Comma separated, up to 10.">
                <Input
                  id="blog-tags"
                  value={form.tagsText}
                  onChange={(e) => set("tagsText", e.target.value)}
                  placeholder="Wayanad, Food guide"
                />
              </Field>
              <Field
                label="Publish date"
                htmlFor="blog-published-at"
                hint="Leave empty to use the moment you publish. A future date schedules the post."
              >
                <Input
                  id="blog-published-at"
                  type="datetime-local"
                  value={toLocalInput(form.publishedAt)}
                  onChange={(e) => set("publishedAt", fromLocalInput(e.target.value))}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#002833]">
            <CardHeader>
              <CardTitle className="text-base">SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Meta title" htmlFor="blog-meta-title" hint="Defaults to the post title.">
                <Input
                  id="blog-meta-title"
                  value={form.metaTitle}
                  maxLength={200}
                  onChange={(e) => set("metaTitle", e.target.value)}
                />
              </Field>
              <Field
                label="Meta description"
                htmlFor="blog-meta-description"
                hint="Defaults to the excerpt. Aim for 150–160 characters."
              >
                <Textarea
                  id="blog-meta-description"
                  value={form.metaDescription}
                  maxLength={320}
                  rows={3}
                  onChange={(e) => set("metaDescription", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
