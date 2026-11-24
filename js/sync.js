// Envio automático para a planilha Google (Apps Script). Funciona primeiro offline:
// tudo fica pendente no celular e é enviado quando houver internet.
import { db, getCfg, setCfg } from './db.js';
import { SYNC } from './rows.js';
import { contarPendentes } from './store.js';

const MAX_POR_LOTE = 150;
let rodando = false;
let agendado = null;

function emitir() { window.dispatchEvent(new Event('sync-status')); }

export async function statusSync() {
  return {
    pendentes: await contarPendentes(),
    ultimoEnvio: await getCfg('ultimoEnvio'),
    erro: await getCfg('ultimoErro'),
    configurado: !!(await getCfg('scriptUrl')),
    rodando,
  };
}

export function iniciarSync() {
  window.addEventListener('online', () => enviarAgora());
  window.addEventListener('dados-alterados', () => {
    emitir();
    clearTimeout(agendado);
    agendado = setTimeout(() => enviarAgora(), 1500);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') enviarAgora(); });
  setInterval(() => enviarAgora(), 2 * 60 * 1000);
  enviarAgora();
}

async function postar(url, corpo) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    // text/plain evita a verificação CORS prévia, que o Apps Script não aceita.
    const resp = await fetch(url, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl.signal, redirect: 'follow' });
    const txt = await resp.text();
    let j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error('A planilha respondeu de forma inesperada. Confira o endereço do script.'); }
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Tempo esgotado (sinal fraco).');
    if (e instanceof TypeError) throw new Error('Sem conexão com a planilha.');
    throw e;
  } finally { clearTimeout(t); }
}

/** Envia tudo o que estiver pendente. Retorna {ok, total, msg}. */
export async function enviarAgora() {
  if (rodando) return { ok: false, msg: 'Envio em andamento…' };
  const url = await getCfg('scriptUrl');
  const codigo = await getCfg('codigoAcesso');
  if (!url) return { ok: false, msg: 'Endereço da planilha não configurado (Configuração).' };
  if (navigator.onLine === false) return { ok: false, msg: 'Sem internet. Os registros ficam guardados e serão enviados depois.' };
  rodando = true; emitir();
  let total = 0;
  try {
    for (let lote = 0; lote < 50; lote++) {
      const abas = {};
      const enviados = [];
      for (const f of SYNC) {
        const vaga = MAX_POR_LOTE - enviados.length;
        if (vaga <= 0) break;
        const pend = (await db.all(f.store)).filter(r => r.sync === 'pendente').slice(0, vaga);
        if (!pend.length) continue;
        abas[f.aba] = { colunas: f.colunas, linhas: pend.map(f.linha) };
        for (const r of pend) enviados.push([f.store, r.id, r.rev]);
      }
      if (!enviados.length) break;
      const j = await postar(url, { codigo, abas });
      if (!j.ok) throw new Error(j.erro || 'A planilha recusou o envio.');
      for (const [store, id, rev] of enviados) {
        const r = await db.get(store, id);
        // Só marca como enviado se não foi alterado durante o envio.
        if (r && r.rev === rev) { r.sync = 'enviada'; r.enviadoEm = Date.now(); await db.put(store, r); }
      }
      total += enviados.length;
    }
    if (total) await setCfg('ultimoEnvio', Date.now());
    await setCfg('ultimoErro', null);
    return { ok: true, total };
  } catch (e) {
    const msg = String(e.message || e);
    await setCfg('ultimoErro', { msg, quando: Date.now() });
    return { ok: false, msg, total };
  } finally {
    rodando = false; emitir();
  }
}

/** Testa o endereço e o código de acesso. */
export async function testarConexao(url, codigo) {
  try {
    const j = await postar(url, { codigo, teste: true });
    return j.ok ? { ok: true, msg: 'Conexão OK! A planilha aceitou o código de acesso.' } : { ok: false, msg: j.erro || 'Recusado.' };
  } catch (e) { return { ok: false, msg: String(e.message || e) }; }
}

/** Marca tudo como pendente para reenviar (ex.: planilha nova). */
export async function marcarTudoParaReenvio() {
  for (const f of SYNC) {
    for (const r of await db.all(f.store)) { r.sync = 'pendente'; await db.put(f.store, r); }
  }
  window.dispatchEvent(new Event('dados-alterados'));
}
