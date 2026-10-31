"use client";
import DomainTool from "../components/DomainTool";

const NAMES: Record<string, string> = {
  A: "A — IPv4-адреса",
  AAAA: "AAAA — IPv6-адреса",
  MX: "MX — почтовые серверы",
  NS: "NS — серверы имён",
  TXT: "TXT — текстовые записи (SPF, проверки сервисов)",
  CAA: "CAA — кто может выпускать сертификаты",
};

export default function Page() {
  return (
    <DomainTool
      title="DNS-записи"
      subtitle="Куда указывает домен: адреса, почта, серверы имён и служебные записи."
      endpoint="/api/dns"
      current="dns"
      keepWww
      render={(d) => (
        <div className="space-y-3">
          {Object.keys(NAMES).map((t) => {
            const list: string[] = d.records?.[t] ?? [];
            return (
              <div key={t} className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-sm font-semibold">{NAMES[t]}</p>
                {list.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-500">Записей нет</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {list.map((r, i) => (
                      <li key={i} className="text-sm text-gray-300 break-all">{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    />
  );
}
