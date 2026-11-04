import type { Recurrence } from "../types";

export function nextDue(current: string, rec: Recurrence): string {
  const d = new Date(current);
  const interval = Math.max(1, rec.interval || 1);
  if (rec.freq === "daily") {
    d.setDate(d.getDate() + interval);
  } else if (rec.freq === "weekly") {
    d.setDate(d.getDate() + 7 * interval);
  } else {
    const targetMonth = d.getMonth() + interval;
    const day = d.getDate();
    const y = d.getFullYear() + Math.floor(targetMonth / 12);
    const m = targetMonth % 12;
    const lastDay = new Date(y, m + 1, 0).getDate();
    d.setFullYear(y);
    d.setMonth(m);
    d.setDate(Math.min(day, lastDay));
  }
  return d.toISOString();
}
