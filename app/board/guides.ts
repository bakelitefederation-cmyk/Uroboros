// app/board/guides.ts — «умные направляющие» как в Miro.
// Чистая логика без React: при перетаскивании карточки подсказывает выравнивание по краям и центрам
// соседних карточек и одинаковые промежутки между ними. Всё считается в координатах доски.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Линия выравнивания. axis 'x' — вертикальная линия на x = pos, тянется по y от from до to. */
export interface GuideLine {
  axis: 'x' | 'y';
  pos: number;
  from: number;
  to: number;
}

/** Размер промежутка. axis 'x' — горизонтальный промежуток от from до to на высоте at. */
export interface GapMark {
  axis: 'x' | 'y';
  from: number;
  to: number;
  at: number;
  gap: number;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  lines: GuideLine[];
  gaps: GapMark[];
}

type Axis = 'x' | 'y';

const EPS = 0.75; // допуск при поиске совпадений уже после привязки

const pos = (r: Rect, a: Axis) => (a === 'x' ? r.x : r.y);
const size = (r: Rect, a: Axis) => (a === 'x' ? r.w : r.h);
const end = (r: Rect, a: Axis) => pos(r, a) + size(r, a);
const other = (a: Axis): Axis => (a === 'x' ? 'y' : 'x');
const overlaps = (a: Rect, b: Rect, ax: Axis) => pos(a, ax) < end(b, ax) && pos(b, ax) < end(a, ax);
const edges = (r: Rect, a: Axis) => [pos(r, a), pos(r, a) + size(r, a) / 2, end(r, a)];

interface Gap {
  p: Rect; // левее / выше
  q: Rect; // правее / ниже
  g: number;
}

/** Карточки «в одной полосе» с rect (пересекаются с ним по поперечной оси), отсортированные вдоль оси ax. */
function band(rect: Rect, others: Rect[], ax: Axis): Rect[] {
  return others.filter((o) => overlaps(o, rect, other(ax))).sort((a, b) => pos(a, ax) - pos(b, ax));
}

function gapsOf(sorted: Rect[], ax: Axis): Gap[] {
  const out: Gap[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const g = pos(sorted[i + 1], ax) - end(sorted[i], ax);
    if (g > EPS) out.push({ p: sorted[i], q: sorted[i + 1], g });
  }
  return out;
}

/** Сдвиг по оси ax, который выравнивает карточку или уравнивает промежутки (0, если подходящего нет). */
function bestDelta(rect: Rect, others: Rect[], ax: Axis, thr: number): number | null {
  let best: number | null = null;
  const consider = (d: number) => {
    if (Math.abs(d) <= thr && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  };

  // 1. Выравнивание: левый край / центр / правый край с краями и центрами других карточек
  const mine = edges(rect, ax);
  for (const o of others) for (const b of edges(o, ax)) for (const a of mine) consider(b - a);

  // 2. Одинаковые промежутки
  const row = band(rect, others, ax);
  const gaps = gapsOf(row, ax);
  const width = size(rect, ax);
  const p0 = pos(rect, ax);

  // 2а. Карточка стоит рядом с N на таком же расстоянии, как между какой-то парой в этой полосе
  const distinct = Array.from(new Set(gaps.map((x) => Math.round(x.g * 100) / 100)));
  for (const n of row) {
    for (const g of distinct) {
      consider(end(n, ax) + g - p0); // справа/ниже от N
      consider(pos(n, ax) - g - width - p0); // слева/выше от N
    }
  }
  // 2б. Карточка между двумя соседями: промежутки слева и справа одинаковы
  for (const { p, q, g } of gaps) {
    if (g > width) consider(end(p, ax) + (g - width) / 2 - p0);
  }
  return best;
}

/** Промежутки вдоль оси ax, которые стоит показать: с участием rect и равные другим промежуткам в полосе. */
function gapMarks(rect: Rect, others: Rect[], ax: Axis): GapMark[] {
  const row = band(rect, others, ax);
  const all = [...row, rect].sort((a, b) => pos(a, ax) - pos(b, ax));
  const gaps = gapsOf(all, ax);
  const mine = gaps.filter((x) => x.p === rect || x.q === rect);
  const rest = gaps.filter((x) => x.p !== rect && x.q !== rect);
  const cx = other(ax);

  const mark = (x: Gap): GapMark => {
    // по поперечной оси рисуем в зоне, общей для обеих карточек; если её нет, по центру rect
    const lo = Math.max(pos(x.p, cx), pos(x.q, cx), pos(rect, cx));
    const hi = Math.min(end(x.p, cx), end(x.q, cx), end(rect, cx));
    const at = hi > lo ? (lo + hi) / 2 : pos(rect, cx) + size(rect, cx) / 2;
    return { axis: ax, from: end(x.p, ax), to: pos(x.q, ax), at, gap: x.g };
  };

  const shown = new Set<Gap>();
  for (const m of mine) {
    const twins = rest.filter((r) => Math.abs(r.g - m.g) <= EPS);
    if (twins.length) {
      shown.add(m);
      twins.forEach((t) => shown.add(t));
    }
  }
  // карточка между двумя соседями с равными промежутками
  if (mine.length === 2 && Math.abs(mine[0].g - mine[1].g) <= EPS) mine.forEach((m) => shown.add(m));

  return Array.from(shown).map(mark);
}

/** Линии выравнивания по оси ax для итогового положения rect. */
function alignLines(rect: Rect, others: Rect[], ax: Axis): GuideLine[] {
  const cx = other(ax);
  const groups = new Map<number, GuideLine>();
  for (const o of others) {
    for (const b of edges(o, ax)) {
      if (!edges(rect, ax).some((a) => Math.abs(a - b) <= EPS)) continue;
      const key = Math.round(b * 10) / 10;
      const from = Math.min(pos(rect, cx), pos(o, cx));
      const to = Math.max(end(rect, cx), end(o, cx));
      const g = groups.get(key);
      if (g) {
        g.from = Math.min(g.from, from);
        g.to = Math.max(g.to, to);
      } else groups.set(key, { axis: ax, pos: b, from, to });
    }
  }
  return Array.from(groups.values());
}

/**
 * Привязывает rect (желаемое положение карточки) к соседям.
 * threshold — радиус притяжения в единицах доски (удобно задавать как «8 пикселей экрана / zoom»).
 * Сначала привязка по x, затем по y (с учётом уже выбранного x).
 */
export function snapRect(rect: Rect, others: Rect[], threshold: number): SnapResult {
  const out: Rect = { ...rect };
  const dx = bestDelta(out, others, 'x', threshold);
  if (dx !== null) out.x += dx;
  const dy = bestDelta(out, others, 'y', threshold);
  if (dy !== null) out.y += dy;

  return {
    x: out.x,
    y: out.y,
    snappedX: dx !== null,
    snappedY: dy !== null,
    lines: [...alignLines(out, others, 'x'), ...alignLines(out, others, 'y')],
    gaps: [...gapMarks(out, others, 'x'), ...gapMarks(out, others, 'y')],
  };
}

/** Находит ближайшее свободное место для прямоугольника: сдвигает вправо, пока он пересекается с другими. */
export function freeSpot(rect: Rect, others: Rect[], step: number, margin = 16, maxTries = 40): Rect {
  const hit = (r: Rect) =>
    others.some((o) => r.x < o.x + o.w + margin && o.x < r.x + r.w + margin && r.y < o.y + o.h + margin && o.y < r.y + r.h + margin);
  const r = { ...rect };
  for (let i = 0; i < maxTries && hit(r); i++) r.x += step;
  return r;
}