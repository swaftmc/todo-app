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
  kilo: { name: "Kilo Gateway", base: "https://ai-gateway.kilo.ai/api/v1", model: "reflection/beam-free", proxy: true },
  openrouter: { name: "OpenRouter", base: "https://openrouter.ai/api/v1", model: "openrouter/free", proxy: false },
  anyrouter: { name: "AnyRouter", base: "https://anyrouter.dev/api/v1", model: "anyrouter/free", proxy: false },
};

export function getProvider(): ProviderId {
  const v = localStorage.getItem("todo.aiProvider");
  return (v && v in PROVIDERS ? v : "kilo") as ProviderId;
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

function endpoint(): string {
  const url = `${getBase()}/chat/completions`;
  if (PROVIDERS[getProvider()].proxy) {
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  }
  return url;
}

export async function generateTodos(prompt: string, apiKey: string): Promise<AiTask[]> {
  const key = (apiKey || "anonymous").trim();
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: getModel(),
      temperature: 0.4,
      messages: [
        { role: "system", content: "You are a todo-list assistant. Return ONLY a valid JSON array of task objects: {\"title\": string, \"notes\": string (optional), \"priority\": number 0-3, \"dueAt\": ISO string or null, \"recurrence\": null or {\"freq\":\"daily\"|\"weekly\"|\"monthly\",\"interval\":number}. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });
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
  changes?: TodoChange[];
}

export function digestTasks(tasks: { id: string; title: string; done: boolean; dueAt: string | null; priority: number; parentId: string | null }[]): string {
  if (tasks.length === 0) return "(no todos)";
  return tasks
    .map((t) => `- [${t.done ? "x" : " "}] #${t.id} "${t.title}"${t.dueAt ? ` due ${t.dueAt}` : ""}${t.priority ? ` p${t.priority}` : ""}${t.parentId ? ` (child of #${t.parentId})` : ""}`)
    .join("\n");
}

export async function chat(messages: ChatMessage[], context: string): Promise<string> {
  const key = (getApiKey() || "anonymous").trim();
  const model = getModel();
  const system = `You are a todo-list coach. Help the user manage their todos. You may propose changes by emitting fenced code blocks tagged todo-change containing a JSON object. Format: {"action":"add"|"update"|"delete","id":"..." (for update/delete),"parentId":null|string (for add),"fields":{"title","notes","priority","dueAt","recurrence","done"}}. Nothing is saved until the user approves. Only propose changes when asked or when describing todos to record. Explain each change in a sentence. Format replies in Markdown. Current todos:\n${context}`;
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export function parseChanges(content: string): TodoChange[] {
  const out: TodoChange[] = [];
  const re = /```todo-change\s*([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim());
      if (obj && (obj.action === "add" || obj.action === "update" || obj.action === "delete")) {
        out.push(obj as TodoChange);
      }
    } catch {
      // ignore
    }
  }
  return out;
}
