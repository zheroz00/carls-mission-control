// Lightweight 5-field cron parser and calendar color utilities.
// No external dependencies.

export interface CronSchedule {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
  description: string;
}

function parseField(field: string, min: number, max: number): number[] {
  const values: Set<number> = new Set();

  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
    const base = stepMatch ? stepMatch[1] : part;

    let start: number;
    let end: number;

    if (base === "*") {
      start = min;
      end = max;
    } else if (base.includes("-")) {
      const [lo, hi] = base.split("-").map(Number);
      start = lo;
      end = hi;
    } else {
      start = parseInt(base, 10);
      end = start;
    }

    for (let i = start; i <= end; i += step) {
      values.add(i);
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

export function parseCron(expression: string): CronSchedule {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { minutes: [0], hours: [0], daysOfMonth: [], months: [], daysOfWeek: [], description: expression };
  }

  const [minField, hourField, domField, monthField, dowField] = parts;
  const minutes = parseField(minField, 0, 59);
  const hours = parseField(hourField, 0, 23);
  const daysOfMonth = domField === "*" ? [] : parseField(domField, 1, 31);
  const months = monthField === "*" ? [] : parseField(monthField, 1, 12);
  const daysOfWeek = dowField === "*" ? [] : parseField(dowField, 0, 6);

  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
    description: describeSchedule({ minutes, hours, daysOfMonth, months, daysOfWeek, description: "" }),
  };
}

export function describeSchedule(schedule: CronSchedule): string {
  const { minutes, hours, daysOfWeek } = schedule;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const fmtTime = (h: number, m: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  // Every hour at :MM
  if (hours.length === 24 && minutes.length === 1) {
    return `Every hour at :${minutes[0].toString().padStart(2, "0")}`;
  }

  // Every N hours
  if (hours.length > 1 && hours.length < 24 && minutes.length === 1) {
    const gaps = hours.slice(1).map((h, i) => h - hours[i]);
    const isEvenStep = gaps.every((g) => g === gaps[0]);
    if (isEvenStep && gaps[0] > 1) {
      return `Every ${gaps[0]} hours`;
    }
  }

  // Single time
  if (hours.length === 1 && minutes.length === 1) {
    const time = fmtTime(hours[0], minutes[0]);
    if (daysOfWeek.length === 0) {
      return `Daily at ${time}`;
    }
    if (daysOfWeek.length === 5 && !daysOfWeek.includes(0) && !daysOfWeek.includes(6)) {
      return `Weekdays at ${time}`;
    }
    return `${daysOfWeek.map((d) => dayNames[d]).join(", ")} at ${time}`;
  }

  // Multiple times per day
  if (hours.length > 1 && minutes.length === 1) {
    return `${hours.length}x daily`;
  }

  return "Custom schedule";
}

export function getOccurrencesInRange(
  schedule: CronSchedule,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const occurrences: Date[] = [];
  const current = new Date(rangeStart);
  current.setHours(0, 0, 0, 0);

  const endDay = new Date(rangeEnd);
  endDay.setHours(23, 59, 59, 999);

  while (current <= endDay) {
    const dow = current.getDay();
    const dom = current.getDate();
    const month = current.getMonth() + 1;

    const dowMatch = schedule.daysOfWeek.length === 0 || schedule.daysOfWeek.includes(dow);
    const domMatch = schedule.daysOfMonth.length === 0 || schedule.daysOfMonth.includes(dom);
    const monthMatch = schedule.months.length === 0 || schedule.months.includes(month);

    if (dowMatch && domMatch && monthMatch) {
      for (const hour of schedule.hours) {
        for (const minute of schedule.minutes) {
          const occ = new Date(current);
          occ.setHours(hour, minute, 0, 0);
          if (occ >= rangeStart && occ <= rangeEnd) {
            occurrences.push(occ);
          }
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return occurrences;
}

// --- Color utilities ---

const TASK_COLORS = [
  "rose", "amber", "emerald", "sky", "violet", "orange",
  "teal", "pink", "indigo", "lime", "cyan", "fuchsia",
] as const;

export type TaskColor = (typeof TASK_COLORS)[number];

interface ColorClasses {
  bg: string;
  text: string;
  border: string;
  bar: string;
}

const COLOR_MAP: Record<TaskColor, ColorClasses> = {
  rose:    { bg: "bg-rose-400/20",    text: "text-rose-300",    border: "border-rose-400/30",    bar: "bg-rose-400" },
  amber:   { bg: "bg-amber-400/20",   text: "text-amber-300",   border: "border-amber-400/30",   bar: "bg-amber-400" },
  emerald: { bg: "bg-emerald-400/20", text: "text-emerald-300", border: "border-emerald-400/30", bar: "bg-emerald-400" },
  sky:     { bg: "bg-sky-400/20",     text: "text-sky-300",     border: "border-sky-400/30",     bar: "bg-sky-400" },
  violet:  { bg: "bg-violet-400/20",  text: "text-violet-300",  border: "border-violet-400/30",  bar: "bg-violet-400" },
  orange:  { bg: "bg-orange-400/20",  text: "text-orange-300",  border: "border-orange-400/30",  bar: "bg-orange-400" },
  teal:    { bg: "bg-teal-400/20",    text: "text-teal-300",    border: "border-teal-400/30",    bar: "bg-teal-400" },
  pink:    { bg: "bg-pink-400/20",    text: "text-pink-300",    border: "border-pink-400/30",    bar: "bg-pink-400" },
  indigo:  { bg: "bg-indigo-400/20",  text: "text-indigo-300",  border: "border-indigo-400/30",  bar: "bg-indigo-400" },
  lime:    { bg: "bg-lime-400/20",    text: "text-lime-300",    border: "border-lime-400/30",    bar: "bg-lime-400" },
  cyan:    { bg: "bg-cyan-400/20",    text: "text-cyan-300",    border: "border-cyan-400/30",    bar: "bg-cyan-400" },
  fuchsia: { bg: "bg-fuchsia-400/20", text: "text-fuchsia-300", border: "border-fuchsia-400/30", bar: "bg-fuchsia-400" },
};

export function getColorClasses(color: TaskColor): ColorClasses {
  return COLOR_MAP[color] ?? COLOR_MAP.sky;
}

export function assignColor(taskName: string, explicitColor?: string): TaskColor {
  if (explicitColor && explicitColor in COLOR_MAP) {
    return explicitColor as TaskColor;
  }
  let hash = 0;
  for (let i = 0; i < taskName.length; i++) {
    hash = (hash * 31 + taskName.charCodeAt(i)) | 0;
  }
  return TASK_COLORS[Math.abs(hash) % TASK_COLORS.length];
}
