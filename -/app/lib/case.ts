// «Дело»: находки, связи и история проверок. Всё хранится только в браузере (localStorage).
export type NodeType = "domain" | "ip" | "note";
export type CaseNode = { id: string; type: NodeType; value: string; note?: string; source?: string; ts: number };
export type CaseEdge = { from: string; to: string; label: string };
export type HistoryItem = { id: string; tool: string; value: string; ts: number };
export type CaseData = { nodes: CaseNode[]; edges: CaseEdge[]; history: HistoryItem[] };

const KEY = "uroboros-case-v1";
const EMPTY: CaseData = { nodes: [], edges: [], history: [] };

export const nodeId = (type: NodeType, value: string) => `${type}:${value.toLowerCase()}`;

export function loadCase(): CaseData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const d = JSON.parse(raw);
    return {
      nodes: Array.isArray(d.nodes) ? d.nodes : [],
      edges: Array.isArray(d.edges) ? d.edges : [],
      history: Array.isArray(d.history) ? d.history : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveCase(c: CaseData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}

export function recordHistory(tool: string, value: string) {
  const c = loadCase();
  const id = `${tool}:${value}`;
  c.history = [{ id, tool, value, ts: Date.now() }, ...c.history.filter((h) => h.id !== id)].slice(0, 200);
  saveCase(c);
}

export function addToCase(nodes: Omit<CaseNode, "ts">[], edges: CaseEdge[]): number {
  const c = loadCase();
  let added = 0;
  for (const n of nodes) {
    if (!c.nodes.some((x) => x.id === n.id)) {
      c.nodes.push({ ...n, ts: Date.now() });
      added++;
    }
  }
  for (const e of edges) {
    if (!c.edges.some((x) => x.from === e.from && x.to === e.to && x.label === e.label)) c.edges.push(e);
  }
  saveCase(c);
  return added;
}

export function parseEntity(text: string): { type: NodeType; value: string } {
  const v = text.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v) || /^[0-9a-f:]{3,45}$/i.test(v) && v.includes(":")) return { type: "ip", value: v };
  if (/^([a-z0-9-]{1,63}\.)+[a-z][a-z0-9-]{1,62}$/i.test(v)) return { type: "domain", value: v.toLowerCase() };
  return { type: "note", value: v };
}

// Превращаем результат модуля в узлы и связи графа
export function extractGraph(tool: string, data: any, domain: string): { nodes: Omit<CaseNode, "ts">[]; edges: CaseEdge[] } {
  const nodes: Omit<CaseNode, "ts">[] = [];
  const edges: CaseEdge[] = [];
  const root = nodeId("domain", domain);
  const add = (type: NodeType, value: string, label: string, source: string) => {
    if (!value) return;
    const id = nodeId(type, value);
    nodes.push({ id, type, value: value.toLowerCase(), source });
    if (id !== root) edges.push({ from: root, to: id, label });
  };
  nodes.push({ id: root, type: "domain", value: domain, source: tool });

  if (tool === "rdap") {
    for (const ns of data.nameservers ?? []) add("domain", ns, "NS", "rdap");
  } else if (tool === "dns") {
    for (const ip of data.records?.A ?? []) add("ip", ip, "A", "dns");
    for (const ip of data.records?.AAAA ?? []) add("ip", ip, "AAAA", "dns");
    for (const mx of data.records?.MX ?? []) add("domain", String(mx).split(" ").pop()!.replace(/\.$/, ""), "MX", "dns");
    for (const ns of data.records?.NS ?? []) add("domain", String(ns).replace(/\.$/, ""), "NS", "dns");
  } else if (tool === "subdomains") {
    for (const s of (data.subdomains ?? []).slice(0, 80)) add("domain", s, "поддомен", "subdomains");
  } else if (tool === "site-check") {
    try {
      const host = new URL(data.finalUrl).hostname;
      if (host !== domain) add("domain", host, "редирект", "site-check");
    } catch {}
  }
  return { nodes, edges };
}

export function toMarkdown(c: CaseData): string {
  const byType = (t: NodeType) => c.nodes.filter((n) => n.type === t);
  const line = (n: CaseNode) => `- ${n.value}${n.note ? ` — ${n.note}` : ""}`;
  const rel = c.edges.map((e) => `- ${e.from.split(":").slice(1).join(":")} → ${e.to.split(":").slice(1).join(":")} (${e.label})`);
  return [
    "# Дело Uroboros",
    `Составлено: ${new Date().toLocaleString("ru-RU")}`,
    "",
    "## Домены",
    ...byType("domain").map(line),
    "",
    "## IP-адреса",
    ...byType("ip").map(line),
    "",
    "## Заметки",
    ...byType("note").map(line),
    "",
    "## Связи",
    ...rel,
  ].join("\n");
}
