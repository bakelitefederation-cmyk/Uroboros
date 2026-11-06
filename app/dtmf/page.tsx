"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ModuleShell from "../components/ModuleShell";

const ROWS = "697,770,852,941".split(",").map(Number);
const COLS = "1209,1336,1477".split(",").map(Number);
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
  return Array(2).fill(0) as [number, number];
}

function goertzels(data: Float32Array, targetFreq: number, sampleRate: number): number {
  const numSamples = data.length;
  const k = Math.round((numSamples * targetFreq) / sampleRate);
  const omega = (2 * Math.PI * k) / numSamples;
  const sine = Math.sin(omega);
  const cosine = Math.cos(omega);
  const coeff = 2 * cosine;

  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < numSamples; i++) {
    q0 = coeff * q1 - q2 + data[i];
    q2 = q1;
    q1 = q0;
  }

  return q1 * q1 + q2 * q2 - coeff * q1 * q2;
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

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [pressed, setPressed] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [seqInput, setSeqInput] = useState("");
  const [playing, setPlaying] = useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [isFilePlaying, setIsFilePlaying] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedResult, setDecodedResult] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const [quiz, setQuiz] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });

  const ensureAudio = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === "suspended") ctxRef.current.resume();
      return ctxRef.current;
    }
    const AC: any = window.AudioContext || (window as any).webkitAudioContext;
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

  const decodeAudioBuffer = (audioBuffer: AudioBuffer) => {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    const windowSize = 1024; 
    const stepSize = 512;   
    let resultStr = "";
    let lastChar = "";
    let silenceCounter = 0;

    for (let offset = 0; offset < channelData.length - windowSize; offset += stepSize) {
      const windowData = channelData.subarray(offset, offset + windowSize);

      let maxRowPower = 0;
      let bestRowIndex = -1;
      for (let i = 0; i < ROWS.length; i++) {
        const p = goertzels(windowData, ROWS[i], sampleRate);
        if (p > maxRowPower) {
          maxRowPower = p;
          bestRowIndex = i;
        }
      }

      let maxColPower = 0;
      let bestColIndex = -1;
      for (let i = 0; i < COLS.length; i++) {
        const p = goertzels(windowData, COLS[i], sampleRate);
        if (p > maxColPower) {
          maxColPower = p;
          bestColIndex = i;
        }
      }

      const powerThreshold = 1.5; 
      if (maxRowPower > powerThreshold && maxColPower > powerThreshold) {
        const currentChar = KEYS[bestRowIndex][bestColIndex];
        if (currentChar !== lastChar && silenceCounter > 1) {
          resultStr += currentChar;
        }
        lastChar = currentChar;
        silenceCounter = 0;
      } else {
        silenceCounter++;
        if (silenceCounter > 2) {
          lastChar = "";
        }
      }
    }
    setDecodedResult(resultStr);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsDecoding(true);
    setDecodedResult("");
    stopAudioFile();

    try {
      const ctx = ensureAudio();
      const arrayBuffer = await file.arrayBuffer();
      const decodedData = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = decodedData;
      decodeAudioBuffer(decodedData);
    } catch (err) {
      console.error("Ошибка декодирования аудио:", err);
      alert("Не удалось прочитать аудиофайл. Убедитесь, что это корректный mp3/wav.");
      setFileName(null);
      audioBufferRef.current = null;
    } finally {
      setIsDecoding(false);
    }
  };

  const playAudioFile = () => {
    const ctx = ensureAudio();
    if (!audioBufferRef.current || !analyserRef.current) return;

    if (isFilePlaying) {
      stopAudioFile();
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(analyserRef.current);
    source.onended = () => {
      setIsFilePlaying(false);
    };

    audioSourceRef.current = source;
    source.start(0);
    setIsFilePlaying(true);
  };

  const stopAudioFile = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsFilePlaying(false);
  };

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

  const copyToClipboard = () => {
    if (!decodedResult) return;
    navigator.clipboard.writeText(decodedResult);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const currentFreqs = last ? freqsOf(last) : Array(2).fill(0);
  const lo = currentFreqs[0];
  const hi = currentFreqs[1];

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
                    ? "bg-[#d4b16a] text-black border-[#d4b16a]"
                    : "bg-transparent text-white border-neutral-800 hover:border-neutral-700")
                }
              >
                {k}
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-between text-xs text-neutral-400 px-1">
            <span>набор: <strong className="text-white tracking-wider">{typed}</strong></span>
            <button onClick={() => setTyped("")} className="hover:text-white underline">Стереть</button>
          </div>
        </div>

        {/* Экран частот и спектрограмма */}
        <div className="flex flex-col justify-between border border-neutral-800 rounded-2xl p-4 bg-[#0a0b0d]">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="text-sm text-neutral-400">
              {last ? (
                <>
                  Клавиша <strong className="text-white text-base">{last}</strong>: <br />
                  Низкий тон: <strong className="text-[#d4b16a]">{lo} Гц</strong> <br />
                  Высокий тон: <strong className="text-[#d4b16a]">{hi} Гц</strong>
                </>
              ) : (
                "Нажмите клавишу, чтобы увидеть её две частоты."
              )}
            </div>
            
            {/* Спектрограмма */}
            <div className="relative border border-neutral-900 rounded-lg overflow-hidden bg-black">
              <canvas ref={canvasRef} width={200} height={120} className="block" />
              <div className="absolute right-1 bottom-1 text-[9px] text-neutral-600 pointer-events-none text-right font-mono">
                1477<br />1336<br />1209<br /><br />941<br />852<br />770<br />697
              </div>
            </div>
          </div>
          
          <p className="text-xs text-neutral-500 leading-relaxed">
            По вертикали частота (600–1700 Гц), время идёт слева направо. У каждой клавиши видны две линии: нижняя из группы 697–941 Гц, верхняя из группы 1209–1477 Гц.
          </p>
        </div>
      </div>
      {/* Инструменты: генератор последовательности и ЗАГРУЗКА АУДИО */}
      <div className="mt-6 grid gap-6 md:grid-cols-2 pt-6 border-t border-neutral-950">
        
        {/* Проигрывание строки */}
        <div className="border border-neutral-800 rounded-2xl p-4 bg-[#0a0b0d] flex flex-col justify-between min-h-[120px]">
          <label className="block text-xs font-medium text-neutral-400 mb-3">
            Проиграть набор цифр и посмотреть, как он выглядит на спектрограмме:
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <input
              type="text"
              value={seqInput}
              onChange={(e) => setSeqInput(e.target.value)}
              placeholder="например 123*45#"
              disabled={playing}
              className="w-full h-11 bg-black border border-neutral-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-neutral-700 disabled:opacity-50"
            />
            <button
              onClick={playSequence}
              disabled={playing || !seqInput}
              className="h-11 bg-[#d4b16a] hover:bg-[#c2a05d] text-black text-xs font-semibold px-5 rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {playing ? "Играет..." : "Проиграть"}
            </button>
          </div>
        </div>

        {/* ЗАГРУЗКА И ДЕКОДИРОВАНИЕ АУДИОФАЙЛА */}
        <div className="border border-neutral-800 rounded-2xl p-4 bg-[#0a0b0d] flex flex-col justify-between min-h-[120px]">
          <label className="block text-xs font-medium text-neutral-400 mb-3">
            Загрузить аудиофайл для анализа (wav, mp3), чтобы прослушать DTMF:
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <label className="flex items-center justify-between bg-black border border-neutral-800 rounded-xl px-3 h-11 text-sm text-neutral-400 cursor-pointer hover:border-neutral-700 transition-colors overflow-hidden">
              <span className="truncate pr-2 text-xs text-white max-w-[120px] sm:max-w-[180px]">
                {fileName ? fileName : "Выбрать файл..."}
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-[11px] bg-neutral-900 text-neutral-300 px-2 py-1 rounded-md border border-neutral-800 select-none flex-shrink-0">Обзор</span>
            </label>
            <button
              onClick={playAudioFile}
              disabled={!audioBufferRef.current || isDecoding}
              className={`text-xs font-semibold px-6 h-11 rounded-xl transition-colors whitespace-nowrap ${
                isFilePlaying 
                  ? "bg-red-900/40 text-red-200 border border-red-800 hover:bg-red-900/60" 
                  : "bg-neutral-800 hover:bg-neutral-700 text-white disabled:opacity-30"
              }`}
            >
              {isDecoding ? "Чтение..." : isFilePlaying ? "Стоп" : "Пуск"}
            </button>
          </div>
        </div>
      </div>

      {/* РЕЗУЛЬТАТ АВТОМАТИЧЕСКОЙ РАСШИФРОВКИ */}
      {decodedResult && (
        <div className="mt-4 border border-neutral-800 rounded-2xl p-4 bg-[#0a0b0d] flex flex-col justify-between">
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Результат автоматического распознавания номера:
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <div className="w-full h-11 bg-neutral-950 border border-neutral-800 rounded-xl px-4 flex items-center text-sm font-mono text-[#d4b16a] tracking-widest overflow-x-auto whitespace-nowrap">
              {decodedResult}
            </div>
            <button
              onClick={copyToClipboard}
              className={`h-11 text-xs font-semibold px-5 rounded-xl transition-colors whitespace-nowrap ${
                isCopied 
                  ? "bg-emerald-900/40 text-emerald-200 border border-emerald-800" 
                  : "bg-neutral-800 hover:bg-neutral-700 text-white"
              }`}
            >
              {isCopied ? "Скопировано!" : "Копировать"}
            </button>
          </div>
        </div>
      )}

      {/* Блок тренировки слуха */}
      <div className="mt-6 border-t border-neutral-950 pt-6">
        <h3 className="text-sm font-semibold text-white mb-2">Угадай клавишу</h3>
        {!quiz ? (
          <div className="flex items-center justify-between bg-[#0a0b0d]/30 border border-neutral-900 rounded-2xl p-4">
            <p className="text-xs text-neutral-400 max-w-md">
              Тренировка слуха: сайт играет тон, вы нажимаете клавишу, которая, по-вашему, прозвучала.
            </p>
            <button
              onClick={() => { toggleQuiz(true); setTimeout(nextQuestion, 100); }}
              className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-colors"
            >
              Начать тренировку
            </button>
          </div>
        ) : (
          <div className="bg-[#0a0b0d] border border-neutral-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-neutral-400">
                Счёт: <strong className="text-white">{score.ok}</strong> / {score.total}
              </span>
              <div className="flex gap-2">
                <button onClick={replay} className="text-xs border border-neutral-800 hover:border-neutral-700 text-white px-3 py-1.5 rounded-lg">
                  Повторить звук
                </button>
                <button onClick={nextQuestion} disabled={!verdict} className="text-xs bg-[#d4b16a] text-black font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                  Следующий
                </button>
                <button onClick={() => toggleQuiz(false)} className="text-xs text-neutral-400 hover:text-white ml-2 underline">
                  Выйти
                </button>
              </div>
            </div>
            {verdict && (
              <div className={`text-sm font-medium p-2.5 rounded-xl border ${verdict.startsWith("Верно") ? "bg-emerald-950/20 border-emerald-900 text-emerald-400" : "bg-rose-950/20 border-rose-900 text-rose-400"}`}>
                {verdict}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-[11px] text-neutral-600 leading-normal">
        Тренажёр учебный: он только воспроизводит тоны и визуализирует любой входящий звук в диапазоне DTMF. Расшифровки чужих разговоров здесь нет и не будет.
      </p>
    </ModuleShell>
  );
}
