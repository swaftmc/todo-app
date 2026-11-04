import type { AppState } from "../types";

export function exportJson(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImport(text: string): AppState | null {
  try {
    const data = JSON.parse(text) as Partial<AppState>;
    if (!data || !Array.isArray(data.tasks)) return null;
    if (!Array.isArray(data.tags)) data.tags = [];
    if (!data.filter) data.filter = { query: "", status: "all", priority: -1, tag: "", due: "all" };
    if (!data.theme) data.theme = "system";
    return data as AppState;
  } catch {
    return null;
  }
}
