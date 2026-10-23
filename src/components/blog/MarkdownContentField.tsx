"use client";

import { useRef, useState, type ComponentType } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Table,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { uploadBlogImage } from "@/lib/api/blog";
import {
  hasRichFormatting,
  htmlToMarkdown,
  normalizePostMarkdown,
  tableMarkdown,
} from "@/lib/blog-markdown";

const markdownComponents = {
  table: (props: React.ComponentProps<"table">) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

type Edit = { text: string; selStart: number; selEnd: number };

function lineBounds(value: string, start: number, end: number) {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const nl = value.indexOf("\n", end);
  return { from, to: nl === -1 ? value.length : nl };
}

function wrap(value: string, start: number, end: number, marker: string, placeholder: string): Edit {
  const selected = value.slice(start, end) || placeholder;
  const text = value.slice(0, start) + marker + selected + marker + value.slice(end);
  const selStart = start + marker.length;
  return { text, selStart, selEnd: selStart + selected.length };
}

/** Apply a line prefix (heading, list, quote) to every selected line, toggling it off if already set. */
function prefixLines(
  value: string,
  start: number,
  end: number,
  prefixFor: (index: number) => string,
  pattern: RegExp,
): Edit {
  const { from, to } = lineBounds(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const allSet = lines.every((l) => pattern.test(l));
  const next = lines
    .map((l, i) => {
      const bare = l.replace(/^(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, "");
      return allSet ? bare : prefixFor(i) + bare;
    })
    .join("\n");
  const text = value.slice(0, from) + next + value.slice(to);
  return { text, selStart: from, selEnd: from + next.length };
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function MarkdownContentField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [tablePicker, setTablePicker] = useState<{ rows: number; cols: number } | null>(null);

  const apply = (edit: (v: string, s: number, e: number) => Edit) => {
    const el = textareaRef.current;
    if (!el) return;
    const result = edit(value, el.selectionStart, el.selectionEnd);
    onChange(result.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selStart, result.selEnd);
    });
  };

  const insertAtCursor = (snippet: string) =>
    apply((v, s, e) => {
      const text = v.slice(0, s) + snippet + v.slice(e);
      const pos = s + snippet.length;
      return { text, selStart: pos, selEnd: pos };
    });

  const insertBlock = (block: string) =>
    apply((v, s, e) => {
      const before = v.slice(0, s);
      const lead = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
      const snippet = `${lead}${block}\n\n`;
      const text = before + snippet + v.slice(e);
      const pos = s + snippet.length;
      return { text, selStart: pos, selEnd: pos };
    });

  const addLink = () => {
    const url = window.prompt("Link URL", "https://");
    if (!url || url === "https://") return;
    apply((v, s, e) => {
      const label = v.slice(s, e) || "link text";
      const snippet = `[${label}](${url.trim()})`;
      const text = v.slice(0, s) + snippet + v.slice(e);
      return { text, selStart: s + 1, selEnd: s + 1 + label.length };
    });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const { staticUrl } = await uploadBlogImage(file);
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      insertBlock(`![${alt}](${staticUrl})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html || !hasRichFormatting(html)) return;
    const markdown = htmlToMarkdown(html);
    if (!markdown) return;
    e.preventDefault();
    insertAtCursor(markdown);
  };

  return (
    <div className="overflow-hidden rounded-md border border-input">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/3 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            label="Heading"
            icon={Heading2}
            disabled={tab === "preview"}
            onClick={() => apply((v, s, e) => prefixLines(v, s, e, () => "## ", /^##\s/))}
          />
          <ToolbarButton
            label="Subheading"
            icon={Heading3}
            disabled={tab === "preview"}
            onClick={() => apply((v, s, e) => prefixLines(v, s, e, () => "### ", /^###\s/))}
          />
          <ToolbarButton
            label="Bold"
            icon={Bold}
            disabled={tab === "preview"}
            onClick={() => apply((v, s, e) => wrap(v, s, e, "**", "bold text"))}
          />
          <ToolbarButton
            label="Italic"
            icon={Italic}
            disabled={tab === "preview"}
            onClick={() => apply((v, s, e) => wrap(v, s, e, "*", "italic text"))}
          />
          <ToolbarButton label="Link" icon={Link2} disabled={tab === "preview"} onClick={addLink} />
          <ToolbarButton
            label="Bulleted list"
            icon={List}
            disabled={tab === "preview"}
            onClick={() => apply((v, s, e) => prefixLines(v, s, e, () => "- ", /^[-*+]\s/))}
          />
          <ToolbarButton
            label="Numbered list"
            icon={ListOrdered}
            disabled={tab === "preview"}
            onClick={() =>
              apply((v, s, e) => prefixLines(v, s, e, (i) => `${i + 1}. `, /^\d+[.)]\s/))
            }
          />
          <ToolbarButton
            label="Quote"
            icon={Quote}
            disabled={tab === "preview"}
            onClick={() => apply((v, s, e) => prefixLines(v, s, e, () => "> ", /^>\s?/))}
          />
          <div className="relative">
            <ToolbarButton
              label="Insert table"
              icon={Table}
              disabled={tab === "preview"}
              onClick={() => setTablePicker((cur) => (cur ? null : { rows: 3, cols: 3 }))}
            />
            {tablePicker ? (
              <div className="absolute left-0 top-full z-20 mt-1 w-52 space-y-3 rounded-md border border-white/10 bg-[#002833] p-3 shadow-lg">
                {(["rows", "cols"] as const).map((key) => (
                  <label key={key} className="flex items-center justify-between gap-2 text-xs text-white/70">
                    {key === "rows" ? "Rows (excl. header)" : "Columns"}
                    <input
                      type="number"
                      min={1}
                      max={key === "rows" ? 30 : 8}
                      value={tablePicker[key]}
                      onChange={(e) =>
                        setTablePicker((cur) =>
                          cur
                            ? {
                                ...cur,
                                [key]: Math.min(
                                  key === "rows" ? 30 : 8,
                                  Math.max(1, Number(e.target.value) || 1),
                                ),
                              }
                            : cur,
                        )
                      }
                      className="w-14 rounded border border-white/10 bg-transparent px-2 py-1 text-white"
                    />
                  </label>
                ))}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTablePicker(null)}
                    className="rounded px-2 py-1 text-xs text-white/60 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      insertBlock(tableMarkdown(tablePicker.rows, tablePicker.cols));
                      setTablePicker(null);
                    }}
                    className="rounded bg-[#98E32F] px-3 py-1 text-xs font-semibold text-[#013644]"
                  >
                    Insert
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <ToolbarButton
            label="Insert image"
            icon={uploading ? Loader2 : ImagePlus}
            disabled={tab === "preview" || uploading}
            onClick={() => imageInputRef.current?.click()}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadImage(file);
            }}
          />
        </div>
        <div className="flex gap-1 rounded-md border border-white/10 p-0.5">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                tab === t ? "bg-[#98E32F] text-[#013644]" : "text-white/60 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "write" ? (
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          rows={24}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder="Write your post, or paste it from Google Docs / Word. Headings, bold, lists, links and tables are kept."
          className="rounded-none border-0 font-mono text-sm focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-135 px-5 py-4">
          {value.trim() ? (
            <div className="prose prose-invert max-w-none prose-p:text-white/85 prose-li:text-white/85 prose-strong:text-current prose-a:text-[#98E32F] prose-img:rounded-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {normalizePostMarkdown(value)}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-white/40">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
