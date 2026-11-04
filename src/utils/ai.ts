export interface AiTask {
  title: string;
  notes?: string;
  priority?: number;
  dueAt?: string | null;
  recurrence?: { freq: "daily" | "weekly" | "monthly"; interval: number } | null;
}

export interface TodoChange {
  action: "add" | "update" | "delete";
  id?: string;
  parentId?: string | null;
  fields?: Partial<AiTask> & { done?: boolean; title?: string; notes?: string };
}

export type ProviderId = "kilo" | "openrouter" | "anyrouter";

export const PROVIDERS: Record<ProviderId, { name: string; base: string; model: string; proxy: boolean }> = {
  kilo: { name: "Kilo Gateway", base: "https://ai-gateway.kilo.ai/api/v1", model: "reflection/beam-free", proxy: false },
  openrouter: { name: "OpenRouter", base: "https://openrouter.ai/api/v1", model: "openrouter/free", proxy: false },
  anyrouter: { name: "AnyRouter", base: "https://anyrouter.dev/api/v1", model: "anyrouter/free", proxy: false },
};

export function getProvider(): ProviderId {
  const v = localStorage.getItem("todo.aiProvider");
  return (v && v in PROVIDERS ? v : "openrouter") as ProviderId;
}
export function setProvider(p: ProviderId) {
  localStorage.setItem("todo.aiProvider", p);
}
export function getApiKey(): string {
  return localStorage.getItem(`todo.aiKey.${getProvider()}`) ?? "";
}
export function setApiKey(k: string) {
  localStorage.setItem(`todo.aiKey.${getProvider()}`, k);
}
export function getModel(): string {
  return localStorage.getItem(`todo.aiModel.${getProvider()}`) ?? PROVIDERS[getProvider()].model;
}
export function setModel(m: string) {
  localStorage.setItem(`todo.aiModel.${getProvider()}`, m);
}
export function getBase(): string {
  return PROVIDERS[getProvider()].base;
}

export function getProxyUrl(): string {
  return localStorage.getItem("todo.proxyUrl") ?? "";
}
export function setProxyUrl(u: string) {
  localStorage.setItem("todo.proxyUrl", u.trim());
}
export async function detectProxy(): Promise<string | null> {
  if (getProxyUrl()) return getProxyUrl();
  try {
    const r = await fetch("http://localhost:8787/health", { signal: AbortSignal.timeout(800) });
    if (r.ok) {
      const u = "http://localhost:8787";
      setProxyUrl(u);
      return u;
    }
  } catch {
    // no local proxy
  }
  return null;
}

