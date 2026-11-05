import { useState, useRef, useEffect } from "react";
import type { Task } from "../types";
import { chat, parseChanges, digestTasks, getApiKey, type ChatMessage, type TodoChange } from "../utils/ai";

interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
}

interface Props {
  tasks: Task[];
  onApplyChange: (change: TodoChange) => void;
}

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem("todo.aiChats");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  // migrate legacy single chat
  try {
    const legacy = localStorage.getItem("todo.aiChat");
    if (legacy) {
      const msgs = JSON.parse(legacy);
      if (Array.isArray(msgs) && msgs.length) {
        return [{ id: "c1", title: msgs[0]?.content?.slice(0, 40) || "Chat 1", messages: msgs }];
      }
    }
  } catch {}
  return [{ id: "c1", title: "New chat", messages: [] }];
}

function newId() {
  return "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function AiTab({ tasks, onApplyChange }: Props) {
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeId, setActiveId] = useState<string>(() => loadChats()[0].id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("todo.aiChats", JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chats, activeId]);

  const activeChat = chats.find((c) => c.id === activeId) ?? chats[0];

  const updateActive = (updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
    setChats((prev) => prev.map((c) => (c.id === activeId ? { ...c, messages: updater(c.messages) } : c)));
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const next = [...(activeChat?.messages ?? []), userMsg];
    updateActive(() => next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const result = await chat(next, digestTasks(tasks));
      const changes = parseChanges(result.content);
      updateActive(() => [...next, { role: "assistant", content: result.content, model: result.model, changes }]);
      setChats((prev) => prev.map((c) => {
        if (c.id !== activeId) return c;
        if (c.title === "New chat") return { ...c, title: input.trim().slice(0, 40) };
        return c;
      }));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => updateActive(() => []);

  const newChat = () => {
    const c: Chat = { id: newId(), title: "New chat", messages: [] };
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
  };

  const deleteChat = (id: string) => {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) return [{ id: newId(), title: "New chat", messages: [] }];
      return filtered;
    });
    if (activeId === id) {
      const remaining = chats.filter((c) => c.id !== id);
      setActiveId(remaining.length ? remaining[0].id : chats[0]?.id);
    }
  };

  const applyChange = (change: TodoChange, msgIdx: number, changeIdx: number) => {
    onApplyChange(change);
    updateActive((msgs) => {
      const updated = [...msgs];
      const msg = { ...updated[msgIdx] };
      if (msg.changes) {
        msg.changes = msg.changes.map((c, i) => (i === changeIdx ? { ...c, approved: true } : c));
      }
      updated[msgIdx] = msg;
      return updated;
    });
  };

  const revertMessage = (mi: number) => {
    const msgs = activeChat?.messages ?? [];
    const target = msgs[mi];
    if (!target || target.role !== "user") return;
    setInput(target.content);
    updateActive((m) => {
      const out = m.slice(0, mi);
      if (m[mi + 1]?.role === "assistant") return out;
      return out;
    });
  };

  const clean = (s: string) =>
    s
      .replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/g, "")
      .replace(/```(?:todo-change|json)?[\s\S]*?```/g, "")
      .replace(/todoChange\([\s\S]*?\)/g, "")
      .trim();

  return (
    <div className="ai-page" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="page-header">
        <h1>AI Coach</h1>
        <div className="actions">
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)" }}
          >
            {chats.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={newChat}>+ New</button>
          <button className="btn btn-ghost btn-sm" onClick={() => deleteChat(activeId)}>Delete</button>
          <button className="btn btn-ghost btn-sm" onClick={clearChat}>Clear</button>
        </div>
      </div>
      <div ref={scrollRef} className="ai-scroll" style={{ flex: 1 }}>
        {(activeChat?.messages ?? []).length === 0 && (
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
        {(activeChat?.messages ?? []).map((m, mi) => (
          <div key={mi} className={`ai-msg ${m.role === "user" ? "ai-msg-user" : "ai-msg-assistant"}`}>
            {m.role === "assistant" && <div className="ai-avatar">AI</div>}
            <div className="ai-bubble">
              <div className="ai-msg-text" style={{ whiteSpace: "pre-wrap" }}>
                {clean(m.content) || (m.changes?.length ? "" : m.content)}
              </div>
              {m.role === "user" && (
                <div style={{ marginTop: 4, textAlign: "right" }}>
                  <button
                    onClick={() => revertMessage(mi)}
                    title="Revert"
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-soft)", fontSize: 14, padding: 2 }}
                  >↩</button>
                </div>
              )}
                {m.changes && m.changes.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {m.changes.map((c, ci) => (
                      c.approved ? (
                        <div key={ci} className="ai-change" style={{ opacity: 0.6 }}>
                          <div className="ai-change-title">✓ Approved — {c.action.toUpperCase()} {c.fields?.title ?? c.id ?? ""}</div>
                        </div>
                      ) : (
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
                      )
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
