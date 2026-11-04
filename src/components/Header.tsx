import React from "react";
import type { AppState } from "../types";

interface Props {
  theme: AppState["theme"];
  onThemeChange: (t: AppState["theme"]) => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onClear: () => void;
}

export default function Header({ theme, onThemeChange, onExport, onImport, onClear }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  return (
    <header className="header">
      <h1>Todo</h1>
      <div className="header-actions">
        <select value={theme} onChange={(e) => onThemeChange(e.target.value as AppState["theme"])}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <button onClick={onExport}>Export</button>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <button className="danger" onClick={onClear}>Clear</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => onImport(String(r.result));
            r.readAsText(f);
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
