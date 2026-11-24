// Regras de negócio: obras, dados ativos, cronômetro, estacas, ocorrências, conferências e alterações.
import { db, getCfg, setCfg } from './db.js';
import * as U from './util.js';

// Hash SHA-256 da senha de configuração (a senha em si não fica no código).
const SENHA_HASH = 'ca48d10b743d65358e78c30f190f23c936dca1721648df04762e5ed40fe5587d';
export async function senhaOk(s) { return (await U.sha256(String(s || ''))) === SENHA_HASH; }

export const PRAZO_DIAS = 3;
export const DIAMETROS = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];
export const OCORRENCIAS = {
  Obra: ['Chuva', 'Obra sem acesso', 'Sem frente de serviço', 'Estacas não locadas', 'Perfurou cano/fiação',
    'Bomba de concreto atrapalhando', 'Caminhão de concreto atrapalhando', 'Estacas vizinhas sem concretar',
    'Obra sem limpeza', 'Falta de água', 'Obra pediu para parar', 'Outros (obra)'],
  Fundex: ['Manutenção do equipamento', 'Equipamento sem combustível', 'Ajudante atrasado', 'Operador atrasado', 'Outros (Fundex)'],
};
export const ehOutros = tipo => /^Outros/.test(tipo || '');

function avisar() { window.dispatchEvent(new Event('dados-alterados')); }

/** Grava um registro marcando-o como pendente de envio. */
async function salvar(store, rec) {
  rec.rev = (rec.rev || 0) + 1;
  rec.atualizadoEm = Date.now();
  rec.sync = 'pendente';
  await db.put(store, rec);
  avisar();
  return rec;
}

/* ---------------- Obras e dados ativos ---------------- */
export const snapObra = o => ({ id: o.id, numero: o.numero, cliente: o.cliente, nome: o.nome, endereco: o.endereco || '' });
export const rotuloObra = o => (o ? `${o.numero} – ${o.nome}` : '');
/** Lista de ajudantes em texto: "Pedro, Marcos". */
export const fmtAjudantes = a => (Array.isArray(a) ? a.filter(Boolean).join(', ') : (a || ''));

export async function listarObras() {
  return (await db.all('obras')).sort((a, b) => (b.usadaEm || 0) - (a.usadaEm || 0));
}
export async function getObra(id) { const o = await db.get('obras', id); return o ? snapObra(o) : null; }

export async function getAtivo() {
  const a = await getCfg('ativo');
  if (!a) return null;
  const obra = await db.get('obras', a.obraId);
  if (!obra || !a.operador || !a.maquina) return null;
  return { obra: snapObra(obra), operador: a.operador, maquina: a.maquina, ajudantes: a.ajudantes || [] };
}

/** Salva a tela "Dados da obra". A obra é identificada pelo Nº da obra. */
export async function salvarDadosObra(d) {
  const obras = await db.all('obras');
  let obra = obras.find(o => U.norm(o.numero) === U.norm(d.numero));
  if (!obra) obra = { id: U.uuid(), criadaEm: Date.now() };
  Object.assign(obra, {
    numero: d.numero.trim(), cliente: d.cliente.trim(), nome: d.nome.trim(),
    endereco: (d.endereco || '').trim(), usadaEm: Date.now(),
  });
  await db.put('obras', obra);
  await setCfg('ativo', { obraId: obra.id, operador: d.operador.trim(), maquina: d.maquina.trim(), ajudantes: d.ajudantes || [] });
  avisar();
}

/* ---------------- Conferência diária ---------------- */
export async function precisaConferencia() { return (await getCfg('ultimaConferencia')) !== U.today(); }

export async function registrarConferencia(ativo, ts) {
  const rec = { id: U.uuid(), data: U.dateOf(ts), hora: ts, obra: ativo.obra, operador: ativo.operador, maquina: ativo.maquina, ajudantes: ativo.ajudantes || [] };
  await salvar('conferencias', rec);
  await setCfg('ultimaConferencia', rec.data);
}

/* ---------------- Cronômetro (baseado na hora salva) ---------------- */
export const getCrono = () => getCfg('cronometro');
export async function iniciarCrono(ts) {
  const ativo = await getAtivo();
  await setCfg('cronometro', { inicio: ts, fim: null, ativo });
}
export async function pararCrono(ts) {
  const c = await getCrono();
  if (c && !c.fim) { c.fim = ts; await setCfg('cronometro', c); }
  return c;
}
export async function limparCrono() { await setCfg('cronometro', null); }

/* ---------------- Estacas ---------------- */
export function calcDuracao(e) {
  e.duracao = Math.max(0, Math.round((e.fim - e.inicio) / 1000));
  e.data = U.dateOf(e.inicio);
  return e;
}
export async function listarEstacas() {
  return (await db.all('estacas')).filter(e => !e.excluido).sort((a, b) => b.inicio - a.inicio);
}
export async function criarEstaca(d) {
  const e = calcDuracao({ id: U.uuid(), criadoEm: Date.now(), excluido: false, manual: false, observacao: '', ...d });
  await salvar('estacas', e);
  await setCfg('ultimoDiametro', e.diametro);
  return e;
}
/** Registros com mais de 3 dias ficam bloqueados (a não ser que o escritório desbloqueie com a senha). */
export const bloqueado = r => U.diffDays(r.data, U.today()) > PRAZO_DIAS;
/** IDs desbloqueados com a senha nesta sessão do app. */
export const desbloqueados = new Set();
export const travado = r => bloqueado(r) && !desbloqueados.has(r.id);
export const getEstaca = id => db.get('estacas', id);
export const getOcorrencia = id => db.get('ocorrencias', id);

