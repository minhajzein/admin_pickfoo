"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import { getApiErrorMessage } from "@/lib/axios";
import {
  deleteBlogPost,
  fetchBlogPosts,
  type AdminBlogPost,
  type BlogPostStatus,
} from "@/lib/api/blog";

const PAGE_SIZE = 15;
const STATUS_FILTERS: Array<{ value: BlogPostStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isScheduled(post: AdminBlogPost): boolean {
  return (
    post.status === "published" &&
    !!post.publishedAt &&
    new Date(post.publishedAt).getTime() > Date.now()
  );
}

export default function BlogPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BlogPostStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminBlogPost | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      startTransition(() => {
        setSearch(searchInput);
        setPage(1);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blog", page, status, search],
    queryFn: () => fetchBlogPosts({ page, limit: PAGE_SIZE, status, search }),
    placeholderData: keepPreviousData,
  });

  const posts = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      toast.success("Post deleted");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Failed to delete post"));
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Blog</h2>
          <p className="mt-1 text-sm text-white/60">
            Write and publish journal posts for www.pickfoo.in/blog. Published
            posts appear on the website within a minute.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/blog/new">
            <Plus className="mr-2 h-4 w-4" />
            New post
          </Link>
        </Button>
      </div>

      <Card className="border-white/10 bg-[#002833]">
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Posts
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex gap-1 rounded-lg border border-white/10 p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() =>
                    startTransition(() => {
                      setStatus(f.value);
                      setPage(1);
                    })
                  }
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    status === f.value
                      ? "bg-[#98E32F] text-[#013644]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, slug or tag"
              className="sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
            </div>
          ) : posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">
              No posts found. Click{" "}
              <strong className="text-white/80">New post</strong> to write one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-sm">
                      <Link
                        href={`/blog/${post.id}`}
                        className="font-medium hover:text-[#98E32F]"
                      >
                        {post.title}
                      </Link>
                      <div className="truncate text-xs text-white/50">
                        /blog/{post.slug}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-white/60">
                      {post.tags.length ? post.tags.join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      {isScheduled(post) ? (
                        <Badge variant="secondary">Scheduled</Badge>
                      ) : (
                        <Badge
                          variant={post.status === "published" ? "default" : "outline"}
                        >
                          {post.status === "published" ? "Published" : "Draft"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-white/60">
                      {formatDate(post.publishedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-white/60">
                      {formatDate(post.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/blog/${post.id}`}>
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-400 hover:text-red-300"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(post)}
                          aria-label={`Delete ${post.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <ListPagination
            page={page}
            limit={PAGE_SIZE}
            total={data?.total ?? 0}
            totalPages={data?.totalPages ?? 1}
            onPageChange={(next) => startTransition(() => setPage(next))}
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="border-white/10 bg-[#002833] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Delete post?</DialogTitle>
            <DialogDescription className="text-white/50">
              This permanently removes{" "}
              <span className="text-white/80">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>{" "}
              from the website. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
