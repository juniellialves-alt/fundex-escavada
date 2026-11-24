// Cartões reutilizados nas listas (estacas e ocorrências) e bloco de resumo.
import { h } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';

function icSync(r) {
  return r.sync === 'enviada'
    ? h('span', { class: 'ic env', title: 'Enviada', 'aria-label': 'Enviada' }, '✔')
    : h('span', { class: 'ic pend', title: 'Pendente de envio', 'aria-label': 'Pendente de envio' }, '⏳');
}
function icCadeado(r) { return S.bloqueado(r) ? h('span', { class: 'ic', title: 'Bloqueada', 'aria-label': 'Bloqueada' }, '🔒') : null; }

export function cartaoEstaca(e, aoTocar) {
  const obs = e.observacao ? h('div', { class: 'obs-texto', hidden: true }, e.observacao) : null;
  const btnObs = e.observacao ? h('button', {
    class: 'ic', title: 'Ver observação', 'aria-label': 'Ver observação',
    onclick: ev => { ev.stopPropagation(); obs.hidden = !obs.hidden; },
  }, '💬') : null;
  return h('div', {
    class: 'cartao' + (S.bloqueado(e) ? ' bloq' : ''), role: 'button', tabindex: '0',
    onclick: aoTocar, onkeydown: ev => { if (ev.key === 'Enter') aoTocar(); },
  },
    h('div', { class: 'l1' },
      h('span', { class: 'nome' }, e.nome),
      h('span', { class: 'icones' },
        e.manual ? h('span', { class: 'ic man', title: 'Lançamento manual', 'aria-label': 'Lançamento manual' }, '✍ M') : null,
        btnObs, icCadeado(e), icSync(e))),
    h('div', { class: 'l2' }, `Ø ${e.diametro} cm · ${U.fmtNum(e.profundidade)} m`),
    h('div', { class: 'l3' }, `${U.fmtDate(e.data)} · ${U.timeOf(e.inicio)} – ${U.timeOf(e.fim)} · ${U.fmtDur(e.duracao)}`),
    h('div', { class: 'l4' }, `Obra ${e.obra.numero} – ${e.obra.nome} · ${e.operador}`),
    obs);
}

export function cartaoOcorrencia(o, aoTocar, { mostrarData = false } = {}) {
  const obra = o.responsabilidade === 'Obra';
  const parado = S.tempoParado(o);
  const horas = o.inicio || o.fim ? `${o.inicio || '--:--'} – ${o.fim || '--:--'}` : 'Sem horário';
  return h('div', {
    class: 'cartao ' + (obra ? 'oc-obra' : 'oc-fundex') + (S.bloqueado(o) ? ' bloq' : ''), role: 'button', tabindex: '0',
    onclick: aoTocar, onkeydown: ev => { if (ev.key === 'Enter') aoTocar(); },
  },
    h('div', { class: 'l1' },
      h('span', { class: 'nome', style: { fontSize: '21px' } }, S.nomeOcorrencia(o)),
      h('span', { class: 'icones' }, icCadeado(o), icSync(o))),
    h('div', { class: 'l3' },
      h('span', { class: 'tag ' + (obra ? 'obra' : 'fundex') }, obra ? 'Obra' : 'Fundex'), ' ',
      mostrarData ? `${U.fmtDate(o.data)} · ` : '', horas, parado ? ` · parado ${U.fmtHM(parado)}` : ''),
    o.complemento ? h('div', { class: 'l3' }, o.complemento) : null,
    h('div', { class: 'l4' }, `Obra ${o.obra.numero} – ${o.obra.nome} · ${o.maquina} · ${o.operador}`));
}

export function blocoResumo(res) {
  return h('div', { class: 'resumo' },
    h('div', { class: 'nums' },
      h('div', null, h('div', { class: 'num' }, String(res.qtd)), h('div', { class: 'lbl' }, res.qtd === 1 ? 'estaca' : 'estacas')),
      h('div', null, h('div', { class: 'num' }, U.fmtNum(res.metros)), h('div', { class: 'lbl' }, 'metros')),
      h('div', null, h('div', { class: 'num' }, U.fmtHM(res.tempo)), h('div', { class: 'lbl' }, 'tempo total'))),
    res.porDiametro.length ? h('table', { class: 'tabela-diam' },
      h('thead', null, h('tr', null, h('th', null, 'Diâmetro'), h('th', null, 'Estacas'), h('th', null, 'Metros'))),
      h('tbody', null, res.porDiametro.map(d => h('tr', null,
        h('td', null, `Ø ${d.diametro} cm`), h('td', null, String(d.qtd)), h('td', null, U.fmtNum(d.metros)))))) : null);
}
