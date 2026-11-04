"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ModuleShell from "../components/ModuleShell";

const ROWS = [697, 770, 852, 941];
const COLS = [1209, 1336, 1477];
const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];
const ALL = KEYS.flat();
const F_MIN = 600;
const F_MAX = 1700;

function freqsOf(key: string): [number, number] {
  for (let r = 0; r < 4; r++) {
    const c = KEYS[r].indexOf(key);
    if (c >= 0) return [ROWS[r], COLS[c]];
  }
  return [0, 0];
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function DtmfTrainer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const activeRef = useRef<Map<string, { oscs: OscillatorNode[]; gain: GainNode }>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const cancelSeq = useRef(false);

  const [pressed, setPressed] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [seqInput, setSeqInput] = useState("");
  const [playing, setPlaying] = useState(false);

  // режим «угадай клавишу»
  const [quiz, setQuiz] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });

  const ensureAudio = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === "suspended") ctxRef.current.resume();
      return ctxRef.current;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.25;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.3;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;
    analyserRef.current = analyser;
    return ctx;
  }, []);

  const startTone = useCallback(
    (key: string) => {
      const ctx = ensureAudio();
      if (activeRef.current.has(key) || !masterRef.current) return;
      const [lo, hi] = freqsOf(key);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.005);
      gain.connect(masterRef.current);
      const oscs = [lo, hi].map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      activeRef.current.set(key, { oscs, gain });
      setPressed(key);
      setLast(key);
    },
    [ensureAudio]
  );

  const stopTone = useCallback((key: string) => {
    const ctx = ctxRef.current;
    const a = activeRef.current.get(key);
    if (!ctx || !a) return;
    a.gain.gain.cancelScheduledValues(ctx.currentTime);
    a.gain.gain.setValueAtTime(a.gain.gain.value, ctx.currentTime);
    a.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.02);
    a.oscs.forEach((o) => o.stop(ctx.currentTime + 0.03));
    activeRef.current.delete(key);
    setPressed((p) => (p === key ? null : p));
  }, []);

  // нажатие клавиши пользователем
  const press = useCallback(
    (key: string) => {
      startTone(key);
      if (quiz && target && !verdict) {
        const ok = key === target;
        setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
        const [lo, hi] = freqsOf(target);
        setVerdict(ok ? `Верно: ${target} (${lo} + ${hi} Гц)` : `Не то. Это была ${target} (${lo} + ${hi} Гц)`);
      } else if (!quiz) {
        setTyped((t) => (t + key).slice(-24));
      }
    },
    [startTone, quiz, target, verdict]
  );

  // клавиатура компьютера
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (ALL.includes(e.key)) press(e.key);
    };
    const up = (e: KeyboardEvent) => {
      if (ALL.includes(e.key)) stopTone(e.key);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [press, stopTone]);

  // спектрограмма
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const W = canvas.width;
    const H = canvas.height;
    g.fillStyle = "#050607";
    g.fillRect(0, 0, W, H);
    const STEP = 2;

    const draw = () => {
      const an = analyserRef.current;
      const ctx = ctxRef.current;
      if (an && ctx) {
        const data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        const binHz = ctx.sampleRate / an.fftSize;
        g.drawImage(canvas, -STEP, 0);
        g.fillStyle = "#050607";
        g.fillRect(W - STEP, 0, STEP, H);
        const from = Math.floor(F_MIN / binHz);
        const to = Math.ceil(F_MAX / binHz);
        for (let i = from; i <= to; i++) {
          const v = data[i] / 255;
          if (v < 0.15) continue;
          const f = i * binHz;
          const y = H - ((f - F_MIN) / (F_MAX - F_MIN)) * H;
          g.fillStyle = `rgba(212,177,106,${Math.min(1, v * 1.2)})`;
          g.fillRect(W - STEP, y - 1, STEP, Math.max(2, (binHz / (F_MAX - F_MIN)) * H));
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // закрываем звук при уходе со страницы
  useEffect(() => {
    const map = activeRef.current;
    return () => {
      cancelSeq.current = true;
      map.forEach((a) => a.oscs.forEach((o) => { try { o.stop(); } catch {} }));
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  async function playSequence() {
    const digits = seqInput.split("").filter((c) => ALL.includes(c));
    if (!digits.length || playing) return;
    setPlaying(true);
    cancelSeq.current = false;
    for (const d of digits) {
      if (cancelSeq.current) break;
      startTone(d);
      await sleep(160);
      stopTone(d);
      await sleep(90);
    }
    setPlaying(false);
  }

  async function nextQuestion() {
    const key = ALL[Math.floor(Math.random() * ALL.length)];
    setTarget(key);
    setVerdict(null);
    startTone(key);
    await sleep(450);
    stopTone(key);
  }

  async function replay() {
    if (!target) return;
    startTone(target);
    await sleep(450);
    stopTone(target);
  }

  function toggleQuiz(on: boolean) {
    setQuiz(on);
    setTarget(null);
    setVerdict(null);
    setScore({ ok: 0, total: 0 });
  }

  const [lo, hi] = last ? freqsOf(last) : [0, 0];

  return (
    <ModuleShell
      title="Телефонный тренажёр"
      subtitle="Как кнопочный телефон кодирует цифры звуком: каждая клавиша это пара тонов (DTMF). Нажимайте кнопки или клавиши 0–9, * и # на клавиатуре. Всё звучит только внутри страницы, микрофон не используется."
      width="xl"
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
        {/* Клавиатура */}
        <div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Клавиатура телефона">
            {KEYS.flat().map((k) => (
              <button
                key={k}
                onPointerDown={(e) => { e.preventDefault(); press(k); }}
                onPointerUp={() => stopTone(k)}
                onPointerLeave={() => stopTone(k)}
                onPointerCancel={() => stopTone(k)}
                className={
                  "h-14 rounded-xl border text-xl font-semibold select-none touch-none transition-colors " +
                  (pressed === k
                    ? "border-[#D4B16A] bg-[#D4B16A] text-black"
                    : "border-white/15 bg-white/[0.06] hover:border-[#D4B16A]/60")
                }
              >
                {k}
              </button>
            ))}
          </div>

          {!quiz && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <span className="min-h-[1.5rem] break-all font-mono text-base tracking-widest">{typed || <span className="text-gray-500">набор</span>}</span>
              <button onClick={() => setTyped("")} className="text-xs text-gray-400 underline hover:text-[#D4B16A]">Стереть</button>
            </div>
          )}
        </div>

        {/* Справа: частоты и спектрограмма */}
        <div className="min-w-0">
          <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm">
            {last && !(quiz && target && !verdict) ? (
              <p>
                Клавиша <span className="font-semibold text-[#D4B16A]">{last}</span>: строка {lo} Гц + столбец {hi} Гц
              </p>
            ) : (
              <p className="text-gray-400">
                {quiz && target && !verdict ? "Частоты скрыты, пока вы не ответите." : "Нажмите клавишу, чтобы увидеть её две частоты."}
              </p>
            )}
          </div>

          <div className="relative mt-3 overflow-hidden rounded-lg border border-white/10">
            <canvas ref={canvasRef} width={640} height={220} className="block w-full h-auto" aria-label="Спектрограмма звука" />
            {[...ROWS, ...COLS].map((f) => (
              <span
                key={f}
                className="pointer-events-none absolute left-1 text-[10px] leading-none text-gray-400"
                style={{ top: `calc(${((F_MAX - f) / (F_MAX - F_MIN)) * 100}% - 5px)` }}
              >
                {f}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            По вертикали частота (600–1700 Гц), время идёт слева направо. У каждой клавиши видны две линии: нижняя из группы 697–941 Гц, верхняя из группы 1209–1477 Гц.
          </p>
        </div>
      </div>

      {/* Проиграть последовательность */}
      {!quiz && (
        <div className="mt-6">
          <p className="text-sm text-gray-400">Проиграть набор цифр и посмотреть, как он выглядит на спектрограмме:</p>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              value={seqInput}
              onChange={(e) => setSeqInput(e.target.value.replace(/[^0-9*#]/g, "").slice(0, 20))}
              onKeyDown={(e) => e.key === "Enter" && playSequence()}
              inputMode="tel"
              placeholder="например 123*45#"
              className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm font-mono"
            />
            <button
              onClick={playSequence}
              disabled={playing || !seqInput}
              className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
            >
              {playing ? "Играет..." : "Проиграть"}
            </button>
          </div>
        </div>
      )}

      {/* Режим «угадай клавишу» */}
      <div className="mt-8 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Угадай клавишу</p>
            <p className="text-sm text-gray-400">Тренировка слуха: сайт играет тон, вы нажимаете клавишу, которая, по-вашему, прозвучала.</p>
          </div>
          <button
            onClick={() => toggleQuiz(!quiz)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 hover:text-[#D4B16A] transition-colors"
          >
            {quiz ? "Выйти из тренировки" : "Начать тренировку"}
          </button>
        </div>

        {quiz && (
          <div className="mt-4 rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={nextQuestion} className="rounded-lg bg-[#D4B16A] px-4 py-2 text-sm font-medium text-black hover:bg-[#E2C98F] transition">
                {target ? "Следующий звук" : "Сыграть звук"}
              </button>
              {target && !verdict && (
                <button onClick={replay} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 transition-colors">
                  Повторить
                </button>
              )}
              <span className="ml-auto text-sm text-gray-400">Верно: {score.ok} из {score.total}</span>
            </div>
            {verdict && <p className="mt-3 text-sm font-medium">{verdict}</p>}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Тренажёр учебный: он только воспроизводит тоны. Расшифровки чужих разговоров здесь нет и не будет.
      </p>
    </ModuleShell>
  );
}