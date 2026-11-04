import { useState } from "react";
import { clearState } from "../storage";
import { getProvider, setProvider, getApiKey, setApiKey, getModel, setModel as setStoredModel, PROVIDERS, type ProviderId } from "../utils/ai";

export default function Settings() {
  const [provider, setProviderState] = useState(getProvider());
  const [key, setKey] = useState(getApiKey());
  const [model, setModel] = useState(getModel());
  const [saved, setSaved] = useState(false);

  const switchProvider = (p: ProviderId) => {
    setProvider(p);
    setProviderState(p);
    setKey(getApiKey());
    setModel(getModel());
  };

  const save = () => {
    setApiKey(key);
    setStoredModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-pane">
      <h2>Settings</h2>
      <div className="form" style={{ maxWidth: 520, marginTop: 16 }}>
        <div className="field">
          <label>Provider</label>
          <select value={provider} onChange={(e) => switchProvider(e.target.value as ProviderId)}>
            {Object.entries(PROVIDERS).map(([id, p]) => (
              <option key={id} value={id}>{p.name}</option>
            ))}
          </select>
          <span className="hint">Base URL: {PROVIDERS[provider].base}</span>
        </div>
        <div className="field">
          <label>API key (optional — leave blank for free tier where supported)</label>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-..." />
          <span className="hint">Stored locally per provider.</span>
        </div>
        <div className="field">
          <label>AI model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={PROVIDERS[provider].model} />
          <span className="hint">Default: {PROVIDERS[provider].model}</span>
        </div>
        <div className="form-actions">
          <button className="primary" onClick={save}>Save</button>
          {saved && <span style={{ color: "var(--green-500)", fontSize: 13 }}>Saved</span>}
        </div>
        <div className="danger-zone" style={{ marginTop: 24 }}>
          <div className="text">
            <h3>Clear all data</h3>
            <p>Removes all tasks, tags, and settings from this browser.</p>
          </div>
          <button className="btn btn-danger" onClick={() => { if (confirm("Clear all data?")) { clearState(); localStorage.removeItem("todo.aiChat"); window.location.reload(); } }}>Clear</button>
        </div>
      </div>
    </div>
  );
}
