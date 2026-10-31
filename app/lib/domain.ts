// Общая проверка домена: работает и в браузере, и на сервере
export function normalizeDomain(input: string, keepWww = false): string | null {
  let s = (input || "").trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/^[^@]*@/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!keepWww) s = s.replace(/^www\./, "");
  if (!s) return null;
  try {
    s = new URL("http://" + s).hostname; // кириллические домены -> punycode
  } catch {
    return null;
  }
  if (!/^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z][a-z0-9-]{1,62}$/.test(s)) return null;
  return s;
}
