'use client';

// app/board/page.tsx — бесконечная доска в стиле Miro для Uroboros.
// Без внешних библиотек: холст — DOM + SVG, камера — CSS transform.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPE } from 'react';
import Link from 'next/link';
import {
  COLORS, KINDS, KIND_LABEL, SIZES, boardStorage, detectKind, makeNode, uid,
  type BoardEdge, type BoardNode, type Camera, type Dash, type Kind, type NodeColor,
  type NodeSize, type SearchState, type Shape, type ToolRun, type ToolPart, type Lead,
} from './model';
import { TOOLS, autoToolsFor, getTool, runTool as execTool, toolsFor } from './adapters';
import { freeSpot, snapRect, type GapMark, type GuideLine } from './guides';

// ---------- Геометрия связей ----------

type Side = 'top' | 'right' | 'bottom' | 'left';
const DIR: Record<Side, [number, number]> = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

function anchor(n: BoardNode, s: Side): [number, number] {
  if (s === 'top') return [n.x + n.w / 2, n.y];
  if (s === 'bottom') return [n.x + n.w / 2, n.y + n.h];
  if (s === 'left') return [n.x, n.y + n.h / 2];
  return [n.x + n.w, n.y + n.h / 2];
}

function sidesFor(a: BoardNode, b: BoardNode): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? ['right', 'left'] : ['left', 'right'];
  return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

