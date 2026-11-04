import React from "react";
import type { Task, Tag } from "../types";
import { isOverdue, formatDue } from "../utils/dates";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "../types";

interface Props {
  task: Task;
  depth: number;
  childrenMap: Map<string | null, Task[]>;
  visibleIds: Set<string>;
  tags: Tag[];
  dragId: string | null;
  dropTarget: { id: string; pos: "before" | "after" | "inside" } | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

export default function TaskItem(props: Props) {
  const { task } = props;
  const kids = (props.childrenMap.get(task.id) ?? []).filter((t) => props.visibleIds.has(t.id));
  const overdue = isOverdue(task.dueAt, task.done);
  const tagMap = new Map(props.tags.map((t) => [t.id, t]));
  const dropClass =
    props.dropTarget?.id === task.id
      ? props.dropTarget.pos === "before"
        ? "drop-before"
        : props.dropTarget.pos === "after"
        ? "drop-after"
        : "drop-inside"
      : "";

  return (
    <li className={`task-item ${props.dragId === task.id ? "dragging" : ""}`}>
      <div
        className={`task-row ${task.done ? "done" : ""} ${overdue ? "overdue" : ""} ${dropClass}`}
        draggable
        onDragStart={() => props.onDragStart(task.id)}
        onDragEnd={props.onDragEnd}
        onDragOver={(e) => props.onDragOver(e, task.id)}
        onDrop={(e) => props.onDrop(e, task.id)}
      >
        <input
          type="checkbox"
          className="checkbox"
          checked={task.done}
          onChange={() => props.onToggle(task.id)}
        />
        {kids.length > 0 && (
          <button className="collapse-btn" onClick={() => props.onToggleCollapse(task.id)}>
            {task.collapsed ? "▸" : "▾"}
          </button>
        )}
        {kids.length === 0 && <span style={{ width: 16 }} />}
        <span className="task-title">{task.title}</span>
        <div className="task-meta">
          {task.priority !== 0 && (
            <span className="badge">
              <span className="priority-dot" style={{ background: PRIORITY_COLORS[task.priority] }} />{" "}
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {task.dueAt && (
            <span className={`badge ${overdue ? "overdue" : ""}`}>{formatDue(task.dueAt)}</span>
          )}
          {task.recurrence && <span className="badge">↻ {task.recurrence.freq}</span>}
          {task.reminderAt && <span className="badge">🔔</span>}
          {task.tags.map((id) => {
            const tag = tagMap.get(id);
            if (!tag) return null;
            return (
              <span key={id} className="tag-chip" style={{ background: tag.color }}>
                {tag.name}
              </span>
            );
          })}
        </div>
        <button className="icon" onClick={() => props.onEdit(task)} title="Edit">✎</button>
        <button className="icon" onClick={() => props.onAddChild(task.id)} title="Add subtask">+</button>
        <button className="icon danger" onClick={() => { if (confirm("Delete task?")) props.onDelete(task.id); }} title="Delete">×</button>
      </div>
      {task.notes && <div style={{ marginLeft: 28 + props.depth * 0, fontSize: 12, color: "var(--text-muted)", padding: "2px 10px" }}>{task.notes}</div>}
      {!task.collapsed && kids.length > 0 && (
        <ul className="task-list children">
          {kids.map((c) => (
            <TaskItem key={c.id} {...props} task={c} depth={props.depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
