"use client";
import DomainTool, { Row } from "../components/DomainTool";

const SEC_LABELS: Record<string, string> = {
  "strict-transport-security": "HSTS (только HTTPS)",
  "content-security-policy": "Content-Security-Policy",
  "x-frame-options": "X-Frame-Options",
  "x-content-type-options": "X-Content-Type-Options",
  "referrer-policy": "Referrer-Policy",
  "permissions-policy": "Permissions-Policy",
};

export default function Page() {
  return (
    <DomainTool
      title="Проверка сайта"
      subtitle="Куда ведут редиректы, что сайт сообщает о себе и какие защитные заголовки включены."
      endpoint="/api/site-check"
      current="site-check"
      keepWww
      render={(d) => (
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-sm font-semibold">Цепочка переходов</p>
            <ol className="mt-2 space-y-1">
              {d.chain.map((c: { url: string; status: number }, i: number) => (
                <li key={i} className="text-sm break-all">
                  <span className="text-gray-400">{c.status}</span> {c.url}
                </li>
              ))}
            </ol>
          </div>

          {Object.keys(d.info ?? {}).length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-sm font-semibold">Что сообщает сервер</p>
              <dl className="mt-1">
                {Object.entries(d.info).map(([k, v]) => (
                  <Row key={k} label={k}>{String(v)}</Row>
                ))}
              </dl>
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-sm font-semibold">Защитные заголовки</p>
            <dl className="mt-1">
              {Object.entries(d.security).map(([k, on]) => (
                <Row key={k} label={SEC_LABELS[k] ?? k}>
                  <span className={on ? "text-green-400" : "text-gray-500"}>{on ? "включён" : "нет"}</span>
                </Row>
              ))}
            </dl>
          </div>
        </div>
      )}
    />
  );
}
