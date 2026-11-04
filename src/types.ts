export type Priority = 0 | 1 | 2 | 3; // 0 none, 1 low, 2 medium, 3 high
export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  parentId: string | null;
  title: string;
  notes: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  priority: Priority;
  tags: string[];
  recurrence: Recurrence | null;
  reminderAt: string | null;
  reminderFired: boolean;
  collapsed: boolean;
}

export type FilterStatus = "all" | "active" | "done" | "overdue";
export type FilterDue = "all" | "today" | "week" | "none";

export interface FilterState {
  query: string;
  status: FilterStatus;
  priority: Priority | -1;
  tag: string;
  due: FilterDue;
}

export interface AppState {
  theme: "light" | "dark" | "system";
  tasks: Task[];
  tags: Tag[];
  filter: FilterState;
}

export const DEFAULT_FILTER: FilterState = {
  query: "",
  status: "all",
  priority: -1,
  tag: "",
  due: "all",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  0: "#9ca3af",
  1: "#3b82f6",
  2: "#f59e0b",
  3: "#ef4444",
};
