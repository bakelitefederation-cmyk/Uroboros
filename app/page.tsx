import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const modules = [
    {
      title: "Поиск по нику",
      desc: "Проверка, на каких сайтах зарегистрирован никнейм",
      href: "/username",
    },
    {
      title: "Проверка номера",
      desc: "Валидация формата, страны и оператора номера",
      href: "/phone",
    },
    {
      title: "Утечка пароля",
      desc: "Проверка пароля по базе известных утечек",
      href: "/password",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <Image src="/logo.webp" alt="Uroboros logo" width={120} height={120} className="mb-4 invert" />
      <h1 className="text-5xl font-bold mb-2 tracking-tight">Uroboros</h1>
      <p className="text-gray-400 mb-12">Легальный OSINT-инструмент</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="border border-gray-700 rounded-xl p-6 hover:border-gray-400 transition"
          >
            <h2 className="text-xl font-semibold mb-2">{m.title}</h2>
            <p className="text-gray-400 text-sm">{m.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}