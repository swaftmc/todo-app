import { useEffect, useRef, useState } from "react";
import type { Task, Tag, Priority, Recurrence } from "../types";
import { toLocalInput, fromLocalInput } from "../utils/dates";
import { PRIORITY_LABELS } from "../types";

interface Props {
  open: boolean;
  task: Task | null;
  tags: Tag[];
  onClose: () => void;
  onSave: (data: Partial<Task>) => void;
  onRequestPermission: () => Promise<NotificationPermission>;
}

export default function TaskDialog({ open, task, tags, onClose, onSave, onRequestPermission }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<Priority>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [reminderAt, setReminderAt] = useState("");

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setNotes(task.notes);
        setDueAt(toLocalInput(task.dueAt));
        setPriority(task.priority);
        setSelectedTags(task.tags);
        setRecurrence(task.recurrence);
        setReminderAt(toLocalInput(task.reminderAt));
      } else {
        setTitle("");
        setNotes("");
        setDueAt("");
        setPriority(0);
        setSelectedTags([]);
        setRecurrence(null);
        setReminderAt("");
      }
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [open, task]);

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (reminderAt) await onRequestPermission();
    const data: Partial<Task> = {
      title: title.trim() || "Untitled",
      notes,
      dueAt: fromLocalInput(dueAt),
      priority,
      tags: selectedTags,
      recurrence,
      reminderAt: fromLocalInput(reminderAt),
    };
    onSave(data);
  };

  return (
    <dialog ref={ref} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>{task ? "Edit task" : "New task"}</h3>
      <div className="form-row">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="form-row">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Due</label>
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Priority</label>
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as Priority)}>
          <option value={0}>{PRIORITY_LABELS[0]}</option>
          <option value={1}>{PRIORITY_LABELS[1]}</option>
          <option value={2}>{PRIORITY_LABELS[2]}</option>
          <option value={3}>{PRIORITY_LABELS[3]}</option>
        </select>
      </div>
      <div className="form-row">
        <label>Tags</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tags.map((t) => (
            <span
              key={t.id}
              className={`tag-chip ${selectedTags.includes(t.id) ? "selected" : ""}`}
              style={{ background: t.color, cursor: "pointer", border: selectedTags.includes(t.id) ? "2px solid var(--text)" : "2px solid transparent" }}
              onClick={() => toggleTag(t.id)}
            >
              {t.name}
            </span>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label>Recurrence</label>
        <div style={{ display: "flex", gap: 6 }}>
          <select
            value={recurrence?.freq ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) setRecurrence(null);
              else setRecurrence({ freq: v as Recurrence["freq"], interval: recurrence?.interval ?? 1 });
            }}
          >
            <option value="">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          {recurrence && (
            <input
              type="number"
              min={1}
              value={recurrence.interval}
              onChange={(e) => setRecurrence({ ...recurrence, interval: Math.max(1, Number(e.target.value)) })}
              style={{ width: 60 }}
            />
          )}
        </div>
      </div>
      <div className="form-row">
        <label>Reminder</label>
        <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
      </div>
      <div className="form-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={handleSave}>Save</button>
      </div>
    </dialog>
  );
}
