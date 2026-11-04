import { useState, useRef, useEffect } from "react";
import type { Task } from "../types";
import { chat, parseChanges, digestTasks, getApiKey, getModel, type ChatMessage, type TodoChange } from "../utils/ai";

interface Props {
  tasks: Task[];
  onApplyChange: (change: TodoChange) => void;
}

export default function AiTab({ tasks, onApplyChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem("todo.aiChat");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("todo.aiChat", JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const result = await chat(next, digestTasks(tasks));
      const changes = parseChanges(result.content);
      setMessages([...next, { role: "assistant", content: result.content, model: result.model, changes }]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem("todo.aiChat");
  };

  const applyChange = (change: TodoChange, msgIdx: number, changeIdx: number) => {
    onApplyChange(change);
    setMessages((prev) => {
      const updated = [...prev];
      const msg = { ...updated[msgIdx] };
      if (msg.changes) {
        msg.changes = msg.changes.filter((_, i) => i !== changeIdx);
      }
      updated[msgIdx] = msg;
      return updated;
    });
  };

  return (
    <div className="ai-page" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="page-header">
        <h1>AI Coach</h1>
        <div className="actions">
          <span className="ai-coach-blurb">Model: {getModel()}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearChat}>Clear chat</button>
        </div>
      </div>
      <div ref={scrollRef} className="ai-scroll" style={{ flex: 1 }}>
        {messages.length === 0 && (
          <div className="ai-empty">
            <div className="icon-wrap">AI</div>
            <h3>Ask your todo coach</h3>
            <p>Describe todos to add, ask for prioritization, or say "add 3 tasks for studying". Proposed changes appear as cards you approve.</p>
            <div className="ai-suggestions">
              {["Add 5 tasks for studying calculus this week", "What should I focus on today?", "Break down 'write report' into subtasks"].map((s) => (
                <button key={s} className="ai-suggestion" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, mi) => (
          <div key={mi} className={`ai-msg ${m.role === "user" ? "ai-msg-user" : "ai-msg-assistant"}`}>
            {m.role === "assistant" && <div className="ai-avatar">AI</div>}
            <div className="ai-bubble">
              <div className="ai-msg-text" style={{ whiteSpace: "pre-wrap" }}>
                {m.content
                  .replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/g, "")
                  .replace(/```todo-change[\s\S]*?```/g, "")
                  .replace(/todoChange\([\s\S]*?\)/g, "")
                  .trim() || (m.changes?.length ? "" : m.content)}
              </div>
              {m.role === "assistant" && (
                <div className="ai-msg-meta">Model: {m.model ?? getModel()}</div>
              )}
              {m.role === "user" && (
                <div style={{ marginTop: 4, textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setInput(m.content);
                    setMessages((prev) => {
                      const out = prev.slice(0, mi);
                      // also drop following assistant if present
                      if (prev[mi + 1]?.role === "assistant") return out;
                      return out;
                    });
                  }}>Revert</button>
                </div>
              )}
              {m.changes && m.changes.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {m.changes.map((c, ci) => (
                    <div key={ci} className="ai-change">
                      <div className="ai-change-title">{c.action.toUpperCase()} {c.fields?.title ?? c.id ?? ""}</div>
                      <table className="ai-change-rows">
                        <tbody>
                          {Object.entries(c.fields ?? {}).map(([k, v]) => (
                            <tr key={k}><th>{k}</th><td>{String(v)}</td></tr>
                          ))}
                          {c.id && <tr><th>id</th><td>{c.id}</td></tr>}
                          {c.parentId !== undefined && <tr><th>parentId</th><td>{String(c.parentId)}</td></tr>}
                        </tbody>
                      </table>
                      <div className="ai-change-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => applyChange(c, mi, ci)}>Approve</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="ai-thinking">Thinking...</div>}
        {error && <div className="ai-error">{error}</div>}
      </div>
      <div className="ai-composer-wrap">
        <div className="ai-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message your todo coach... (Enter to send, Shift+Enter for newline)"
          />
          <div className="ai-composer-foot">
            <span className="ai-composer-hint">API key: {getApiKey() ? "set" : "free tier"}</span>
            <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
