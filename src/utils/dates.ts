export function nowIso(): string {
  return new Date().toISOString();
}

export function isOverdue(dueAt: string | null, done: boolean): boolean {
  if (!dueAt || done) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function formatDue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const opts: Intl.DateTimeFormatOptions = sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  return d.toLocaleString(undefined, opts);
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function todayBounds(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

export function thisWeekEnd(): number {
  const now = new Date();
  const day = now.getDay();
  const diff = (7 - day) % 7 || 7;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}