function pathBetween(p1: [number, number], d1: [number, number], p2: [number, number], d2: [number, number] | null, shape: Shape) {
  const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  if (shape === 'straight') return { d: `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`, mid };
  const k = Math.max(50, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.4);
  const c1: [number, number] = [p1[0] + d1[0] * k, p1[1] + d1[1] * k];
  const c2: [number, number] = d2 ? [p2[0] + d2[0] * k, p2[1] + d2[1] * k] : p2;
  return {
    d: `M${p1[0]},${p1[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`,
    mid: [(p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8, (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8] as [number, number],
  };
}

const EDGE_COLOR: Record<Dash, string> = { solid: '#e2b45a', dashed: '#8aa4d6' };
const LABEL_PRESETS = ['связан с', 'использует', 'найден на', 'возможно связан'];
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);

// ---------- Страница ----------

export default function BoardPage() {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [cam, setCam] = useState<Camera>({ x: 120, y: 120, zoom: 1 });
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState<SearchState>({ selectedNodeId: null, activeTool: null, searchResults: {} });
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ shape: Shape; dash: Dash }>({ shape: 'curved', dash: 'solid' });
  const [connecting, setConnecting] = useState<{ from: string; side: Side; x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [snapOn, setSnapOn] = useState(true); // умные направляющие и привязка (Alt при перетаскивании — отключить на время)
  const [guides, setGuides] = useState<{ lines: GuideLine[]; gaps: GapMark[] } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const camRef = useRef(cam);
  camRef.current = cam;
  const abortRef = useRef<AbortController | null>(null);

  const selectedNode = nodes.find((n) => n.id === search.selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  // --- загрузка / сохранение ---
  useEffect(() => {
    boardStorage.load().then((b) => {
      if (b) {
        setNodes(b.nodes ?? []);
        setEdges(b.edges ?? []);
        if (b.camera) setCam(b.camera);
      }
      setLoaded(true);
    });
    try {
      if (localStorage.getItem('uroboros.board.snap') === '0') setSnapOn(false);
    } catch {
      /* без localStorage привязка просто включена */
    }
  }, []);

  const toggleSnap = () =>
    setSnapOn((v) => {
      try {
        localStorage.setItem('uroboros.board.snap', v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => boardStorage.save({ version: 1, nodes, edges, camera: cam }), 400);
    return () => clearTimeout(t);
  }, [nodes, edges, cam, loaded]);

  // --- координаты ---
  const toWorld = useCallback((cx: number, cy: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    const c = camRef.current;
    return { x: (cx - r.left - c.x) / c.zoom, y: (cy - r.top - c.y) / c.zoom };
  }, []);

  const viewCenter = useCallback(() => {
    const r = viewportRef.current!.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }, [toWorld]);

  // --- операции с доской ---
  const patchNode = useCallback((id: string, p: Partial<BoardNode>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...p } : n)));
  }, []);

  const setText = useCallback((id: string, text: string) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, text, kind: n.kindAuto ? detectKind(text) : n.kind } : n)),
    );
  }, []);

  const addNode = useCallback((x: number, y: number, text = '', patch: Partial<BoardNode> = {}) => {
    const n = makeNode(x, y, text, patch);
    setNodes((ns) => [...ns, n]);
    return n.id;
  }, []);

  const addEdge = useCallback(
    (from: string, to: string, extra: Partial<BoardEdge> = {}) => {
      if (from === to) return null;
      const e: BoardEdge = { id: uid(), from, to, shape: draft.shape, dash: draft.dash, label: '', ...extra };
      setEdges((es) => (es.some((x) => x.from === from && x.to === to) ? es : [...es, e]));
      return e.id;
    },
    [draft],
  );

  const patchEdge = (id: string, p: Partial<BoardEdge>) =>
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const removeNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
    setSearch((s) => (s.selectedNodeId === id ? { ...s, selectedNodeId: null } : s));
    setPanelOpen(false);
  }, []);

  const removeEdge = useCallback((id: string) => {
    setEdges((es) => es.filter((e) => e.id !== id));
    setSelectedEdgeId(null);
  }, []);

  const openNode = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    setSelectedEdgeId(null);
    setSearch((s) => ({
      ...s,
      selectedNodeId: id,
      activeTool: n ? (toolsFor(n.kind)[0]?.id ?? TOOLS[0]?.id ?? null) : null,
    }));
    setPanelOpen(true);
  };

  const clearSelection = () => {
    setSearch((s) => ({ ...s, selectedNodeId: null }));
    setSelectedEdgeId(null);
    setPanelOpen(false);
  };

  // Новая карточка встаёт ровно: притягивается к соседям и не ложится поверх других
  const placeNew = (cx: number, cy: number, avoidOverlap: boolean) => {
    const { w, h } = SIZES.m;
    const others = nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
    let r = { x: cx - w / 2, y: cy - h / 2, w, h };
    if (snapOn) {
      const s = snapRect(r, others, 14 / camRef.current.zoom);
      r = { ...r, x: s.x, y: s.y };
    }
    if (avoidOverlap) r = freeSpot(r, others, w + 24);
    return { x: r.x + w / 2, y: r.y + h / 2 };
  };

  const createCard = (x?: number, y?: number) => {
    const c0 = x === undefined || y === undefined ? viewCenter() : { x, y };
    const c = placeNew(c0.x, c0.y, x === undefined || y === undefined);
    const id = addNode(c.x, c.y);
    setEditingId(id);
    setSearch((s) => ({ ...s, selectedNodeId: id }));
    setSelectedEdgeId(null);
  };

  // --- поиск по карточке ---
  const runTool = async (node: BoardNode, toolId: string, query: string) => {
    const tool = getTool(toolId);
    if (!tool) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const base = { toolId, query, leads: [] as Lead[], at: Date.now() };
    const put = (r: ToolRun) => setSearch((s) => ({ ...s, searchResults: { ...s.searchResults, [node.id]: r } }));
    put({ ...base, status: 'running' });
    try {
      const out = await execTool(tool, query, ac.signal);
      put({ ...base, status: 'done', summary: out.summary, raw: out.raw, leads: out.leads, at: Date.now() });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        if (abortRef.current === ac) put({ ...base, status: 'error', error: 'Отменено', at: Date.now() });
        return;
      }
      put({ ...base, status: 'error', error: (e as Error).message, at: Date.now() });
    }
  };

  // Все подходящие формату модули сразу (по 3 параллельно); зацепки объединяются без дублей
  const runAll = async (node: BoardNode, query: string) => {
    const list = autoToolsFor(node.kind);
    if (!list.length) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const parts: ToolPart[] = list.map((t) => ({ toolId: t.id, label: t.label, status: 'running' }));
    const raws: Record<string, unknown> = {};
    const leadMap = new Map<string, Lead>();
    const base = { toolId: 'all', query, at: Date.now() };
    const put = (r: Omit<ToolRun, 'toolId' | 'query' | 'at'> & Partial<ToolRun>) =>
      setSearch((s) => ({ ...s, searchResults: { ...s.searchResults, [node.id]: { ...base, ...r } as ToolRun } }));
    const progress = () => put({ status: 'running', parts: parts.map((p) => ({ ...p })), leads: [...leadMap.values()] });
    progress();

    let next = 0;
    const worker = async () => {
      while (next < list.length && !ac.signal.aborted) {
        const i = next++;
        try {
          const out = await execTool(list[i], query, ac.signal);
          parts[i] = { ...parts[i], status: 'done', summary: out.summary };
          raws[list[i].id] = out.raw;
          out.leads.forEach((l) => {
            const k = `${l.kind}:${l.value.toLowerCase()}`;
            if (!leadMap.has(k)) leadMap.set(k, l);
          });
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          parts[i] = { ...parts[i], status: 'error', error: (e as Error).message };
        }
        if (!ac.signal.aborted) progress();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
    if (ac.signal.aborted) {
      if (abortRef.current === ac) put({ status: 'error', error: 'Отменено', leads: [...leadMap.values()], parts: parts.map((p) => ({ ...p })) });
      return;
    }

    const ok = parts.filter((p) => p.status === 'done').length;
    put({
      status: ok ? 'done' : 'error',
      summary: `Выполнено модулей: ${ok} из ${list.length}`,
      error: ok ? undefined : 'Ни один модуль не ответил',
      raw: raws,
      leads: [...leadMap.values()],
      parts: parts.map((p) => ({ ...p })),
      at: Date.now(),
    });
  };

  const cancelTool = () => abortRef.current?.abort();

  // Зацепки ложатся ровной сеткой справа от источника (столбцы по 8, равные промежутки, по центру относительно него)
  const addLeadsToBoard = (source: BoardNode, leads: Lead[]) => {
    if (!leads.length) return;
    const gapY = 20;
    const gapX = 40;
    const rows = 8;
    const { w: cw, h: ch } = SIZES.s;

    const fresh: BoardNode[] = [];
    const links: Array<{ from: string; label: string }> = [];
    const toPlace: Lead[] = [];
    leads.forEach((l) => {
      const existing = nodes.find((n) => n.kind === l.kind && n.text.trim().toLowerCase() === l.value.toLowerCase());
      if (existing) links.push({ from: existing.id, label: l.label });
      else toPlace.push(l);
    });

    if (toPlace.length) {
      const cols = Math.ceil(toPlace.length / rows);
      const colHeight = (n: number) => n * ch + (n - 1) * gapY;
      const tallest = colHeight(Math.min(rows, toPlace.length));
      const groupW = cols * cw + (cols - 1) * gapX;
      // свободное место справа от источника, чтобы не лечь поверх чужих карточек
      const spot = freeSpot(
        { x: source.x + source.w + 120, y: source.y + source.h / 2 - tallest / 2, w: groupW, h: tallest },
        nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })),
        cw + gapX,
      );
      toPlace.forEach((l, i) => {
        const col = Math.floor(i / rows);
        const inCol = Math.min(rows, toPlace.length - col * rows);
        const top = source.y + source.h / 2 - colHeight(inCol) / 2;
        const n = makeNode(spot.x + col * (cw + gapX) + cw / 2, top + (i % rows) * (ch + gapY) + ch / 2, l.value, {
          size: 's',
          kind: l.kind,
          color: 'blue',
        });
        fresh.push(n);
        links.push({ from: n.id, label: l.label });
      });
    }

    setNodes((ns) => [...ns, ...fresh]);
    setEdges((es) => {
      const add = links
        .filter((l) => !es.some((e) => e.from === l.from && e.to === source.id))
        .map<BoardEdge>((l) => ({ id: uid(), from: l.from, to: source.id, shape: draft.shape, dash: 'dashed', label: l.label || 'найден на' }));
      return [...es, ...add];
    });
  };

  // Результат без зацепок (в т.ч. "ничего не найдено") ложится заметкой, привязанной к источнику
  const addNoteToBoard = (source: BoardNode, text: string) => {
    const { w, h } = SIZES.m;
    const spot = freeSpot(
      { x: source.x + source.w + 120, y: source.y + source.h / 2 - h / 2, w, h },
      nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })),
      w + 40,
    );
    const n = makeNode(spot.x + w / 2, spot.y + h / 2, text, { size: 'm', kind: 'note', color: 'slate' });
    setNodes((ns) => [...ns, n]);
    setEdges((es) => [...es, { id: uid(), from: n.id, to: source.id, shape: draft.shape, dash: 'dashed', label: 'результат' }]);
  };

  // --- колесо: масштаб к курсору ---
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setCam((c) => {
        const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * Math.exp(-e.deltaY * 0.0015)));
        const k = z / c.zoom;
        return { zoom: z, x: mx - (mx - c.x) * k, y: my - (my - c.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // --- клавиатура: стрелки двигают ТОЛЬКО камеру ---
  useEffect(() => {
    const keys = new Set<string>();
    let fast = false;
    let raf = 0;
    let last = 0;

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const speed = fast ? 1500 : 450; // px/с в экранных координатах
      let dx = 0;
      let dy = 0;
      if (keys.has('ArrowLeft')) dx += speed * dt;
      if (keys.has('ArrowRight')) dx -= speed * dt;
      if (keys.has('ArrowUp')) dy += speed * dt;
      if (keys.has('ArrowDown')) dy -= speed * dt;
      if (dx || dy) setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      raf = keys.size ? requestAnimationFrame(tick) : 0;
    };

    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      fast = e.shiftKey;
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        keys.add(e.key);
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      fast = e.shiftKey;
      keys.delete(e.key);
    };
    const blur = () => keys.clear();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      cancelAnimationFrame(raf);
    };
  }, []);

  // --- Delete удаляет выбранную связь / карточку ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
      if (selectedEdgeId) removeEdge(selectedEdgeId);
      else if (search.selectedNodeId) removeNode(search.selectedNodeId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEdgeId, search.selectedNodeId, removeEdge, removeNode]);

  // --- перемещение холста мышью ---
  const pan = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null);

  const onViewportDown = (e: RPE<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as Element).closest('[data-node],[data-edge]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    setPanning(true);
  };
  const onViewportMove = (e: RPE<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true;
    setCam((c) => ({ ...c, x: p.cx + dx, y: p.cy + dy }));
  };
  const onViewportUp = () => {
    if (pan.current && !pan.current.moved) clearSelection();
    pan.current = null;
    setPanning(false);
  };

  const zoomBy = (f: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    const mx = r.width / 2;
    const my = r.height / 2;
    setCam((c) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * f));
      const k = z / c.zoom;
      return { zoom: z, x: mx - (mx - c.x) * k, y: my - (my - c.y) * k };
    });
  };

  const fitAll = () => {
    const r = viewportRef.current!.getBoundingClientRect();
    if (!nodes.length) return setCam({ x: 120, y: 120, zoom: 1 });
    const x1 = Math.min(...nodes.map((n) => n.x));
    const y1 = Math.min(...nodes.map((n) => n.y));
    const x2 = Math.max(...nodes.map((n) => n.x + n.w));
    const y2 = Math.max(...nodes.map((n) => n.y + n.h));
    const z = Math.min(1.2, Math.max(MIN_ZOOM, Math.min((r.width - 120) / (x2 - x1), (r.height - 160) / (y2 - y1))));
    setCam({ zoom: z, x: (r.width - (x2 - x1) * z) / 2 - x1 * z, y: (r.height - (y2 - y1) * z) / 2 - y1 * z });
  };

  // --- создание связи за порт ---
  const startConnect = (e: RPE<HTMLElement>, from: string, side: Side) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    setConnecting({ from, side, x: w.x, y: w.y });
  };
  const moveConnect = (e: RPE<HTMLElement>) => {
    if (!connecting) return;
    const w = toWorld(e.clientX, e.clientY);
    setConnecting({ ...connecting, x: w.x, y: w.y });
  };
  const endConnect = (e: RPE<HTMLElement>) => {
    if (!connecting) return;
    const hit = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-node-id]');
    const toId = hit?.getAttribute('data-node-id');
    if (toId) addEdge(connecting.from, toId);
    else {
      const w = toWorld(e.clientX, e.clientY);
      const c = placeNew(w.x + 60, w.y, false);
      const id = addNode(c.x, c.y);
      addEdge(connecting.from, id);
      setEditingId(id);
      setSearch((s) => ({ ...s, selectedNodeId: id }));
    }
    setConnecting(null);
  };

  // --- перетаскивание карточки (только мышью) ---
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const onNodeDown = (e: RPE<HTMLDivElement>, n: BoardNode) => {
    if (e.button !== 0 || (e.target as Element).closest('[data-handle],button,textarea,select')) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false };
  };
  const onNodeMove = (e: RPE<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    d.moved = true;
    const z = camRef.current.zoom;
    const nx = d.ox + dx / z;
    const ny = d.oy + dy / z;
    const me = nodes.find((n) => n.id === d.id);
    if (snapOn && !e.altKey && me) {
      const others = nodes.filter((n) => n.id !== d.id).map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
      const r = snapRect({ x: nx, y: ny, w: me.w, h: me.h }, others, 8 / z);
      patchNode(d.id, { x: r.x, y: r.y });
      setGuides(r.lines.length || r.gaps.length ? { lines: r.lines, gaps: r.gaps } : null);
    } else {
      patchNode(d.id, { x: nx, y: ny });
      setGuides(null);
    }
  };
  const onNodeUp = () => {
    const d = drag.current;
    drag.current = null;
    setGuides(null);
    if (d && !d.moved) openNode(d.id);
  };

  // --- рендер ---
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const connSrc = connecting ? byId.get(connecting.from) : undefined;
  const connPath =
    connecting && connSrc
      ? pathBetween(anchor(connSrc, connecting.side), DIR[connecting.side], [connecting.x, connecting.y], null, draft.shape).d
      : null;

  return (
    <div className="ub-root">
      <style>{CSS}</style>

      <div
        ref={viewportRef}
        className={`ub-viewport${panning ? ' panning' : ''}`}
        style={{
          backgroundSize: `${28 * cam.zoom}px ${28 * cam.zoom}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
        }}
        onPointerDown={onViewportDown}
        onPointerMove={onViewportMove}
        onPointerUp={onViewportUp}
        onDoubleClick={(e) => {
          if ((e.target as Element).closest('[data-node],[data-edge]')) return;
          const w = toWorld(e.clientX, e.clientY);
          createCard(w.x, w.y);
        }}
      >
        <div className="ub-world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})` }}>
          <svg className="ub-edges">
            <defs>
              {(['solid', 'dashed'] as Dash[]).map((k) => (
                <marker key={k} id={`ah-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLOR[k]} />
                </marker>
              ))}
            </defs>

            {edges.map((e) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const [sa, sb] = sidesFor(a, b);
              const { d, mid } = pathBetween(anchor(a, sa), DIR[sa], anchor(b, sb), DIR[sb], e.shape);
              const sel = e.id === selectedEdgeId;
              return (
                <g key={e.id} data-edge>
                  <path
                    d={d}
                    fill="none"
                    stroke={EDGE_COLOR[e.dash]}
                    strokeWidth={sel ? 3 : 2}
                    strokeDasharray={e.dash === 'dashed' ? '8 6' : undefined}
                    strokeLinecap="round"
                    markerEnd={`url(#ah-${e.dash})`}
                    style={{ filter: sel ? `drop-shadow(0 0 4px ${EDGE_COLOR[e.dash]})` : undefined }}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdgeId(e.id);
                      setSearch((s) => ({ ...s, selectedNodeId: null }));
                      setPanelOpen(false);
                    }}
                  />
                </g>
              );
            })}

            {guides?.lines.map((l, i) =>
              l.axis === 'x' ? (
                <line key={`gl${i}`} className="ub-guide" x1={l.pos} x2={l.pos} y1={l.from - 14} y2={l.to + 14} />
              ) : (
                <line key={`gl${i}`} className="ub-guide" y1={l.pos} y2={l.pos} x1={l.from - 14} x2={l.to + 14} />
              ),
            )}
            {guides?.gaps.map((g, i) => (
              <GapView key={`gp${i}`} g={g} zoom={cam.zoom} />
            ))}

            {connPath && <path d={connPath} fill="none" stroke={EDGE_COLOR[draft.dash]} strokeWidth={2} strokeDasharray={draft.dash === 'dashed' ? '8 6' : undefined} markerEnd={`url(#ah-${draft.dash})`} />}
          </svg>

          {nodes.map((n) => {
            const col = COLORS[n.color];
            const sel = n.id === search.selectedNodeId;
            return (
              <div
                key={n.id}
                data-node
                data-node-id={n.id}
                className={`ub-node${sel ? ' sel' : ''}${connecting?.from === n.id ? ' src' : ''}`}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h, background: col.bg, borderColor: sel ? '#e2b45a' : col.border }}
                onPointerDown={(e) => onNodeDown(e, n)}
                onPointerMove={onNodeMove}
                onPointerUp={onNodeUp}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingId(n.id); }}
              >
                <div className="ub-node-head">
                  <span className="ub-kind">{KIND_LABEL[n.kind]}</span>
                  <button className="ub-mini" onClick={() => openNode(n.id)} title="Открыть модули">Проверить</button>
                </div>
                {editingId === n.id ? (
                  <textarea
                    className="ub-edit"
                    autoFocus
                    defaultValue={n.text}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setText(n.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); e.currentTarget.blur(); }
                    }}
                  />
                ) : (
                  <div className={`ub-text${n.text ? '' : ' empty'}`}>{n.text || 'Двойной клик — ввести текст'}</div>
                )}
                {SIDES.map((s) => (
                  <i
                    key={s}
                    data-handle
                    className={`ub-handle ${s}`}
                    onPointerDown={(e) => startConnect(e, n.id, s)}
                    onPointerMove={moveConnect}
                    onPointerUp={endConnect}
                    title="Потяните, чтобы создать связь"
                  />
                ))}
              </div>
            );
          })}
          <svg className="ub-edges ub-labels">
            {edges.map((e) => {
              if (!e.label) return null;
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const [sa, sb] = sidesFor(a, b);
              const { mid } = pathBetween(anchor(a, sa), DIR[sa], anchor(b, sb), DIR[sb], e.shape);
              const hidden = nodes.some((n) => mid[0] > n.x - 6 && mid[0] < n.x + n.w + 6 && mid[1] > n.y - 6 && mid[1] < n.y + n.h + 6);
              if (hidden) return null;
              const w = e.label.length * 6.6 + 14;
              return (
                <g key={`lb${e.id}`} data-edge style={{ cursor: 'pointer', pointerEvents: 'all' }}
                  onPointerDown={(ev) => { ev.stopPropagation(); setSelectedEdgeId(e.id); setSearch((s) => ({ ...s, selectedNodeId: null })); setPanelOpen(false); }}>
                  <rect x={mid[0] - w / 2} y={mid[1] - 20} width={w} height={18} rx={9} className="ub-edge-pill" />
                  <text x={mid[0]} y={mid[1] - 7} textAnchor="middle" className="ub-edge-label">{e.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {!nodes.length && loaded && (
          <div className="ub-empty">
            <b>Доска пуста</b>
            <span>Двойной клик по холсту создаёт карточку. Стрелки на клавиатуре двигают вид.</span>
          </div>
        )}
      </div>

      {/* Верхняя панель */}
      <div className="ub-toolbar">
        <Link href="/" className="ub-btn">← Все модули</Link>
        <button className="ub-btn gold" onClick={() => createCard()}>+ Карточка</button>
        <div className="ub-seg" title="Форма новых связей">
          {(['curved', 'straight'] as Shape[]).map((s) => (
            <button key={s} className={draft.shape === s ? 'on' : ''} onClick={() => setDraft((d) => ({ ...d, shape: s }))}>
              {s === 'curved' ? 'Скруглённая' : 'Прямая'}
            </button>
          ))}
        </div>
        <div className="ub-seg" title="Штрих новых связей">
          {(['solid', 'dashed'] as Dash[]).map((s) => (
            <button key={s} className={draft.dash === s ? 'on' : ''} onClick={() => setDraft((d) => ({ ...d, dash: s }))}>
              {s === 'solid' ? 'Сплошная' : 'Пунктир'}
            </button>
          ))}
        </div>
        <div className="ub-seg" title="Умные направляющие: выравнивание и равные промежутки при перетаскивании. Alt — отключить на время.">
          <button className={snapOn ? 'on' : ''} onClick={toggleSnap}>
            🧲 Привязка {snapOn ? 'вкл' : 'выкл'}
          </button>
        </div>
        <div className="ub-seg">
          <button onClick={() => zoomBy(1 / 1.2)}>−</button>
          <button onClick={fitAll} title="Показать всё">{Math.round(cam.zoom * 100)}%</button>
          <button onClick={() => zoomBy(1.2)}>+</button>
        </div>
        <button
          className="ub-btn danger"
          onClick={() => {
            if (nodes.length && confirm('Очистить всю доску?')) {
              setNodes([]); setEdges([]); clearSelection();
              setSearch({ selectedNodeId: null, activeTool: null, searchResults: {} });
            }
          }}
        >
          Очистить
        </button>
      </div>

      {/* Редактор связи */}
      {selectedEdge && (
        <div className="ub-edge-editor">
          <div className="ub-seg">
            {(['curved', 'straight'] as Shape[]).map((s) => (
              <button key={s} className={selectedEdge.shape === s ? 'on' : ''} onClick={() => patchEdge(selectedEdge.id, { shape: s })}>
                {s === 'curved' ? 'Скруглённая' : 'Прямая'}
              </button>
            ))}
          </div>
          <div className="ub-seg">
            {(['solid', 'dashed'] as Dash[]).map((s) => (
              <button key={s} className={selectedEdge.dash === s ? 'on' : ''} onClick={() => patchEdge(selectedEdge.id, { dash: s })}>
                {s === 'solid' ? 'Сплошная (подтверждено)' : 'Пунктир (гипотеза)'}
              </button>
            ))}
          </div>
          <input
            className="ub-input"
            placeholder="Подпись связи"
            value={selectedEdge.label}
            onChange={(e) => patchEdge(selectedEdge.id, { label: e.target.value })}
          />
          <div className="ub-chips">
            {LABEL_PRESETS.map((l) => (
              <button key={l} onClick={() => patchEdge(selectedEdge.id, { label: l, ...(l === 'возможно связан' ? { dash: 'dashed' as Dash } : {}) })}>
                {l}
              </button>
            ))}
            <button onClick={() => patchEdge(selectedEdge.id, { from: selectedEdge.to, to: selectedEdge.from })}>⇄ Развернуть</button>
            <button className="danger" onClick={() => removeEdge(selectedEdge.id)}>Удалить</button>
          </div>
        </div>
      )}

      {/* Панель модулей */}
      {panelOpen && selectedNode && (
        <ToolPanel
          key={selectedNode.id}
          node={selectedNode}
          run={search.searchResults[selectedNode.id]}
          activeTool={search.activeTool}
          onTool={(id) => setSearch((s) => ({ ...s, activeTool: id }))}
          onRun={(q) => runTool(selectedNode, search.activeTool ?? '', q)}
          onRunAll={(q) => runAll(selectedNode, q)}
          onCancel={cancelTool}
          onAdd={(leads) => addLeadsToBoard(selectedNode, leads)}
          onAddNote={(t) => addNoteToBoard(selectedNode, t)}
          onPatch={(p) => patchNode(selectedNode.id, p)}
          onDelete={() => removeNode(selectedNode.id)}
          onClose={() => setPanelOpen(false)}
          setText={(t) => setText(selectedNode.id, t)}
        />
      )}
    </div>
  );
}

// ---------- Размер промежутка между карточками (подсказка равных отступов) ----------

function GapView({ g, zoom }: { g: GapMark; zoom: number }) {
  const t = 5 / zoom; // половина длины засечки
  const fs = 11 / zoom;
  const horizontal = g.axis === 'x';
  const mid = (g.from + g.to) / 2;
  return (
    <g className="ub-gap">
      {horizontal ? (
        <>
          <line x1={g.from} x2={g.to} y1={g.at} y2={g.at} />
          <line x1={g.from} x2={g.from} y1={g.at - t} y2={g.at + t} />
          <line x1={g.to} x2={g.to} y1={g.at - t} y2={g.at + t} />
          <text x={mid} y={g.at + 15 / zoom} textAnchor="middle" fontSize={fs}>{Math.round(g.gap)}</text>
        </>
      ) : (
        <>
          <line x1={g.at} x2={g.at} y1={g.from} y2={g.to} />
          <line x1={g.at - t} x2={g.at + t} y1={g.from} y2={g.from} />
          <line x1={g.at - t} x2={g.at + t} y1={g.to} y2={g.to} />
          <text x={g.at + 8 / zoom} y={mid + fs / 3} fontSize={fs}>{Math.round(g.gap)}</text>
        </>
      )}
    </g>
  );
}

// ---------- Боковая панель ----------

interface PanelProps {
  node: BoardNode;
  run?: ToolRun;
  activeTool: string | null;
  onTool: (id: string) => void;
  onRun: (query: string) => void;
  onRunAll: (query: string) => void;
  onCancel: () => void;
  onAdd: (leads: Lead[]) => void;
  onAddNote: (text: string) => void;
  onPatch: (p: Partial<BoardNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  setText: (t: string) => void;
}

function ToolPanel(p: PanelProps) {
  const { node, run } = p;
  const [query, setQuery] = useState(node.text);
  const [off, setOff] = useState<Set<string>>(new Set());

  useEffect(() => setQuery(node.text), [node.text]);
  useEffect(() => setOff(new Set()), [run?.at]);

  const matching = toolsFor(node.kind);
  const others = TOOLS.filter((t) => !matching.includes(t));
  const running = run?.status === 'running';
  const key = (l: Lead) => `${l.kind}:${l.value}`;
  const chosen = (run?.leads ?? []).filter((l) => !off.has(key(l)));

  return (
    <aside className="ub-panel">
      <header>
        <b>Проверка</b>
        <button className="ub-mini" onClick={p.onClose}>✕</button>
      </header>

      <section>
        <label>Значение карточки</label>
        <textarea className="ub-input" rows={2} value={node.text} onChange={(e) => p.setText(e.target.value)} />
        <div className="ub-row">
          <select
            className="ub-input"
            value={node.kindAuto ? 'auto' : node.kind}
            onChange={(e) => {
              if (e.target.value === 'auto') p.onPatch({ kindAuto: true, kind: detectKind(node.text) });
              else p.onPatch({ kindAuto: false, kind: e.target.value as Kind });
            }}
          >
            <option value="auto">Формат: авто ({KIND_LABEL[node.kind]})</option>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div className="ub-row">
          {(Object.keys(COLORS) as NodeColor[]).map((c) => (
            <button key={c} className={`ub-dot${node.color === c ? ' on' : ''}`} style={{ background: COLORS[c].border }} onClick={() => p.onPatch({ color: c })} aria-label={c} />
          ))}
          <span className="ub-spacer" />
          {(['s', 'm', 'l'] as NodeSize[]).map((s) => (
            <button key={s} className={`ub-mini${node.size === s ? ' on' : ''}`} onClick={() => p.onPatch({ size: s, w: SIZES[s].w, h: SIZES[s].h })}>
              {s.toUpperCase()}
            </button>
          ))}
          <button className="ub-mini danger" onClick={p.onDelete}>Удалить</button>
        </div>
      </section>

      <section>
        <label>Модуль</label>
        <select className="ub-input" value={p.activeTool ?? ''} onChange={(e) => p.onTool(e.target.value)}>
          {matching.length > 0 && (
            <optgroup label="Подходят формату">
              {matching.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </optgroup>
          )}
          <optgroup label="Другие">
            {others.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </optgroup>
        </select>
        {getTool(p.activeTool)?.hint && <p className="ub-muted ub-hint">{getTool(p.activeTool)?.hint}</p>}
        <label>Запрос</label>
        <input
          className="ub-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim() && !running) p.onRun(query.trim()); }}
        />
        <div className="ub-row">
          <button className="ub-btn gold" disabled={!query.trim() || !p.activeTool || running} onClick={() => p.onRun(query.trim())}>
            {running ? 'Выполняется…' : 'Запустить поиск'}
          </button>
          {running && <button className="ub-btn" onClick={p.onCancel}>Отмена</button>}
        </div>
        {autoToolsFor(node.kind).length > 1 && (
          <button className="ub-btn" disabled={!query.trim() || running} onClick={() => p.onRunAll(query.trim())} title="Запускает все модули, подходящие формату карточки, и собирает зацепки вместе">
            Запустить все подходящие ({autoToolsFor(node.kind).length})
          </button>
        )}
      </section>

      {run && (
        <section>
          <div className={`ub-status ${run.status}`}>
            {run.status === 'running' && 'Идёт проверка…'}
            {run.status === 'done' && (run.summary ?? 'Готово')}
            {run.status === 'error' && `Ошибка: ${run.error}`}
          </div>

          {run.parts && (
            <ul className="ub-parts">
              {run.parts.map((pt) => (
                <li key={pt.toolId}>
                  <i className={`ub-pdot ${pt.status}`} />
                  <div>
                    <b>{pt.label}</b>
                    <span className="ub-muted">
                      {pt.status === 'running' ? ' выполняется…' : pt.status === 'error' ? ` ошибка: ${pt.error}` : ` ${pt.summary}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {run.status === 'done' && (
            <>
              {run.leads.length ? (
                <ul className="ub-leads">
                  {run.leads.map((l) => (
                    <li key={key(l)}>
                      <label>
                        <input
                          type="checkbox"
                          checked={!off.has(key(l))}
                          onChange={(e) => {
                            const n = new Set(off);
                            if (e.target.checked) n.delete(key(l)); else n.add(key(l));
                            setOff(n);
                          }}
                        />
                        <span className="ub-kind">{KIND_LABEL[l.kind]}</span>
                        <span className="ub-lead-val">{l.value}</span>
                        {l.label && <span className="ub-lead-label">{l.label}</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ub-muted">Новых зацепок в ответе не нашлось.</p>
              )}
              {chosen.length > 0 && (
                <button className="ub-btn gold" onClick={() => p.onAdd(chosen)}>
                  Добавить результат на доску ({chosen.length})
                </button>
              )}
              <button
                className={`ub-btn${chosen.length ? '' : ' gold'}`}
                onClick={() => p.onAddNote(`${getTool(p.activeTool)?.label ?? 'Результат'}: ${run.summary || (run.leads.length ? '' : 'ничего не найдено')}`.trim())}
              >
                {run.leads.length ? 'Добавить сводку заметкой' : 'Добавить на доску как заметку'}
              </button>
              <details>
                <summary>Сырой ответ</summary>
                <pre>{typeof run.raw === 'string' ? run.raw : JSON.stringify(run.raw, null, 2)}</pre>
              </details>
            </>
          )}
        </section>
      )}
    </aside>
  );
}

// ---------- Стили (под тёмную тему Uroboros с золотым акцентом) ----------

const CSS = `
.ub-root{position:fixed;inset:0;background:#08080a;color:#e8e6e1;font:14px/1.4 inherit;overflow:hidden}
.ub-viewport{position:absolute;inset:0;cursor:grab;touch-action:none;
  background-image:radial-gradient(circle,#2b2c31 1.2px,transparent 1.4px)}
.ub-viewport.panning{cursor:grabbing}
.ub-world{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0}
.ub-edges{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.ub-edge-label{fill:#d9d6cf;font-size:12px;pointer-events:none}
.ub-edge-pill{fill:#0f0f11;stroke:#2c2e33;stroke-width:1}
.ub-labels{z-index:3}
.ub-node{z-index:2}
.ub-node{position:absolute;box-sizing:border-box;border:1px solid;border-radius:14px;padding:8px 12px;cursor:grab;
  display:flex;flex-direction:column;gap:4px;user-select:none}
.ub-node.sel{box-shadow:0 0 0 3px rgba(226,180,90,.18)}
.ub-node-head{display:flex;justify-content:space-between;align-items:center}
.ub-kind{font-size:11px;color:#a8a59d;background:rgba(255,255,255,.06);border-radius:999px;padding:1px 8px}
.ub-text{flex:1;min-height:0;overflow:hidden;overflow-wrap:anywhere;font-size:13px;line-height:1.25;white-space:pre-wrap}
.ub-text.empty{color:#6b6963}
.ub-edit{flex:1;resize:none;background:rgba(0,0,0,.35);border:1px solid #a8863a;border-radius:8px;color:inherit;font:inherit;padding:4px 6px;outline:none}
.ub-handle{position:absolute;width:14px;height:14px;border-radius:50%;background:#e2b45a;border:2px solid #08080a;
  opacity:0;transition:opacity .12s;cursor:crosshair;touch-action:none}
.ub-node:hover .ub-handle,.ub-node.sel .ub-handle,.ub-node.src .ub-handle{opacity:1}
.ub-handle.top{left:calc(50% - 7px);top:-8px}.ub-handle.bottom{left:calc(50% - 7px);bottom:-8px}
.ub-handle.left{top:calc(50% - 7px);left:-8px}.ub-handle.right{top:calc(50% - 7px);right:-8px}
.ub-empty{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);text-align:center;color:#8c8a84;
  display:flex;flex-direction:column;gap:6px;pointer-events:none}
.ub-empty b{color:#e8e6e1;font-size:18px}

.ub-toolbar{position:absolute;top:14px;left:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:5}
.ub-btn,.ub-mini,.ub-seg button,.ub-chips button{background:#141416;border:1px solid #2c2e33;color:#e8e6e1;border-radius:999px;
  padding:7px 14px;cursor:pointer;font:inherit;text-decoration:none}
.ub-btn:hover,.ub-mini:hover,.ub-seg button:hover,.ub-chips button:hover{border-color:#a8863a}
.ub-btn:disabled{opacity:.45;cursor:default}
.ub-btn.gold{background:#2a2314;border-color:#a8863a;color:#f0c870}
.ub-btn.danger,.ub-mini.danger,.ub-chips .danger{color:#d9737b;border-color:#4a2a2d}
.ub-mini{padding:2px 10px;font-size:12px}.ub-mini.on{border-color:#e2b45a;color:#f0c870}
.ub-seg{display:flex;background:#141416;border:1px solid #2c2e33;border-radius:999px;padding:2px}
.ub-seg button{border:0;background:transparent;padding:5px 12px}
.ub-seg button.on{background:#2a2314;color:#f0c870}

.ub-edge-editor{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:5;display:flex;flex-direction:column;gap:8px;
  background:#101012;border:1px solid #2c2e33;border-radius:16px;padding:12px;width:min(520px,calc(100% - 32px))}
.ub-chips{display:flex;gap:6px;flex-wrap:wrap}.ub-chips button{padding:4px 10px;font-size:12px}

.ub-panel{position:absolute;right:0;top:0;bottom:0;width:360px;max-width:100%;z-index:6;background:#0f0f11;border-left:1px solid #2c2e33;
  overflow:auto;display:flex;flex-direction:column}
.ub-panel header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1f2024;font-size:16px}
.ub-panel section{padding:14px 16px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid #1f2024}
.ub-panel label{font-size:12px;color:#8c8a84}
.ub-input{width:100%;box-sizing:border-box;background:#141416;border:1px solid #2c2e33;border-radius:10px;color:#e8e6e1;padding:8px 10px;font:inherit;outline:none}
.ub-input:focus{border-color:#a8863a}
.ub-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ub-spacer{flex:1}
.ub-dot{width:20px;height:20px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}.ub-dot.on{border-color:#fff}
.ub-status{padding:8px 10px;border-radius:10px;background:#141416;border:1px solid #2c2e33}
.ub-status.error{color:#d9737b;border-color:#4a2a2d}.ub-status.running{color:#f0c870}
.ub-leads{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto}
.ub-leads label{display:flex;gap:8px;align-items:center;color:#e8e6e1;font-size:13px;cursor:pointer}
.ub-lead-val{word-break:break-all}.ub-muted{color:#8c8a84;margin:0}
.ub-guide{stroke:#ff4d8d;stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-linecap:round}
.ub-gap line{stroke:#3fd6c4;stroke-width:1.5;vector-effect:non-scaling-stroke}
.ub-gap text{fill:#3fd6c4;paint-order:stroke;stroke:#08080a;stroke-width:3px;font-weight:600}
.ub-hint{font-size:12px}
.ub-parts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13px}
.ub-parts li{display:flex;gap:8px;align-items:flex-start}
.ub-pdot{flex:none;width:8px;height:8px;border-radius:50%;margin-top:6px;background:#555}
.ub-pdot.running{background:#f0c870;animation:ub-pulse 1s ease-in-out infinite}
.ub-pdot.done{background:#5fbf7f}.ub-pdot.error{background:#d9737b}
@keyframes ub-pulse{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.ub-pdot.running{animation:none}}
.ub-lead-label{margin-left:auto;color:#8c8a84;font-size:11px;white-space:nowrap}
.ub-panel details pre{max-height:240px;overflow:auto;background:#141416;border-radius:10px;padding:8px;font-size:11px;white-space:pre-wrap;word-break:break-all}
@media (max-width:640px){.ub-panel{width:100%}}
`;