import type { Task } from "../types";

let timers: number[] = [];

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export function permission(): NotificationPermission {
  if (!notificationsSupported()) return "denied";
  return Notification.permission;
}

export function fireNotification(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: undefined });
  } catch {
    // ignore
  }
}

export function schedule(tasks: Task[]): void {
  if (!notificationsSupported()) return;
  timers.forEach((t) => clearTimeout(t));
  timers = [];
  if (Notification.permission !== "granted") return;
  const now = Date.now();
  for (const t of tasks) {
    const when = t.reminderAt ? new Date(t.reminderAt).getTime() : null;
    if (!when || t.reminderFired || t.done) continue;
    const delay = when - now;
    if (delay <= 0) continue;
    const id = window.setTimeout(() => {
      fireNotification("Reminder", t.title);
      // mark fired handled by caller via storage? We'll dispatch custom event
      window.dispatchEvent(new CustomEvent("reminder-fired", { detail: t.id }));
    }, delay);
    timers.push(id);
  }
}

export function sweepOverdue(tasks: Task[]): Task[] {
  const now = Date.now();
  return tasks.filter((t) => {
    if (t.done || t.reminderFired) return false;
    const when = t.reminderAt ? new Date(t.reminderAt).getTime() : null;
    return when !== null && when <= now;
  });
}
