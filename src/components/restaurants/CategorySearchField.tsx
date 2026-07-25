"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  fetchCategories,
  type AdminCategory,
} from "@/lib/api/menu";

type Props = {
  value: string;
  onChange: (categoryName: string) => void;
  placeholder?: string;
};

export function CategorySearchField({
  value,
  onChange,
  placeholder = "Search categories...",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Keep input in sync when parent sets value (edit / clear).
  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, value]);

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
          setResults(rows);
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
  }, [open, query]);

  const emptyHint = useMemo(() => {
    if (loading) return null;
    if (!searched) return null;
    if (results.length > 0) return null;
    if (query.trim()) return `No categories match “${query.trim()}”`;
    return "Type to search categories";
  }, [loading, searched, results.length, query]);

  return (
    <div ref={rootRef} className="relative mt-1">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
          size={14}
        />
        <Input
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(value);
          }}
          placeholder={placeholder}
          className="pl-9 pr-16 bg-white/5 border-white/10 text-white"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value ? (
            <button
              type="button"
              className="p-1 text-white/40 hover:text-white"
              title="Clear category"
              onClick={() => {
                onChange("");
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
            onClick={() => {
              if (open) {
                setOpen(false);
                setQuery(value);
              } else {
                setOpen(true);
                setQuery(value);
              }
            }}
          >
            <ChevronsUpDown size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#002833] shadow-xl">
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
            results.map((cat) => (
              <button
                key={cat._id}
                type="button"
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#98E32F]/15 transition-colors ${
                  cat.name === value
                    ? "bg-[#98E32F]/20 text-[#98E32F] font-semibold"
                    : "text-white"
                }`}
                onClick={() => {
                  onChange(cat.name);
                  setQuery(cat.name);
                  setOpen(false);
                }}
              >
                {cat.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
