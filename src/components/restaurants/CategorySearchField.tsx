"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  fetchCategories,
  type AdminCategory,
} from "@/lib/api/menu";

export function categoryParentId(
  cat: Pick<AdminCategory, "parent">,
): string | null {
  const p = cat.parent;
  if (!p) return null;
  if (typeof p === "string") return p;
  if (typeof p === "object" && p._id) return String(p._id);
  return null;
}

export function categoryParentName(
  cat: Pick<AdminCategory, "parent">,
): string | null {
  const p = cat.parent;
  if (!p || typeof p !== "object") return null;
  return p.name?.trim() || null;
}

export function categoryDisplayPath(cat: AdminCategory): string {
  const parentName = categoryParentName(cat);
  return parentName ? `${parentName} › ${cat.name}` : cat.name;
}

type Props = {
  /** Selected value: category name (default) or category `_id` when valueKey="_id". */
  value: string;
  onChange: (value: string, category?: AdminCategory | null) => void;
  placeholder?: string;
  /** Use `_id` when picking a parent category. */
  valueKey?: "name" | "_id";
  /** Optional label shown when closed and valueKey is `_id`. */
  displayValue?: string;
  /** Show a root option (for parent picker). */
  allowRoot?: boolean;
  rootLabel?: string;
  /** Exclude a category id (e.g. itself when editing parent). */
  excludeId?: string;
};

export function CategorySearchField({
  value,
  onChange,
  placeholder = "Search categories...",
  valueKey = "name",
  displayValue,
  allowRoot = false,
  rootLabel = "No Parent (Root Category)",
  excludeId,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closedLabel =
    valueKey === "_id"
      ? value
        ? displayValue || value
        : allowRoot
          ? rootLabel
          : ""
      : value;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await fetchCategories({
          search: query.trim(),
          limit: 40,
        });
        if (!cancelled) {
          setResults(
            excludeId ? rows.filter((c) => c._id !== excludeId) : rows,
          );
          setSearched(true);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, excludeId]);

  const emptyHint = useMemo(() => {
    if (loading) return null;
    if (!searched) return null;
    if (results.length > 0) return null;
    if (query.trim()) return `No categories match “${query.trim()}”`;
    return "Type to search categories";
  }, [loading, searched, results.length, query]);

  const isSelected = (cat: AdminCategory) =>
    valueKey === "_id" ? cat._id === value : cat.name === value;

  return (
    <div ref={rootRef} className="relative mt-1">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
          size={14}
        />
        <Input
          value={open ? query : closedLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={placeholder}
          className="pl-9 pr-16 bg-white/5 border-white/10 text-white"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {(value || (allowRoot && valueKey === "_id" && !value && open)) &&
          value ? (
            <button
              type="button"
              className="p-1 text-white/40 hover:text-white"
              title="Clear"
              onClick={() => {
                onChange("", null);
                setQuery("");
                setOpen(true);
              }}
            >
              <X size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="p-1 text-white/40 hover:text-white"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronsUpDown size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#002833] shadow-xl">
          {allowRoot && (
            <button
              type="button"
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#98E32F]/15 transition-colors border-b border-white/5 ${
                !value
                  ? "bg-[#98E32F]/20 text-[#98E32F] font-semibold"
                  : "text-white/80"
              }`}
              onClick={() => {
                onChange("", null);
                setOpen(false);
              }}
            >
              {rootLabel}
            </button>
          )}
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-white/50">
              <Loader2 size={14} className="animate-spin text-[#98E32F]" />
              Searching...
            </div>
          )}
          {!loading && emptyHint && (
            <p className="px-3 py-3 text-xs text-white/40">{emptyHint}</p>
          )}
          {!loading &&
            results.map((cat) => {
              const path = categoryDisplayPath(cat);
              const parentName = categoryParentName(cat);
              return (
                <button
                  key={cat._id}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#98E32F]/15 transition-colors ${
                    isSelected(cat)
                      ? "bg-[#98E32F]/20 text-[#98E32F] font-semibold"
                      : "text-white"
                  }`}
                  onClick={() => {
                    onChange(valueKey === "_id" ? cat._id : cat.name, cat);
                    setOpen(false);
                  }}
                >
                  <span className="block truncate">{cat.name}</span>
                  {parentName ? (
                    <span className="block text-[10px] text-white/40 truncate mt-0.5">
                      under {parentName}
                    </span>
                  ) : (
                    <span className="block text-[10px] text-white/30 mt-0.5">
                      Root category
                    </span>
                  )}
                  <span className="sr-only">{path}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