export async function generateTodos(prompt: string, apiKey: string): Promise<AiTask[]> {
  const key = (apiKey || "anonymous").trim();
  const proxy = getProxyUrl();
  const targetBase = getBase();
  const url = proxy
    ? `${proxy.replace(/\/$/, "")}/chat/completions`
    : `${targetBase}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  if (proxy) headers["X-Target-URL"] = `${targetBase}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.4,
        messages: [
          { role: "system", content: "You are a todo-list assistant. Return ONLY a valid JSON array of task objects: {\"title\": string, \"notes\": string (optional), \"priority\": number 0-3, \"dueAt\": ISO string or null, \"recurrence\": null or {\"freq\":\"daily\"|\"weekly\"|\"monthly\",\"interval\":number}. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (e: any) {
    throw new Error(`Network/CORS error: ${e?.message ?? e}. Try a CORS-friendly provider (OpenRouter/AnyRouter) or run the local proxy.`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return parseTasks(content);
}

function parseTasks(content: string): AiTask[] {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array in response");
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("Response is not an array");
  return arr
    .map((x: any) => ({
      title: String(x?.title ?? "").trim(),
      notes: x?.notes ? String(x.notes) : "",
      priority: typeof x?.priority === "number" ? Math.max(0, Math.min(3, Math.round(x.priority))) : 0,
      dueAt: x?.dueAt ? String(x.dueAt) : null,
      recurrence: x?.recurrence ?? null,
    }))
    .filter((x) => x.title.length > 0);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  model?: string;
  changes?: TodoChange[];
}

export function digestTasks(tasks: { id: string; title: string; done: boolean; dueAt: string | null; priority: number; parentId: string | null }[]): string {
  if (tasks.length === 0) return "(no todos)";
  return tasks
    .map((t) => `- [${t.done ? "x" : " "}] #${t.id} "${t.title}"${t.dueAt ? ` due ${t.dueAt}` : ""}${t.priority ? ` p${t.priority}` : ""}${t.parentId ? ` (child of #${t.parentId})` : ""}`)
    .join("\n");
}

export async function chat(messages: ChatMessage[], context: string): Promise<{ content: string; model: string }> {
  const key = (getApiKey() || "anonymous").trim();
  const model = getModel();
  const now = new Date().toLocaleString();
  const system = `You are a todo-list coach. Help the user manage their todos. Current system time: ${now}. You may propose changes by emitting fenced code blocks tagged todo-change containing a JSON object. Format: {"action":"add"|"update"|"delete","id":"..." (for update/delete),"parentId":null|string (for add),"fields":{"title","notes","priority","dueAt","recurrence","done"}}. Nothing is saved until the user approves. Only propose changes when asked or when describing todos to record. Explain each change in a sentence. Format replies in Markdown. Current todos:\n${context}`;
  const proxy = getProxyUrl();
  const targetBase = getBase();
  const url = proxy
    ? `${proxy.replace(/\/$/, "")}/chat/completions`
    : `${targetBase}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  if (proxy) headers["X-Target-URL"] = `${targetBase}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      }),
    });
  } catch (e: any) {
    throw new Error(`Network/CORS error: ${e?.message ?? e}. Try a CORS-friendly provider (OpenRouter/AnyRouter) or run the local proxy.`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    model: data?.model ?? model,
  };
}

export function parseChanges(content: string): TodoChange[] {
  const out: TodoChange[] = [];
  const seen = new Set<string>();

  const tryAdd = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    if (obj.action !== "add" && obj.action !== "update" && obj.action !== "delete") return;
    if (!obj.fields || typeof obj.fields !== "object") return;
    const key = JSON.stringify(obj);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(obj as TodoChange);
  };

  // fenced code blocks (todo-change or json)
  const fenceRe = /```(?:todo-change|json)?\s*([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(content)) !== null) {
    try { tryAdd(JSON.parse(m[1].trim())); } catch { /* ignore */ }
  }

  // bare JSON objects containing "action"
  const bareRe = /\{\s*"action"\s*:\s*"(add|update|delete)"[\s\S]*?\}/g;
  let bm;
  while ((bm = bareRe.exec(content)) !== null) {
    const start = bm.index;
    let depth = 0, end = -1;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try { tryAdd(JSON.parse(content.slice(start, end + 1))); } catch { /* ignore */ }
    }
  }

  // tool-call style: todoChange(action=..., parentId=..., fields={...})
  const toolRe = /todoChange\s*\(([\s\S]*?)\)/g;
  let tm;
  while ((tm = toolRe.exec(content)) !== null) {
    const args = tm[1];
    const actionMatch = args.match(/action\s*=\s*['"](\w+)['"]/);
    const action = actionMatch ? actionMatch[1] : "add";
    const parentMatch = args.match(/parentId\s*=\s*['"]([^'"]*)['"]/);
    const parentId = parentMatch ? (parentMatch[1] === "" ? null : parentMatch[1]) : null;
    const idMatch = args.match(/\bid\s*=\s*['"]([^'"]*)['"]/);
    const id = idMatch ? idMatch[1] : undefined;
    const fieldsStart = args.indexOf("fields=");
    let fields: any = {};
    if (fieldsStart !== -1) {
      const braceStart = args.indexOf("{", fieldsStart);
      if (braceStart !== -1) {
        let depth = 0;
        let end = -1;
        for (let i = braceStart; i < args.length; i++) {
          if (args[i] === "{") depth++;
          else if (args[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) {
          let jsonStr = args.slice(braceStart, end + 1);
          jsonStr = jsonStr.replace(/'/g, '"');
          try { fields = JSON.parse(jsonStr); } catch { fields = {}; }
        }
      }
    }
    tryAdd({ action, id, parentId, fields });
  }

  return out;
}