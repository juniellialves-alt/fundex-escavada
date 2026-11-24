// Cadastro de máquinas (feito pelo Adm). As máquinas vão para a aba "Máquinas" da planilha
// e chegam sozinhas aos outros celulares, como os usuários.
import { db } from './db.js';
import * as U from './util.js';

/** Nome padronizado: maiúsculas, sem espaços nas pontas e sem espaço duplo (ex.: " tm270-1 " -> "TM270-1"). */
export const nomeMaquina = s => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();

const ordem = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });

export async function listarMaquinas() { return (await db.all('maquinas')).sort(ordem); }
export const getMaquina = id => (id ? db.get('maquinas', id) : null);

/** Nomes das máquinas ativas (para escolher nas telas). */
export async function nomesMaquinas() { return (await listarMaquinas()).filter(m => m.ativo).map(m => m.nome); }

/** Cria ou altera uma máquina. Retorna {ok, msg, maquina}. */
export async function salvarMaquina({ id, nome, ativo = true }) {
  const n = nomeMaquina(nome);
  if (!n) return { ok: false, msg: 'Informe o nome da máquina.' };
  const todas = await db.all('maquinas');
  if (todas.some(m => U.norm(m.nome) === U.norm(n) && m.id !== id)) return { ok: false, msg: `Já existe a máquina "${n}".` };
  const antiga = id ? await db.get('maquinas', id) : null;
  const m = { ...(antiga || { id: U.uuid(), criadoEm: Date.now() }), nome: n, ativo: !!ativo };
  m.rev = (m.rev || 0) + 1;
  m.atualizadoEm = Date.now();
  m.sync = 'pendente';
  await db.put('maquinas', m);
  window.dispatchEvent(new Event('dados-alterados'));
  return { ok: true, maquina: m };
}
