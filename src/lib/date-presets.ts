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

const IST = "Asia/Kolkata";

/** IST calendar day as YYYY-MM-DD (matches admin-api date filters). */
export function toYmdIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function toYmd(d: Date): string {
  return toYmdIst(d);
}

export function startOfLocalDay(d: Date): Date {
  const ymd = toYmdIst(d);
  return new Date(`${ymd}T00:00:00+05:30`);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return toYmdIst(new Date(Date.UTC(y, m - 1, d + days, 6, 30, 0)));
}

function weekdayIst(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 6, 30, 0)).getUTCDay();
}

/** Monday as start of week (IST calendar). */
export function startOfWeekMonday(d: Date): Date {
  const ymd = toYmdIst(d);
  const dow = weekdayIst(ymd);
  const diff = dow === 0 ? -6 : 1 - dow;
  return startOfLocalDay(new Date(`${addDaysYmd(ymd, diff)}T00:00:00+05:30`));
}

export function rangeForPreset(preset: DatePreset): {
  from?: string;
  to?: string;
} {
  const todayYmd = toYmdIst(new Date());

  switch (preset) {
    case "all":
      return {};
    case "today":
      return { from: todayYmd, to: todayYmd };
    case "yesterday": {
      const y = addDaysYmd(todayYmd, -1);
      return { from: y, to: y };
    }
    case "last_7_days":
      return { from: addDaysYmd(todayYmd, -6), to: todayYmd };
    case "this_week": {
      const dow = weekdayIst(todayYmd);
      const diff = dow === 0 ? -6 : 1 - dow;
      return { from: addDaysYmd(todayYmd, diff), to: todayYmd };
    }
    case "last_week": {
      const dow = weekdayIst(todayYmd);
      const diff = dow === 0 ? -6 : 1 - dow;
      const thisWeekStart = addDaysYmd(todayYmd, diff);
      return {
        from: addDaysYmd(thisWeekStart, -7),
        to: addDaysYmd(thisWeekStart, -1),
      };
    }
    case "this_month":
      return { from: `${todayYmd.slice(0, 8)}01`, to: todayYmd };
    case "last_month": {
      const [y, m] = todayYmd.split("-").map(Number);
      const lastMonthEnd = addDaysYmd(`${y}-${String(m).padStart(2, "0")}-01`, -1);
      const lastMonthStart = `${lastMonthEnd.slice(0, 8)}01`;
      return { from: lastMonthStart, to: lastMonthEnd };
    }
    case "this_year":
      return { from: `${todayYmd.slice(0, 4)}-01-01`, to: todayYmd };
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
