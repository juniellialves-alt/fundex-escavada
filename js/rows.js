// Colunas e linhas usadas na exportação Excel e no envio para a planilha Google.
import * as U from './util.js';
import { nomeOcorrencia, tempoParado, fmtAjudantes } from './store.js';

export const COLS_ESTACA = ['Nº da obra', 'Cliente', 'Obra', 'Endereço', 'Máquina', 'Operador', 'Ajudante(s)', 'Data', 'Estaca',
  'Diâmetro (cm)', 'Profundidade (m)', 'Início', 'Término', 'Duração', 'Observação', 'Lançamento manual'];
export function linhaEstaca(e) {
  return [e.obra.numero, e.obra.cliente, e.obra.nome, e.obra.endereco || '', e.maquina, e.operador, fmtAjudantes(e.ajudantes), U.fmtDate(e.data), e.nome,
    e.diametro, e.profundidade, U.timeOf(e.inicio), U.timeOf(e.fim), U.fmtDur(e.duracao), e.observacao || '', e.manual ? 'Sim' : 'Não'];
}

export const COLS_OCORRENCIA = ['Nº da obra', 'Cliente', 'Obra', 'Máquina', 'Operador', 'Ajudante(s)', 'Data', 'Responsabilidade',
  'Ocorrência', 'Início', 'Término', 'Tempo parado', 'Complemento'];
export function linhaOcorrencia(o) {
  return [o.obra.numero, o.obra.cliente, o.obra.nome, o.maquina, o.operador, fmtAjudantes(o.ajudantes), U.fmtDate(o.data), o.responsabilidade,
    nomeOcorrencia(o), o.inicio || '', o.fim || '', o.inicio && o.fim ? U.fmtDur(tempoParado(o)) : '', o.complemento || ''];
}

export const COLS_CONFERENCIA = ['Data', 'Hora da confirmação', 'Nº da obra', 'Cliente', 'Obra', 'Endereço', 'Operador', 'Ajudante(s)', 'Máquina'];
export function linhaConferencia(c) {
  return [U.fmtDate(c.data), U.timeOf(c.hora, true), c.obra.numero, c.obra.cliente, c.obra.nome, c.obra.endereco || '', c.operador, fmtAjudantes(c.ajudantes), c.maquina];
}

export const COLS_ALTERACAO = ['Registro', 'Identificação', 'Campo', 'Valor anterior', 'Valor novo', 'Data e hora', 'Operador'];
export function linhaAlteracao(a) {
  return [a.registroTipo, a.registroNome, a.campo, a.anterior, a.novo, `${U.fmtDate(U.dateOf(a.quando))} ${U.timeOf(a.quando, true)}`, a.operador];
}

/** Formato de envio: ID primeiro; Estacas e Ocorrências ganham "Excluído" e "Atualizado em". */
const comControle = (cols, fn, excluivel) => ({
  colunas: ['ID', ...cols, ...(excluivel ? ['Excluído'] : []), 'Atualizado em'],
  linha: r => [r.id, ...fn(r), ...(excluivel ? [r.excluido ? 'Sim' : 'Não'] : []), U.fmtDateTime(r.atualizadoEm)],
});

export const SYNC = [
  { store: 'estacas', aba: 'Estacas', ...comControle(COLS_ESTACA, linhaEstaca, true) },
  { store: 'ocorrencias', aba: 'Ocorrências', ...comControle(COLS_OCORRENCIA, linhaOcorrencia, true) },
  { store: 'conferencias', aba: 'Conferências', ...comControle(COLS_CONFERENCIA, linhaConferencia, false) },
  { store: 'alteracoes', aba: 'Alterações', ...comControle([...COLS_ALTERACAO, 'ID do registro'], a => [...linhaAlteracao(a), a.registroId], false) },
];
