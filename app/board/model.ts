// app/board/model.ts — типы доски, автоопределение формата, слой хранения
import { normalizeDomain } from '../lib/domain';

export type Kind = 'username' | 'email' | 'phone' | 'ip' | 'domain' | 'url' | 'note';
export type Shape = 'curved' | 'straight';
export type Dash = 'solid' | 'dashed';
export type NodeColor = 'slate' | 'gold' | 'blue' | 'green' | 'red' | 'violet';
export type NodeSize = 's' | 'm' | 'l';

export const KINDS: Kind[] = ['username', 'email', 'phone', 'ip', 'domain', 'url', 'note'];

export const KIND_LABEL: Record<Kind, string> = {
  username: 'ник',
  email: 'почта',
  phone: 'телефон',
  ip: 'IP',
  domain: 'домен',
  url: 'ссылка',
  note: 'заметка',
};

export const SIZES: Record<NodeSize, { w: number; h: number }> = {
  s: { w: 170, h: 76 },
  m: { w: 230, h: 104 },
  l: { w: 320, h: 160 },
};

export const COLORS: Record<NodeColor, { bg: string; border: string }> = {
  slate: { bg: '#17181b', border: '#32343a' },
  gold: { bg: '#2a2314', border: '#a8863a' },
  blue: { bg: '#131c2b', border: '#3b5f99' },
  green: { bg: '#14231a', border: '#3c7a4f' },
  red: { bg: '#2a1517', border: '#8f3b43' },
  violet: { bg: '#1f1a2e', border: '#6a56a8' },
};

export interface BoardNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  kind: Kind;
  kindAuto: boolean; // true — формат определяется по тексту автоматически
  color: NodeColor;
  size: NodeSize;
}

export interface BoardEdge {
  id: string;
  from: string; // стрелка идёт from → to
  to: string;
  shape: Shape; // по умолчанию 'curved'
  dash: Dash; // solid — подтверждённая связь, dashed — гипотеза
  label: string;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Board {
  version: 1;
  nodes: BoardNode[];
  edges: BoardEdge[];
  camera: Camera;
}

// ---- Поиск по карточке ----

export interface Lead {
  kind: Kind;
  value: string;
  label: string;
}

/** Отдельный модуль внутри запуска «все подходящие» */
export interface ToolPart {
  toolId: string;
  label: string;
  status: 'running' | 'done' | 'error';
  summary?: string;
  error?: string;
}

export interface ToolRun {
  status: 'running' | 'done' | 'error';
  toolId: string; // id модуля или 'all' для запуска всех подходящих
  query: string;
  summary?: string;
  raw?: unknown;
  leads: Lead[];
  parts?: ToolPart[]; // есть только у toolId === 'all'
  error?: string;
  at: number;
}

export interface SearchState {
  selectedNodeId: string | null;
  activeTool: string | null;
  searchResults: Record<string, ToolRun>; // по id карточки
}

// ---- Утилиты ----

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function detectKind(raw: string): Kind {
  const t = raw.trim();
  if (!t) return 'note';
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) return 'email';
  if (/^https?:\/\/\S+$/i.test(t)) return 'url';
  if (IPV4.test(t) || (/^[0-9a-f:]{3,}$/i.test(t) && (t.match(/:/g)?.length ?? 0) >= 2)) return 'ip';
  if (/^\+?[\d\s().-]{7,20}$/.test(t) && (t.match(/\d/g)?.length ?? 0) >= 7) return 'phone';
  if (!/[\s/@:]/.test(t) && normalizeDomain(t)) return 'domain'; // понимает и кириллические домены
  if (/^@?[\w.-]{3,32}$/.test(t) && !/^\d+$/.test(t)) return 'username';
  return 'note';
}

export function makeNode(
  x: number,
  y: number,
  text = '',
  patch: Partial<BoardNode> = {},
): BoardNode {
  const size = patch.size ?? 'm';
  const { w, h } = SIZES[size];
  return {
    id: uid(),
    x: x - w / 2,
    y: y - h / 2,
    w,
    h,
    text,
    kind: detectKind(text),
    kindAuto: true,
    color: 'slate',
    size,
    ...patch,
  };
}

// ---- Слой хранения (легко заменить на бэкенд) ----

export interface BoardStorage {
  load(): Promise<Board | null>;
  save(board: Board): Promise<void>;
}

const LS_KEY = 'uroboros.board.v1';

export const localBoardStorage: BoardStorage = {
  async load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as Board) : null;
    } catch {
      return null;
    }
  },
  async save(board) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(board));
    } catch {
      /* квота или приватный режим — молча пропускаем */
    }
  },
};

// Пример подключения к бэкенду: создайте app/api/board/route.ts (GET/PUT) и замените boardStorage.
export const apiBoardStorage = (url = '/api/board'): BoardStorage => ({
  async load() {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as Board | null) : null;
  },
  async save(board) {
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
  },
});

export const boardStorage: BoardStorage = localBoardStorage;