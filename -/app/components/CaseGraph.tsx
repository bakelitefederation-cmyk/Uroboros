"use client";
import { useMemo } from "react";
import type { CaseNode, CaseEdge } from "../lib/case";

const W = 760;
const H = 520;

// Простая силовая раскладка без внешних библиотек. Результат зависит только от данных, поэтому граф не «прыгает».
function layout(nodes: CaseNode[], edges: CaseEdge[]) {
  const n = nodes.length;
  const pos = nodes.map((_, i) => {
    const a = (2 * Math.PI * i) / Math.max(n, 1);
    const r = 120 + (i % 5) * 25;
    return { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a) };
  });
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const links = edges.map((e) => [idx.get(e.from), idx.get(e.to)] as const).filter((l) => l[0] !== undefined && l[1] !== undefined) as [number, number][];
  const k = Math.sqrt((W * H) / Math.max(n, 1)) * 0.7;

  for (let it = 0; it < 260; it++) {
    const t = 1 - it / 260;
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        const d = Math.max(Math.hypot(dx, dy), 0.5);
        const f = (k * k) / d;
        dx /= d; dy /= d;
        disp[i].x += dx * f; disp[i].y += dy * f;
        disp[j].x -= dx * f; disp[j].y -= dy * f;
      }
    }
    for (const [a, b] of links) {
      let dx = pos[a].x - pos[b].x;
      let dy = pos[a].y - pos[b].y;
      const d = Math.max(Math.hypot(dx, dy), 0.5);
      const f = (d * d) / k;
      dx /= d; dy /= d;
      disp[a].x -= dx * f; disp[a].y -= dy * f;
      disp[b].x += dx * f; disp[b].y += dy * f;
    }
    for (let i = 0; i < n; i++) {
      disp[i].x += (W / 2 - pos[i].x) * 0.05;
      disp[i].y += (H / 2 - pos[i].y) * 0.05;
      const d = Math.max(Math.hypot(disp[i].x, disp[i].y), 0.01);
      const lim = 30 * t + 1;
      pos[i].x = Math.min(W - 30, Math.max(30, pos[i].x + (disp[i].x / d) * Math.min(d, lim)));
      pos[i].y = Math.min(H - 20, Math.max(20, pos[i].y + (disp[i].y / d) * Math.min(d, lim)));
    }
  }
  return pos;
}

const COLORS: Record<string, string> = { domain: "#D4B16A", ip: "#9CC4E4", note: "#9CA3AF" };

export default function CaseGraph({
  nodes,
  edges,
  selected,
  onSelect,
}: {
  nodes: CaseNode[];
  edges: CaseEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const pos = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-lg border border-white/10 bg-black/30" role="img" aria-label="Граф связей дела">
      {edges.map((e, i) => {
        const a = idx.get(e.from), b = idx.get(e.to);
        if (a === undefined || b === undefined) return null;
        const hot = selected && (e.from === selected || e.to === selected);
        return (
          <g key={i}>
            <line x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} stroke={hot ? "#D4B16A" : "rgba(255,255,255,0.18)"} strokeWidth={hot ? 1.6 : 1} />
            {hot && (
              <text x={(pos[a].x + pos[b].x) / 2} y={(pos[a].y + pos[b].y) / 2} fontSize="10" fill="#D4B16A" textAnchor="middle">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((nd, i) => {
        const sel = nd.id === selected;
        const label = nd.value.length > 26 ? nd.value.slice(0, 25) + "…" : nd.value;
        return (
          <g
            key={nd.id}
            transform={`translate(${pos[i].x},${pos[i].y})`}
            onClick={() => onSelect(sel ? null : nd.id)}
            className="cursor-pointer"
            tabIndex={0}
            role="button"
            aria-label={nd.value}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(sel ? null : nd.id)}
          >
            <circle r={sel ? 9 : 6} fill={COLORS[nd.type]} stroke={sel ? "#fff" : "none"} strokeWidth="2" />
            <text y={-12} fontSize="10.5" fill="#E5E7EB" textAnchor="middle" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: 3 }}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
