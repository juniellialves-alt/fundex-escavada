// Sincronização automática com a planilha Google (Apps Script). Funciona primeiro offline:
// - ENVIO: tudo fica pendente no celular e é enviado quando houver internet;
// - RECEBIMENTO: o celular baixa da planilha os usuários, as estacas e as ocorrências dos outros celulares.
import { db, getCfg, setCfg } from './db.js';
import { SYNC } from './rows.js';
import { contarPendentes, registrarObrasDe } from './store.js';
import { revalidarSessao } from './auth.js';

const MAX_POR_LOTE = 150;
const INTERVALO = 2 * 60 * 1000;
let enviando = false;
let baixando = false;
let agendado = null;

function emitir() { window.dispatchEvent(new Event('sync-status')); }

export async function statusSync() {
  return {
    pendentes: await contarPendentes(),
    ultimoEnvio: await getCfg('ultimoEnvio'),
    ultimaBaixa: await getCfg('ultimaBaixa'),
    erro: await getCfg('ultimoErro'),
    configurado: !!(await getCfg('scriptUrl')),
    rodando: enviando || baixando,
  };
}

/** Envia o que estiver pendente e depois baixa as novidades da planilha. */
export async function sincronizar() {
  const r = await enviarAgora();
  const b = await baixarAgora();
  return { ...r, baixados: b.total || 0, ok: r.ok && b.ok, msg: r.ok ? b.msg : r.msg };
}

export function iniciarSync() {
  window.addEventListener('online', () => sincronizar());
  window.addEventListener('dados-alterados', () => {
    emitir();
    clearTimeout(agendado);
    agendado = setTimeout(() => enviarAgora(), 1500);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  setInterval(() => sincronizar(), INTERVALO);
  sincronizar();
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

async function conexao() {
  const url = await getCfg('scriptUrl');
  const codigo = await getCfg('codigoAcesso');
  if (!url) return { erro: 'Endereço da planilha não configurado (Configuração).' };
  if (navigator.onLine === false) return { erro: 'Sem internet. Os registros ficam guardados e serão enviados depois.' };
  return { url, codigo };
}

/** Envia tudo o que estiver pendente. Retorna {ok, total, msg}. */
export async function enviarAgora() {
  if (enviando) return { ok: false, msg: 'Envio em andamento…' };
  const c = await conexao();
  if (c.erro) return { ok: false, msg: c.erro };
  enviando = true; emitir();
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
      const j = await postar(c.url, { codigo: c.codigo, abas });
      if (!j.ok) throw new Error(j.erro || 'A planilha recusou o envio.');
      for (const [store, id, rev] of enviados) {
        const r = await db.get(store, id);
        if (!r || r.rev !== rev) continue; // foi alterado durante o envio: vai no próximo
        if (r.excluido) await db.del(store, id); // a planilha já apagou a linha; o celular também apaga
        else { r.sync = 'enviada'; r.enviadoEm = Date.now(); await db.put(store, r); }
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
    enviando = false; emitir();
  }
}

/** Grava no celular um registro vindo da planilha. Alteração local ainda não enviada vale mais. */
async function aplicar(store, rec) {
  if (!rec || !rec.id) return false;
  const local = await db.get(store, rec.id);
  if (local && local.sync === 'pendente') return false;
  if (local && local.rev === rec.rev && local.atualizadoEm === rec.atualizadoEm) return false;
  await db.put(store, { ...rec, sync: 'enviada' });
  return true;
}

/** Baixa da planilha o que mudou desde a última vez. Retorna {ok, total, msg}. */
export async function baixarAgora() {
  if (baixando) return { ok: false, msg: 'Atualização em andamento…' };
  const c = await conexao();
  if (c.erro) return { ok: false, msg: c.erro };
  baixando = true; emitir();
  const abas = SYNC.filter(f => f.baixar);
  let total = 0;
  const chegaram = [];
  try {
    const cursores = (await getCfg('cursores')) || {};
    for (let volta = 0; volta < 30; volta++) {
      const pedido = Object.fromEntries(abas.map(f => [f.aba, cursores[f.aba] || 0]));
      const j = await postar(c.url, { codigo: c.codigo, baixar: pedido });
      if (!j.ok) throw new Error(j.erro || 'A planilha recusou a atualização.');
      if (!j.dados) return { ok: false, msg: 'O script da planilha está desatualizado: publique a versão nova.' };
      let mais = false;
      for (const f of abas) {
        const d = j.dados[f.aba];
        if (!d) continue;
        for (const rec of d.registros || []) {
          if (await aplicar(f.store, rec)) { total++; chegaram.push(rec); }
        }
        for (const id of d.excluidos || []) {
          if (await db.get(f.store, id)) { await db.del(f.store, id); total++; }
        }
        cursores[f.aba] = d.cursor || cursores[f.aba] || 0;
        if (d.mais) mais = true;
      }
      await setCfg('cursores', cursores);
      if (!mais) break;
    }
    await setCfg('ultimaBaixa', Date.now());
    if (total) {
      await registrarObrasDe(chegaram);
      await revalidarSessao();
      window.dispatchEvent(new Event('dados-baixados'));
    }
    return { ok: true, total };
  } catch (e) {
    return { ok: false, msg: String(e.message || e), total };
  } finally {
    baixando = false; emitir();
  }
}

/** Testa o endereço e o código de acesso. */
export async function testarConexao(url, codigo) {
  try {
    const j = await postar(url, { codigo, teste: true });
    return j.ok ? { ok: true, msg: 'Conexão OK! A planilha aceitou o código de acesso.' } : { ok: false, msg: j.erro || 'Recusado.' };
  } catch (e) { return { ok: false, msg: String(e.message || e) }; }
}

/** Marca tudo como pendente para reenviar (ex.: planilha nova) e baixa tudo de novo. */
export async function marcarTudoParaReenvio() {
  for (const f of SYNC) {
    for (const r of await db.all(f.store)) { r.sync = 'pendente'; await db.put(f.store, r); }
  }
  await zerarCursores();
  window.dispatchEvent(new Event('dados-alterados'));
}

/** Faz o próximo recebimento trazer tudo desde o começo (ex.: trocou o endereço da planilha). */
export async function zerarCursores() { await setCfg('cursores', {}); }
