"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Unbounded, Golos_Text } from "next/font/google";

const display = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "600"] });
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"] });

type Mod = { title: string; desc: string; href: string; icon: string };
type Group = { name: string; hint: string; items: Mod[] };

// Иконки: пути в сетке 24x24, stroke
const I = {
  user: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  key: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 1l9 7 9-7",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zm-3 9l2 2 4-4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  camera: "M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  image: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 16l-5-5-9 9",
  qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3M14 20h3M20 20h1",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6",
  pin: "M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  plane: "M10.5 13.5L3 11l1-2 8 1 5-5a2 2 0 0 1 3 3l-5 5 1 8-2 1-2.5-7.5L8 17l-1 3-1.5-.5 1-3.5z",
  doc: "M5 3h11l3 3v15H5zM9 9h6M9 13h6M9 17h4",
  dns: "M4 6h16M4 12h16M4 18h16M7 6v.01M7 12v.01M7 18v.01",
  tree: "M12 3v6M12 9H6v6M12 9h6v6M6 15v5M18 15v5",
  cert: "M4 4h16v12H4zM8 20l4-3 4 3V16M8 9h8M8 12h5",
  graph: "M5 5h.01M19 8h.01M12 19h.01M5 5l7 14M19 8l-7 11M5 5l14 3",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
};

const GROUPS: Group[] = [
  {
    name: "Люди и аккаунты",
    hint: "Проверка собственных данных и публичных следов",
    items: [
      { title: "Поиск по нику", desc: "На каких из 400 сайтов занят никнейм", href: "/username", icon: I.user },
      { title: "Поиск по почте", desc: "Домен, одноразовая почта, Gravatar", href: "/email", icon: I.mail },
      { title: "Проверка номера", desc: "Формат, страна и оператор", href: "/phone", icon: I.phone },
      { title: "Утечка пароля", desc: "Есть ли пароль в базах утечек", href: "/password", icon: I.key },
    ],
  },
  {
    name: "Сеть и ссылки",
    hint: "Откуда пришёл адрес и что за ним скрыто",
    items: [
      { title: "IP-анализ", desc: "Геолокация, провайдер, VPN и Proxy", href: "/ip", icon: I.globe },
      { title: "Проверка ссылки", desc: "Сканирование URL в 70+ антивирусах", href: "/virustotal", icon: I.shield },
      { title: "Wayback Machine", desc: "Архивные копии страницы и правки", href: "/wayback", icon: I.clock },
      { title: "Google Dork генератор", desc: "Готовые запросы по сайту и словам", href: "/dork", icon: I.search },
    ],
  },
  {
    name: "Домены и сайты",
    hint: "Цепочка: кому принадлежит, куда указывает, какие поддомены, как отвечает",
    items: [
      { title: "Регистрация домена", desc: "Дата создания, регистратор, серверы имён", href: "/rdap", icon: I.clock },
      { title: "DNS-записи", desc: "Адреса, почта, TXT и серверы имён", href: "/dns", icon: I.dns },
      { title: "Поддомены", desc: "Из журналов сертификатов, без перебора", href: "/subdomains", icon: I.tree },
      { title: "Проверка сайта", desc: "Редиректы, заголовки, защита", href: "/site-check", icon: I.cert },
    ],
  },
  {
    name: "Фото и документы",
    hint: "Что файл рассказывает сам о себе",
    items: [
      { title: "EXIF фото", desc: "Камера, дата съёмки, GPS", href: "/exif", icon: I.camera },
      { title: "Обратный поиск фото", desc: "Google, Yandex, TinEye, Bing", href: "/reverse-image", icon: I.image },
      { title: "QR-анализатор", desc: "Ссылка внутри кода без перехода", href: "/qr", icon: I.qr },
      { title: "Метаданные документа", desc: "Автор и даты в PDF, DOCX, PPTX, XLSX", href: "/doc-metadata", icon: I.file },
    ],
  },
  {
    name: "Места и транспорт",
    hint: "Где это снято и что движется",
    items: [
      { title: "Гео-мультипоиск", desc: "Координаты в Maps, Earth, Yandex, SunCalc", href: "/geo", icon: I.pin },
      { title: "Отслеживание самолётов", desc: "Позиция, высота, скорость по позывному", href: "/aircraft", icon: I.plane },
    ],
  },
  {
    name: "Работа с находками",
    hint: "Собрать результаты в одно целое",
    items: [
      { title: "Дело", desc: "Находки, граф связей и история проверок", href: "/case", icon: I.graph },
      { title: "Шаблон досье", desc: "Источники, хронология, находки, вывод", href: "/dossier", icon: I.doc },
    ],
  },
];

const AGENT: Mod = {
  title: "ИИ-ассистент",
  desc: "Опишите задачу словами. Он сам выберет нужные модули Uroboros и соберёт ответ.",
  href: "/agent",
  icon: I.spark,
};

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

