"use client";
import DomainTool, { Row } from "../components/DomainTool";

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU") : "—");

export default function Page() {
  return (
    <DomainTool
      title="Регистрация домена"
      subtitle="Когда домен зарегистрирован, у какого регистратора и на каких серверах имён. Данные владельца-человека в ответ не выводятся."
      endpoint="/api/rdap"
      current="rdap"
      render={(d) => (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <dl>
            <Row label="Домен">{d.domain}</Row>
            <Row label="Регистратор">{d.registrar ?? "—"}</Row>
            <Row label="Зарегистрирован">{fmtDate(d.registered)}</Row>
            <Row label="Изменён">{fmtDate(d.updated)}</Row>
            <Row label="Действует до">{fmtDate(d.expires)}</Row>
            <Row label="Статус">{d.status?.length ? d.status.join(", ") : "—"}</Row>
            <Row label="DNSSEC">{d.dnssec === null ? "—" : d.dnssec ? "включён" : "выключен"}</Row>
            <Row label="Серверы имён">{d.nameservers?.length ? d.nameservers.join(", ") : "—"}</Row>
          </dl>
        </div>
      )}
    />
  );
}