/** Outra estaca da mesma máquina com horário sobreposto. */
export async function sobreposicao(e) {
  const todas = await listarEstacas();
  return todas.find(o => o.id !== e.id && U.norm(o.maquina) === U.norm(e.maquina) && o.inicio < e.fim && e.inicio < o.fim) || null;
}

const txt = v => (v == null ? '' : String(v));
const CAMPOS_ESTACA = [
  ['nome', 'Estaca'], ['diametro', 'Diâmetro (cm)'], ['profundidade', 'Profundidade (m)', v => U.fmtNum(v)],
  ['data', 'Data', U.fmtDate], ['inicio', 'Início', v => U.timeOf(v)], ['fim', 'Término', v => U.timeOf(v)],
  ['observacao', 'Observação'], ['obra', 'Obra', rotuloObra], ['operador', 'Operador'], ['ajudantes', 'Ajudante(s)', fmtAjudantes],
  ['maquina', 'Máquina'],
];
const CAMPOS_OCORRENCIA = [
  ['tipo', 'Ocorrência'], ['outros', 'Descrição (Outros)'], ['responsabilidade', 'Responsabilidade'],
  ['data', 'Data', U.fmtDate], ['inicio', 'Início'], ['fim', 'Término'], ['complemento', 'Complemento'],
  ['obra', 'Obra', rotuloObra], ['operador', 'Operador'], ['ajudantes', 'Ajudante(s)', fmtAjudantes], ['maquina', 'Máquina'],
];

async function operadorAtual() { const a = await getAtivo(); return a ? a.operador : ''; }

async function registrarAlteracao(tipo, rec, nome, campo, anterior, novo) {
  await salvar('alteracoes', {
    id: U.uuid(), registroTipo: tipo, registroId: rec.id, registroNome: nome,
    campo, anterior, novo, quando: Date.now(), operador: await operadorAtual(),
  });
}
async function registrarDiferencas(tipo, antigo, novo, campos, nome) {
  for (const [k, label, f = txt] of campos) {
    const a = txt(f(antigo[k])), b = txt(f(novo[k]));
    if (a !== b) await registrarAlteracao(tipo, novo, nome, label, a, b);
  }
}

export async function editarEstaca(antigo, novo) {
  calcDuracao(novo);
  await registrarDiferencas('Estaca', antigo, novo, CAMPOS_ESTACA, novo.nome);
  await salvar('estacas', novo);
}
export async function excluirEstaca(e) {
  await salvar('estacas', { ...e, excluido: true });
  await registrarAlteracao('Estaca', e, e.nome, 'EXCLUSÃO',
    `${e.nome} | Ø${e.diametro} cm | ${U.fmtNum(e.profundidade)} m | ${U.fmtDate(e.data)} ${U.timeOf(e.inicio)}-${U.timeOf(e.fim)}`, 'Excluída');
}

/* ---------------- Ocorrências ---------------- */
export const nomeOcorrencia = o => (ehOutros(o.tipo) && o.outros ? `${o.tipo}: ${o.outros}` : o.tipo);
export function tempoParado(o) { const d = U.hmDiff(o.inicio, o.fim); return d > 0 ? d : 0; }

export async function listarOcorrencias() {
  return (await db.all('ocorrencias')).filter(o => !o.excluido)
    .sort((a, b) => (b.data + (b.inicio || '99')).localeCompare(a.data + (a.inicio || '99')) || b.criadoEm - a.criadoEm);
}
export async function salvarOcorrencia(o, antigo) {
  if (antigo) {
    await registrarDiferencas('Ocorrência', antigo, o, CAMPOS_OCORRENCIA, nomeOcorrencia(o));
  } else {
    Object.assign(o, { id: U.uuid(), criadoEm: Date.now(), excluido: false });
  }
  await salvar('ocorrencias', o);
  return o;
}
export async function excluirOcorrencia(o) {
  await salvar('ocorrencias', { ...o, excluido: true });
  await registrarAlteracao('Ocorrência', o, nomeOcorrencia(o), 'EXCLUSÃO',
    `${nomeOcorrencia(o)} | ${U.fmtDate(o.data)} ${o.inicio || ''}-${o.fim || ''}`, 'Excluída');
}

/* ---------------- Resumos ---------------- */
export function resumir(estacas) {
  const r = { qtd: 0, metros: 0, tempo: 0, porDiametro: [] };
  const m = new Map();
  for (const e of estacas) {
    r.qtd++; r.metros += e.profundidade; r.tempo += e.duracao;
    const d = m.get(e.diametro) || { diametro: e.diametro, qtd: 0, metros: 0 };
    d.qtd++; d.metros += e.profundidade; m.set(e.diametro, d);
  }
  r.porDiametro = [...m.values()].sort((a, b) => a.diametro - b.diametro);
  return r;
}

export async function contarPendentes() {
  let n = 0;
  for (const s of ['estacas', 'ocorrencias', 'conferencias', 'alteracoes']) {
    n += (await db.all(s)).filter(r => r.sync === 'pendente').length;
  }
  return n;
}
