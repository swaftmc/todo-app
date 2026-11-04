import { useState } from "react";
import type { FilterState, Priority, Tag } from "../types";

interface Props {
  filter: FilterState;
  tags: Tag[];
  onChange: (patch: Partial<FilterState>) => void;
  onAdd: () => void;
  onTagAdd: (name: string, color: string) => void;
  onTagDelete: (id: string) => void;
}

export default function Toolbar({ filter, tags, onChange, onAdd, onTagAdd, onTagDelete }: Props) {
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#16a34a");
  return (
    <div className="toolbar">
      <input
        type="search"
        placeholder="Search..."
        value={filter.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <select value={filter.status} onChange={(e) => onChange({ status: e.target.value as FilterState["status"] })}>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="done">Done</option>
        <option value="overdue">Overdue</option>
      </select>
      <select value={filter.priority} onChange={(e) => onChange({ priority: Number(e.target.value) as Priority | -1 })}>
        <option value={-1}>Any priority</option>
        <option value={0}>None</option>
        <option value={1}>Low</option>
        <option value={2}>Medium</option>
        <option value={3}>High</option>
      </select>
      <select value={filter.tag} onChange={(e) => onChange({ tag: e.target.value })}>
        <option value="">Any tag</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select value={filter.due} onChange={(e) => onChange({ due: e.target.value as FilterState["due"] })}>
        <option value="all">Any due</option>
        <option value="today">Today</option>
        <option value="week">This week</option>
        <option value="none">No due date</option>
      </select>
      <button className="primary" onClick={onAdd}>+ Task</button>
      <div className="tag-list" style={{ width: "100%" }}>
        {tags.map((t) => (
          <span key={t.id} className="tag-chip" style={{ background: t.color }} onClick={() => onTagDelete(t.id)} title="Click to delete">
            {t.name}
          </span>
        ))}
        <input
          placeholder="new tag"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          style={{ width: 90 }}
        />
        <input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} />
        <button onClick={() => { if (tagName.trim()) { onTagAdd(tagName.trim(), tagColor); setTagName(""); } }}>Add tag</button>
      </div>
    </div>
  );
}
