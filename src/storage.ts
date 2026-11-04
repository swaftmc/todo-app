import type { AppState } from "./types";

const KEY = "todo.v1";

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // quota
  }
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}