function Ring() {
  const text = "уроборос • всё возвращается к источнику • ";
  return (
    <div className="relative w-56 h-56 sm:w-72 sm:h-72 shrink-0">
      <svg viewBox="0 0 200 200" className="absolute inset-0 uro-spin" aria-hidden="true">
        <defs>
          <path id="uro-circle" d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" />
        </defs>
        <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(212,177,106,0.25)" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="68" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
        <text fontSize="9.5" letterSpacing="2.2" fill="#D4B16A" className={body.className}>
          <textPath href="#uro-circle">{text.repeat(2)}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Image src="/logo.webp" alt="Uroboros" width={120} height={120} className="invert w-24 sm:w-32 h-auto" priority />
      </div>
    </div>
  );
}

export default function Home() {
  const [q, setQ] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installEvent, setInstallEvent] = useState<any>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    setInstallEvent(null);
  }
  const query = q.trim().toLowerCase();

  const match = (m: Mod) => !query || (m.title + " " + m.desc).toLowerCase().includes(query);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length);
  const showAgent = match(AGENT);
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0) + 1;
  const nothing = !groups.length && !showAgent;

  return (
    <main className={`${body.className} min-h-screen bg-black/75 text-white`}>
      <style>{`
        @keyframes uro-spin { to { transform: rotate(360deg); } }
        .uro-spin { animation: uro-spin 60s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .uro-spin { animation: none; } }
      `}</style>

      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 py-14 sm:py-20">
        {/* Hero */}
        <header className="flex flex-col-reverse sm:flex-row items-center sm:items-center justify-between gap-10">
          <div className="text-center sm:text-left max-w-md">
            <h1 className={`${display.className} text-4xl sm:text-6xl font-semibold tracking-tight leading-none`}>
              Uroboros
            </h1>
            <p className="mt-5 text-lg text-gray-300 leading-relaxed">
              Открытые источники в одном месте. Проверяйте факты сами, без регистрации и платных подписок.
            </p>
            <p className="mt-3 text-sm text-gray-500">Только легальные и публичные данные. {total} модулей.</p>
            {installEvent && (
              <button
                onClick={install}
                className="mt-5 rounded-full border border-[#D4B16A]/50 px-5 py-2 text-sm font-medium text-[#D4B16A] hover:bg-[#D4B16A]/10 transition-colors"
              >
                Установить как приложение
              </button>
            )}
          </div>
          <Ring />
        </header>

        {/* Поиск */}
        <div className="mt-14 sm:mt-20">
          <label htmlFor="uro-search" className="sr-only">
            Найти модуль
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-xl px-4 focus-within:border-[#D4B16A]/70 transition-colors">
            <Icon d={I.search} className="text-gray-400 shrink-0" />
            <input
              id="uro-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Что нужно проверить? Например: фото, ссылка, номер"
              className="w-full min-w-0 bg-transparent py-3.5 text-base outline-none placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* ИИ-ассистент — главный вход */}
        {showAgent && (
          <Link
            href={AGENT.href}
            className="group mt-8 flex items-start gap-4 rounded-2xl border border-[#D4B16A]/40 bg-[#D4B16A]/[0.07] p-5 sm:p-6 hover:bg-[#D4B16A]/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4B16A] transition-colors"
          >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D4B16A] text-black">
              <Icon d={AGENT.icon} />
            </span>
            <span className="min-w-0">
              <span className={`${display.className} block text-lg font-medium`}>{AGENT.title}</span>
              <span className="mt-1 block text-gray-300 leading-relaxed">{AGENT.desc}</span>
            </span>
          </Link>
        )}

        {/* Группы модулей */}
        <div className="mt-14 space-y-14">
          {groups.map((g) => (
            <section key={g.name} aria-labelledby={`g-${g.name}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-white/15 pb-3">
                <h2 id={`g-${g.name}`} className={`${display.className} text-xl font-medium`}>
                  {g.name}
                </h2>
                <p className="text-sm text-gray-500">{g.hint}</p>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
                {g.items.map((m) => (
                  <li key={m.href} className="border-b border-white/[0.08]">
                    <Link
                      href={m.href}
                      className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-4 hover:bg-white/[0.06] active:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#D4B16A] transition-colors"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-gray-300 group-hover:border-[#D4B16A]/60 group-hover:text-[#D4B16A] transition-colors">
                        <Icon d={m.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{m.title}</span>
                        <span className="block text-sm text-gray-400 leading-snug">{m.desc}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {nothing && (
          <p className="mt-14 text-center text-gray-400">
            Ничего не найдено по запросу «{q}». Попробуйте другое слово или очистите поиск.
          </p>
        )}

        <footer className="mt-20 border-t border-white/10 pt-6 text-sm text-gray-500">
          Uroboros использует только открытые данные. Не используйте его для слежки за частными лицами.
        </footer>
      </div>
    </main>
  );
}
