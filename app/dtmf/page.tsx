"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ModuleShell from "../components/ModuleShell";

const ROWS =;
const COLS =;
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
  return;
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

  // Ссылки для работы с загруженным аудиофайлом
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [pressed, setPressed] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [seqInput, setSeqInput] = useState("");
  const [playing, setPlaying] = useState(false);

  // Состояния для файла
  const [fileName, setFileName] = useState<string | null>(null);
  const [isFilePlaying, setIsFilePlaying] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);

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

  // Обработчик загрузки файла
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsDecoding(true);
    stopAudioFile(); // Останавливаем старый файл, если он играл

    try {
      const ctx = ensureAudio();
      const arrayBuffer = await file.arrayBuffer();
      // Декодируем аудио в буфер, понятный Web Audio API
      const decodedData = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = decodedData;
    } catch (err) {
      console.error("Ошибка декодирования аудио:", err);
      alert("Не удалось прочитать аудиофайл. Убедитесь, что это корректный mp3/wav.");
      setFileName(null);
      audioBufferRef.current = null;
    } finally {
      setIsDecoding(false);
    }
  };

  // Запуск воспроизведения файла
  const playAudioFile = () => {
    const ctx = ensureAudio();
    if (!audioBufferRef.current || !analyserRef.current) return;

    if (isFilePlaying) {
      stopAudioFile();
      return;
    }

    // Создаем источник звука из буфера
    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    
    // Подключаем к нашему анализатору спектра (чтобы рисовался график DTMF)
    source.connect(analyserRef.current);
    
    source.onended = () => {
      setIsFilePlaying(false);
    };

    audioSourceRef.current = source;
    source.start(0);
    setIsFilePlaying(true);
  };

  // Остановка воспроизведения файла
  const stopAudioFile = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsFilePlaying(false);
  };

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
      if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch {} }
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

  const [lo, hi] = last ? freqsOf(last) :;

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
