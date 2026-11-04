import React from "react";
import type { Task, Tag } from "../types";
import TaskItem from "./TaskItem";

interface Props {
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

export default function TaskTree(props: Props) {
  const roots = (props.childrenMap.get(null) ?? []).filter((t) => props.visibleIds.has(t.id));
  if (roots.length === 0) {
    return <div className="empty">No tasks. Add one to get started.</div>;
  }
  return (
    <ul className="task-list">
      {roots.map((t) => (
        <TaskItem key={t.id} task={t} depth={0} {...props} />
      ))}
    </ul>
  );
}
