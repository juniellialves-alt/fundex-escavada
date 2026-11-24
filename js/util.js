// Utilidades de data/hora (fuso America/Sao_Paulo), números e textos.
export const TZ = 'America/Sao_Paulo';

const dtf = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function parts(ts = Date.now()) {
  const o = {};
  for (const p of dtf.formatToParts(new Date(ts))) o[p.type] = p.value;
  if (o.hour === '24') o.hour = '00';
  return o;
}

/** Data 'AAAA-MM-DD' no fuso de São Paulo. */
export function dateOf(ts = Date.now()) {
  const p = parts(ts);
  return `${p.year}-${p.month}-${p.day}`;
}
export const today = () => dateOf();

/** Hora 'HH:MM' (ou 'HH:MM:SS') no fuso de São Paulo. */
export function timeOf(ts, sec = false) {
  if (ts == null || ts === '') return '';
  const p = parts(ts);
  return sec ? `${p.hour}:${p.minute}:${p.second}` : `${p.hour}:${p.minute}`;
}

export function fmtDate(d) {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}
export function fmtDateTime(ts) {
  return ts ? `${fmtDate(dateOf(ts))} ${timeOf(ts)}` : '';
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function utcOf(d) { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); }
export function weekday(d, curto = false) { const w = new Date(utcOf(d)).getUTCDay(); return curto ? DIAS_CURTOS[w] : DIAS[w]; }

/** Converte data + hora locais de São Paulo para timestamp (ms). */
export function toTs(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mi, ss = 0] = time.split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mi, ss);
  let guess = target + 3 * 3600e3;
  for (let i = 0; i < 2; i++) {
    const p = parts(guess);
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess += target - asUTC;
  }
  return guess;
}

export function addDays(date, n) {
  return new Date(utcOf(date) + n * 864e5).toISOString().slice(0, 10);
}
/** Dias de calendário de a até b (b - a). */
export function diffDays(a, b) { return Math.round((utcOf(b) - utcOf(a)) / 864e5); }

export function monthOf(d) { return d.slice(0, 7); }
export function addMonths(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
export function fmtMonth(ym) { const [y, m] = ym.split('-'); return `${MESES[+m - 1]}/${y}`; }

/** Segundos -> 'hh:mm:ss' */
export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}
/** Segundos -> '2h 15min' */
export function fmtHM(sec) {
  const min = Math.round((sec || 0) / 60);
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`;
}
/** Diferença em segundos entre duas horas 'HH:MM' do mesmo dia (null se faltar). */
export function hmDiff(ini, fim) {
  if (!ini || !fim) return null;
  const a = ini.split(':').map(Number), b = fim.split(':').map(Number);
  return ((b[0] * 60 + b[1]) - (a[0] * 60 + a[1])) * 60;
}

export function fmtNum(n, dec = 2) {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
/** Aceita '12,50', '12.5', '1.234,5'. */
export function parseNum(s) {
  if (s == null) return NaN;
  s = String(s).trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  return parseFloat(s);
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
