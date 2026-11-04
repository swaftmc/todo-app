import type { Task } from "../types";
import { formatDue } from "../utils/dates";

interface Props {
  tasks: Task[];
  onDismiss: (id: string) => void;
}

export default function MissedReminders({ tasks, onDismiss }: Props) {
  if (tasks.length === 0) return null;
  return (
    <div className="banner">
      <strong>Missed reminders:</strong>{" "}
      {tasks.map((t) => (
        <span key={t.id} style={{ marginLeft: 8 }}>
          {t.title} ({formatDue(t.reminderAt)}){" "}
          <button className="icon" onClick={() => onDismiss(t.id)}>×</button>
        </span>
      ))}
    </div>
  );
}
