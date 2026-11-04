import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AppState,
  FilterState,
  Task,
  Tag,
} from "./types";
import { DEFAULT_FILTER } from "./types";
import { detectProxy } from "./utils/ai";
import { newId } from "./utils/ids";
import { nowIso, isOverdue, todayBounds, thisWeekEnd } from "./utils/dates";
import { nextDue } from "./utils/recurrence";
import * as notif from "./utils/notifications";
import { exportJson, parseImport } from "./utils/exportImport";
import { loadState, saveState } from "./storage";
import { usePersistedState } from "./hooks/usePersistedState";
import TaskTree from "./components/TaskTree";
import TaskDialog from "./components/TaskDialog";
import MissedReminders from "./components/MissedReminders";
import AiTab from "./components/AiTab";
import Settings from "./components/Settings";

const INITIAL: AppState = {
  theme: "system",
  tasks: [],
  tags: [],
  filter: { ...DEFAULT_FILTER },
};

function effectiveTheme(t: AppState["theme"]): "light" | "dark" {
  if (t !== "system") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ancestors(tasks: Task[], id: string): Set<string> {
  const set = new Set<string>();
  let cur = tasks.find((t) => t.id === id);
  while (cur && cur.parentId) {
    set.add(cur.parentId);
    cur = tasks.find((t) => t.id === cur!.parentId);
  }
  return set;
}

export default function App() {
  const [state, setState] = usePersistedState<AppState>("todo.v1", INITIAL);
  // hydrate from storage.ts (same key) — usePersistedState already does; ensure merge defaults
  useEffect(() => {
    const loaded = loadState();
    if (loaded) {
      const normalized: AppState = {
        ...loaded,
        tasks: (loaded.tasks ?? []).map((t) => ({ ...t, collapsed: t.collapsed ?? false })),
        filter: loaded.filter ?? { ...DEFAULT_FILTER },
      };
      setState(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [view, setView] = useState<"tasks" | "ai" | "settings">("tasks");
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  useEffect(() => {
    detectProxy();
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [missed, setMissed] = useState<Task[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: "before" | "after" | "inside" } | null>(null);

  // theme apply
  useEffect(() => {
    const apply = () => {
      document.documentElement.setAttribute("data-theme", effectiveTheme(state.theme));
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (state.theme === "system") apply();
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [state.theme]);

  // persist via storage.ts too (redundant but safe)
  useEffect(() => {
    saveState(state);
  }, [state]);

  // notifications schedule
  useEffect(() => {
    notif.schedule(state.tasks);
    const missedList = notif.sweepOverdue(state.tasks);
    setMissed(missedList);
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? { ...t, reminderFired: true } : t)),
      }));
    };
    window.addEventListener("reminder-fired", handler);
    return () => window.removeEventListener("reminder-fired", handler);
  }, [state.tasks]);

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, Task[]>();
    for (const t of state.tasks) {
      const key = t.parentId;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    // sort by createdAt then title
    for (const arr of m.values()) {
      arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return m;
  }, [state.tasks]);

  const visibleIds = useMemo(() => {
    const f = state.filter;
    const q = f.query.trim().toLowerCase();
    const { start, end } = todayBounds();
    const weekEnd = thisWeekEnd();
    const matched = new Set<string>();
    for (const t of state.tasks) {
      if (q && !t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q)) continue;
      if (f.status === "active" && t.done) continue;
      if (f.status === "done" && !t.done) continue;
      if (f.status === "overdue" && !isOverdue(t.dueAt, t.done)) continue;
      if (f.priority !== -1 && t.priority !== f.priority) continue;
      if (f.tag && !t.tags.includes(f.tag)) continue;
      if (f.due === "today") {
        const due = t.dueAt ? new Date(t.dueAt).getTime() : 0;
        if (!due || due < start || due >= end) continue;
      } else if (f.due === "week") {
        const due = t.dueAt ? new Date(t.dueAt).getTime() : 0;
        if (!due || due > weekEnd) continue;
      } else if (f.due === "none") {
        if (t.dueAt) continue;
      }
      matched.add(t.id);
    }
    // include ancestors
    const visible = new Set<string>(matched);
    for (const id of matched) {
      ancestors(state.tasks, id).forEach((a) => visible.add(a));
    }
    return visible;
  }, [state.tasks, state.filter]);

  const updateFilter = useCallback((patch: Partial<FilterState>) => {
    setState((prev) => ({ ...prev, filter: { ...prev.filter, ...patch } }));
  }, [setState]);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t
      ),
    }));
  }, [setState]);

  const addTask = useCallback((parentId: string | null, partial: Partial<Task>) => {
    const t: Task = {
      id: newId(),
      parentId,
      title: partial.title ?? "New task",
      notes: partial.notes ?? "",
      done: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      dueAt: partial.dueAt ?? null,
      priority: partial.priority ?? 0,
      tags: partial.tags ?? [],
      recurrence: partial.recurrence ?? null,
      reminderAt: partial.reminderAt ?? null,
      reminderFired: false,
      collapsed: false,
    };
    setState((prev) => ({ ...prev, tasks: [...prev.tasks, t] }));
  }, [setState]);

  const deleteTask = useCallback((id: string) => {
    setState((prev) => {
      // delete subtree
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of prev.tasks) {
          if (t.parentId && toDelete.has(t.parentId) && !toDelete.has(t.id)) {
            toDelete.add(t.id);
            changed = true;
          }
        }
      }
      return { ...prev, tasks: prev.tasks.filter((t) => !toDelete.has(t.id)) };
    });
  }, [setState]);

  const toggleDone = useCallback((id: string) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === id);
      if (!task) return prev;
      const newDone = !task.done;
      let tasks = prev.tasks.map((t) =>
        t.id === id ? { ...t, done: newDone, updatedAt: nowIso() } : t
      );
      if (newDone && task.recurrence) {
        const next = {
          ...task,
          id: newId(),
          done: false,
          reminderFired: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          dueAt: task.dueAt ? nextDue(task.dueAt, task.recurrence) : nowIso(),
          reminderAt: null,
        };
        tasks = [...tasks, next];
      }
      return { ...prev, tasks };
    });
  }, [setState]);

  const moveTask = useCallback((draggedId: string, targetId: string, pos: "before" | "after" | "inside") => {
    setState((prev) => {
      const dragged = prev.tasks.find((t) => t.id === draggedId);
      if (!dragged || dragged.id === targetId) return prev;
      // prevent moving into own descendant
      const descendants = new Set<string>([draggedId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of prev.tasks) {
          if (t.parentId && descendants.has(t.parentId) && !descendants.has(t.id)) {
            descendants.add(t.id);
            changed = true;
          }
        }
      }
      if (descendants.has(targetId)) return prev;

      const target = prev.tasks.find((t) => t.id === targetId);
      if (!target) return prev;

      let newParentId: string | null;
      if (pos === "inside") {
        newParentId = targetId;
      } else {
        newParentId = target.parentId;
      }

      // reorder: compute new createdAt? Use an order index approach. We'll store order by reassigning parentId and keep sort by createdAt.
      // To support reorder, we adjust createdAt of dragged to be just before/after target among siblings.
      const siblings = prev.tasks
        .filter((t) => t.parentId === newParentId && t.id !== draggedId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const targetIdx = siblings.findIndex((t) => t.id === targetId);
      let newCreatedAt = dragged.createdAt;
      if (pos === "before") {
        const prevSibling = targetIdx > 0 ? siblings[targetIdx - 1] : null;
        newCreatedAt = prevSibling
          ? new Date(new Date(prevSibling.createdAt).getTime() + 1).toISOString()
          : new Date(new Date(target.createdAt).getTime() - 1).toISOString();
      } else if (pos === "after") {
        const nextSibling = targetIdx >= 0 && targetIdx < siblings.length - 1 ? siblings[targetIdx + 1] : null;
        newCreatedAt = nextSibling
          ? new Date(new Date(nextSibling.createdAt).getTime() - 1).toISOString()
          : new Date(new Date(target.createdAt).getTime() + 1).toISOString();
      } else {
        // inside: append
        newCreatedAt = nowIso();
      }

      const tasks = prev.tasks.map((t) =>
        t.id === draggedId
          ? { ...t, parentId: newParentId, createdAt: newCreatedAt, updatedAt: nowIso() }
          : t
      );
      return { ...prev, tasks };
    });
  }, [setState]);

  const onDragStart = (id: string) => setDragId(id);
  const onDragEnd = () => {
    setDragId(null);
    setDropTarget(null);
  };
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!dragId || dragId === id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    let pos: "before" | "after" | "inside" = "inside";
    if (y < h * 0.25) pos = "before";
    else if (y > h * 0.75) pos = "after";
    setDropTarget({ id, pos });
  };
  const onDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragId && dropTarget) {
      moveTask(dragId, id, dropTarget.pos);
    }
    setDragId(null);
    setDropTarget(null);
  };

  const openNew = (parentId: string | null) => {
    setNewParentId(parentId);
    setDialogTask(null);
    setDialogOpen(true);
  };
  const openEdit = (t: Task) => {
    setNewParentId(t.parentId);
    setDialogTask(t);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  const handleSaveDialog = (data: Partial<Task>) => {
    if (dialogTask) {
      updateTask(dialogTask.id, data);
    } else {
      addTask(newParentId, data);
    }
    setDialogOpen(false);
  };

  const handleApplyChange = useCallback((change: any) => {
    if (change.action === "delete" && change.id) {
      deleteTask(change.id);
    } else if (change.action === "update" && change.id) {
      updateTask(change.id, change.fields ?? {});
    } else if (change.action === "add") {
      addTask(change.parentId ?? null, change.fields ?? {});
    }
  }, [deleteTask, updateTask, addTask]);

  const handleImport = (text: string) => {
    const parsed = parseImport(text);
    if (!parsed) {
      alert("Invalid file");
      return;
    }
    if (!confirm("Overwrite current data?")) return;
    setState(parsed);
  };

  const handleTagAdd = (name: string, color: string) => {
    const tag: Tag = { id: newId(), name, color };
    setState((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
  };

  const handleTagDelete = (id: string) => {
    setState((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t.id !== id),
      tasks: prev.tasks.map((t) => ({ ...t, tags: t.tags.filter((x) => x !== id) })),
    }));
  };

  const storageWarning = useMemo(() => {
    try {
      const used = new Blob([JSON.stringify(state)]).size;
      return used > 4 * 1024 * 1024;
    } catch {
      return false;
    }
  }, [state]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">T</div>
          <span>Todo</span>
        </div>
        <div className="topbar-spacer" />
        <div className="header-actions">
          <select value={state.theme} onChange={(e) => setState((p) => ({ ...p, theme: e.target.value as any }))}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>
      <aside className="sidebar">
        <nav>
          <a className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}>Tasks</a>
          <a className={view === "ai" ? "active" : ""} onClick={() => setView("ai")}>AI Coach</a>
          <a className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Settings</a>
        </nav>
      </aside>
      <main className="main">
        {view === "settings" ? (
          <Settings />
        ) : (
          <div className="page">
            {missed.length > 0 && (
              <MissedReminders
                tasks={missed}
                onDismiss={(id) => {
                  setMissed((m) => m.filter((t) => t.id !== id));
                  updateTask(id, { reminderFired: true });
                }}
              />
            )}
            {storageWarning && <div className="banner">Storage is getting large.</div>}
            <div className="page-header">
              <h1>Tasks</h1>
              <div className="actions">
                <button className="btn btn-secondary btn-sm" onClick={() => exportJson(state)}>Export</button>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const inp = document.createElement("input");
                  inp.type = "file"; inp.accept = "application/json";
                  inp.onchange = () => {
                    const f = inp.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => handleImport(String(r.result));
                    r.readAsText(f);
                  };
                  inp.click();
                }}>Import</button>
                <button className="btn btn-primary" onClick={() => openNew(null)}>+ Task</button>
              </div>
            </div>
            <div className="page-toolbar">
              <div className="search">
                <input
                  type="search"
                  placeholder="Search..."
                  value={state.filter.query}
                  onChange={(e) => updateFilter({ query: e.target.value })}
                />
              </div>
              <div className="toolbar-group">
                <select className="filter-pill" value={state.filter.status} onChange={(e) => updateFilter({ status: e.target.value as any })}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                  <option value="overdue">Overdue</option>
                </select>
                <select className="filter-pill" value={state.filter.priority} onChange={(e) => updateFilter({ priority: Number(e.target.value) as any })}>
                  <option value={-1}>Any priority</option>
                  <option value={0}>None</option>
                  <option value={1}>Low</option>
                  <option value={2}>Medium</option>
                  <option value={3}>High</option>
                </select>
                <select className="filter-pill" value={state.filter.tag} onChange={(e) => updateFilter({ tag: e.target.value })}>
                  <option value="">Any tag</option>
                  {state.tags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select className="filter-pill" value={state.filter.due} onChange={(e) => updateFilter({ due: e.target.value as any })}>
                  <option value="all">Any due</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="none">No due date</option>
                </select>
              </div>
            </div>
            <div className="split">
              <div className="list-pane">
                <TaskTree
                  childrenMap={childrenMap}
                  visibleIds={visibleIds}
                  tags={state.tags}
                  dragId={dragId}
                  dropTarget={dropTarget}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onToggle={toggleDone}
                  onEdit={openEdit}
                  onDelete={deleteTask}
                  onAddChild={(id) => openNew(id)}
                  onToggleCollapse={(id) => updateTask(id, { collapsed: !state.tasks.find((t) => t.id === id)?.collapsed })}
                />
              </div>
            </div>
            <div className="footer">
              <span>{state.tasks.filter((t) => !t.done).length} active / {state.tasks.length} total</span>
              <span>{state.tasks.filter((t) => isOverdue(t.dueAt, t.done)).length} overdue</span>
            </div>
            <div style={{ padding: "0 var(--s5)" }}>
              <div className="tag-list">
                {state.tags.map((t) => (
                  <span key={t.id} className="tag-chip" style={{ background: t.color, cursor: "pointer" }} onClick={() => handleTagDelete(t.id)} title="Click to delete">
                    {t.name}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="new tag" style={{ padding: "6px 10px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)" }} onChange={(e) => (window as any).__tagName = e.target.value} />
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const name = (window as any).__tagName;
                  if (name && String(name).trim()) handleTagAdd(String(name).trim(), "#137333");
                }}>Add tag</button>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: view === "ai" ? "flex" : "none", flex: 1, minHeight: 0 }}>
          <AiTab tasks={state.tasks} onApplyChange={handleApplyChange} visible={view === "ai"} />
        </div>
      </main>
      <TaskDialog
        open={dialogOpen}
        task={dialogTask}
        tags={state.tags}
        onClose={closeDialog}
        onSave={handleSaveDialog}
        onRequestPermission={notif.requestPermission}
      />
    </div>
  );
}
