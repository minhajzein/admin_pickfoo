export type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom" },
];

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday as start of week (local calendar). */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfLocalDay(
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff),
  );
}

export function rangeForPreset(preset: DatePreset): {
  from?: string;
  to?: string;
} {
  const now = new Date();
  const today = startOfLocalDay(now);

  switch (preset) {
    case "all":
      return {};
    case "today":
      return { from: toYmd(today), to: toYmd(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: toYmd(y), to: toYmd(y) };
    }
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: toYmd(start), to: toYmd(today) };
    }
    case "this_week": {
      const start = startOfWeekMonday(today);
      return { from: toYmd(start), to: toYmd(today) };
    }
    case "last_week": {
      const thisWeekStart = startOfWeekMonday(today);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      return { from: toYmd(lastWeekStart), to: toYmd(lastWeekEnd) };
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toYmd(start), to: toYmd(today) };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "this_year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { from: toYmd(start), to: toYmd(today) };
    }
    default:
      return {};
  }
}

export function periodLabelFor(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): string {
  if (preset === "all") return "All time";
  if (preset === "custom") {
    if (customFrom && customTo) return `${customFrom} → ${customTo}`;
    if (customFrom) return `From ${customFrom}`;
    if (customTo) return `Until ${customTo}`;
    return "Custom range";
  }
  return DATE_PRESETS.find((p) => p.id === preset)?.label ?? "Period";
}
