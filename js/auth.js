// Usuários, senhas e sessão (quem está usando o app neste celular).
// As senhas nunca são guardadas: só um código derivado (PBKDF2-SHA256 com sal aleatório).
import { db, getCfg, setCfg } from './db.js';
import * as U from './util.js';

// Hash SHA-256 da senha do escritório (conta mestre "admin"). A senha em si não fica no código.
const SENHA_MESTRE_HASH = '86b85dc0a7e39252ac3c3a48cd2ed4b306afd34c94712e0e2b1fb42378ce5c72';
const ITERACOES = 100000;

export const PERFIS = { adm: 'Adm', operador: 'Operador', ajudante: 'Ajudante' };
export const DESCRICAO_PERFIL = {
  adm: 'Tudo: configuração, usuários e qualquer estaca',
  operador: 'Cronômetro, estacas, ocorrências e produção',
  ajudante: 'Só vê a produção',
};
export const ADMIN_MESTRE = { id: 'admin', login: 'admin', nome: 'Administrador', perfil: 'adm' };

export const normLogin = s => U.norm(s).replace(/\s+/g, '.');
export const loginValido = l => /^[a-z0-9._-]{3,30}$/.test(l);

function gerarSal() { return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); }

async function derivar(senha, salHex) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(senha || '')), 'PBKDF2', false, ['deriveBits']);
  const sal = Uint8Array.from(salHex.match(/../g).map(x => parseInt(x, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITERACOES }, chave, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const senhaConfere = async (u, senha) => !!(u.sal && u.hash) && (await derivar(senha, u.sal)) === u.hash;

export async function senhaMestreOk(s) { return (await U.sha256(String(s || ''))) === SENHA_MESTRE_HASH; }

/* ---------------- Usuários ---------------- */
export async function listarUsuarios() {
  return (await db.all('usuarios')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
export const getUsuario = id => db.get('usuarios', id);

/** Nomes dos ajudantes cadastrados (para sugerir no formulário). */
export async function nomesAjudantes() {
  return (await listarUsuarios()).filter(u => u.ativo && u.perfil === 'ajudante').map(u => u.nome);
}

/** Cria ou altera um usuário. senha vazia = mantém a atual. */
export async function salvarUsuario({ id, nome, login, perfil, senha, ativo = true, maquinaId = null }) {
  const l = normLogin(login);
  if (l === 'admin') return { ok: false, msg: 'O usuário "admin" é reservado. Escolha outro.' };
  const todos = await db.all('usuarios');
  if (todos.some(u => u.login === l && u.id !== id)) return { ok: false, msg: `Já existe um usuário "${l}".` };
  const antigo = id ? await db.get('usuarios', id) : null;
  const u = { ...(antigo || { id: U.uuid(), criadoEm: Date.now() }), nome: nome.trim(), login: l, perfil, ativo: !!ativo };
  // máquina de costume do operador: já vem marcada na tela "Dados da obra"
  if (perfil === 'operador' && maquinaId) u.maquinaId = maquinaId; else delete u.maquinaId;
  if (senha) { u.sal = gerarSal(); u.hash = await derivar(senha, u.sal); }
  u.rev = (u.rev || 0) + 1;
  u.atualizadoEm = Date.now();
  u.sync = 'pendente';
  await db.put('usuarios', u);
  window.dispatchEvent(new Event('dados-alterados'));
  if (sessaoAtual && sessaoAtual.id === u.id) await revalidarSessao();
  return { ok: true, usuario: u };
}

/* ---------------- Sessão ---------------- */
let sessaoAtual = null;
export const sessao = () => sessaoAtual;
export const perfil = () => (sessaoAtual ? sessaoAtual.perfil : null);
export const ehAdm = () => perfil() === 'adm';
export const ehAjudante = () => perfil() === 'ajudante';
/** Adm e Operador lançam estacas e ocorrências; Ajudante só consulta. */
export const podeOperar = () => perfil() === 'adm' || perfil() === 'operador';

export async function carregarSessao() { sessaoAtual = await getCfg('sessao'); return sessaoAtual; }

async function abrirSessao(u) {
  sessaoAtual = { id: u.id, login: u.login, nome: u.nome, perfil: u.perfil };
  await setCfg('sessao', sessaoAtual);
  return sessaoAtual;
}

/** Retorna {ok, msg, naoEncontrado}. */
export async function entrar(login, senha) {
  const l = normLogin(login);
  const falha = { ok: false, msg: 'Usuário ou senha incorretos.' };
  if (!l || !senha) return { ok: false, msg: 'Digite o usuário e a senha.' };
  if (l === 'admin') return (await senhaMestreOk(senha)) ? { ok: true, sessao: await abrirSessao(ADMIN_MESTRE) } : falha;
  const u = (await db.all('usuarios')).find(x => x.login === l);
  if (!u) return { ok: false, naoEncontrado: true, msg: `Usuário "${l}" não encontrado neste celular.` };
  if (!(await senhaConfere(u, senha))) return falha;
  if (!u.ativo) return { ok: false, msg: 'Este usuário está desativado. Fale com o escritório.' };
  return { ok: true, sessao: await abrirSessao(u) };
}

export async function sair() { sessaoAtual = null; await setCfg('sessao', null); }

/** Confere se o usuário logado ainda existe e está ativo (pode ter mudado na planilha). Retorna false se saiu. */
export async function revalidarSessao() {
  if (!sessaoAtual || sessaoAtual.id === ADMIN_MESTRE.id) return !!sessaoAtual;
  const u = await db.get('usuarios', sessaoAtual.id);
  if (!u || !u.ativo) { await sair(); return false; }
  if (u.nome !== sessaoAtual.nome || u.perfil !== sessaoAtual.perfil || u.login !== sessaoAtual.login) await abrirSessao(u);
  return true;
}

/** Senha de algum Adm (ou a do escritório): usada para destravar registros com mais de 3 dias. */
export async function senhaAdmOk(s) {
  if (await senhaMestreOk(s)) return true;
  for (const u of await db.all('usuarios')) {
    if (u.ativo && u.perfil === 'adm' && (await senhaConfere(u, s))) return true;
  }
  return false;
}
