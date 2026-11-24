// Produção mensal. Operador: só a dele. Ajudante: só as estacas em que trabalhou. Adm: escolhe o operador (ou todos).
import { h, nav, registrarTela, topo } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { cartaoEstaca, cartaoOcorrencia, blocoResumo } from './cartoes.js';
import { exportarArquivo } from '../exportar.js';
import * as A from '../auth.js';

let mesSel = null; // guardado enquanto o app estiver aberto
const escolha = { dono: null, operador: '' }; // operador = nome normalizado; '' = todos

/** O ajudante aparece na lista de ajudantes da estaca/ocorrência (pelo nome do cadastro). */
const trabalhouNela = (r, eu) => (r.ajudantes || []).some(n => U.norm(n) === eu);

async function dadosDoOperador() {
  const [todasE, todasO] = await Promise.all([S.listarEstacas(), S.listarOcorrencias()]);
  const s = A.sessao();
  if (s.perfil === 'operador') {
    // Operador que trabalhou como ajudante de outro operador: aparece a opção "Como ajudante" (só quando isso aconteceu)
    const eu = U.norm(s.nome);
    const estAjud = todasE.filter(e => !S.ehMeu(e) && trabalhouNela(e, eu));
    const ocAjud = todasO.filter(o => !S.ehMeu(o) && trabalhouNela(o, eu));
    if (escolha.dono !== s.id) Object.assign(escolha, { dono: s.id, operador: '', modo: 'operador' });
    if (!estAjud.length) escolha.modo = 'operador';
    const comoAjud = escolha.modo === 'ajudante';
    return {
      titulo: 'Minha produção', nomeOper: s.nome, escolhe: false,
      rotulo: comoAjud ? `Como ajudante: ${s.nome}` : `Operador: ${s.nome}`,
      est: comoAjud ? estAjud : todasE.filter(S.ehMeu), oc: comoAjud ? ocAjud : todasO.filter(S.ehMeu),
      modos: estAjud.length ? { comoAjud, qtd: estAjud.length } : null,
    };
  }
  if (s.perfil === 'ajudante') {
    const eu = U.norm(s.nome);
    return { titulo: 'Minha produção', rotulo: `Ajudante: ${s.nome}`, nomeOper: s.nome, escolhe: false,
      est: todasE.filter(e => trabalhouNela(e, eu)), oc: todasO.filter(o => trabalhouNela(o, eu)) };
  }
  const nomes = new Map();
  for (const r of [...todasE, ...todasO]) if (r.operador && !nomes.has(U.norm(r.operador))) nomes.set(U.norm(r.operador), r.operador);
  if (escolha.dono !== s.id) Object.assign(escolha, { dono: s.id, operador: '' });
  if (escolha.operador && !nomes.has(escolha.operador)) escolha.operador = '';
  const filtro = r => !escolha.operador || U.norm(r.operador) === escolha.operador;
  const nomeOper = escolha.operador ? nomes.get(escolha.operador) : 'Todos os operadores';
  return {
    titulo: 'Produção', escolhe: true, nomes, nomeOper, rotulo: `Operador: ${nomeOper}`,
    est: todasE.filter(filtro), oc: todasO.filter(filtro),
  };
}

const total = (num, lbl, classe = '') => h('div', { class: 'total ' + classe }, h('div', { class: 'num' }, num), h('div', { class: 'lbl' }, lbl));

registrarTela('producao', async () => {
  const { titulo, rotulo, nomeOper, escolhe, nomes, modos, est: todasE, oc: todasO } = await dadosDoOperador();
  const mesAtual = U.monthOf(U.today());
  if (!mesSel) mesSel = mesAtual;

  const est = todasE.filter(e => U.monthOf(e.data) === mesSel);
  const oc = todasO.filter(o => U.monthOf(o.data) === mesSel);
  const res = S.resumir(est);

  // tempo parado
  let parObra = 0, parFundex = 0;
  const porTipo = new Map();
  for (const o of oc) {
    const t = S.tempoParado(o);
    if (o.responsabilidade === 'Obra') parObra += t; else parFundex += t;
    const k = o.responsabilidade + '|' + o.tipo;
    const x = porTipo.get(k) || { resp: o.responsabilidade, tipo: o.tipo, qtd: 0, tempo: 0 };
    x.qtd++; x.tempo += t; porTipo.set(k, x);
  }
  const tipos = [...porTipo.values()].sort((a, b) => a.resp.localeCompare(b.resp) || b.tempo - a.tempo || b.qtd - a.qtd);

  // dia a dia
  const dias = [...new Set([...est.map(e => e.data), ...oc.map(o => o.data)])].sort();
  let acum = 0;
  const linhasDia = dias.map(d => {
    const ed = est.filter(e => e.data === d);
    const m = ed.reduce((s, e) => s + e.profundidade, 0);
    acum += m;
    return { d, qtd: ed.length, metros: m, acum, temOc: oc.some(o => o.data === d) };
  });
  const maxM = Math.max(1, ...linhasDia.map(l => l.metros));

  // por obra (a mesma obra = mesmo Nº da obra)
  const porObra = new Map();
  for (const e of est) {
    const k = S.chaveObra(e.obra);
    const x = porObra.get(k) || { rotulo: S.rotuloObra(e.obra), qtd: 0, metros: 0 };
    x.qtd++; x.metros += e.profundidade; porObra.set(k, x);
  }

  const mudarMes = n => { mesSel = U.addMonths(mesSel, n); nav.refresh(); };

  const seletorOper = escolhe ? (() => {
    const s = h('select', { class: 'campo', 'aria-label': 'Operador' },
      h('option', { value: '' }, 'Todos os operadores'),
      [...nomes.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
        .map(([k, n]) => h('option', { value: k, selected: k === escolha.operador ? 'selected' : null }, n)));
    s.addEventListener('change', () => { escolha.operador = s.value; nav.refresh(); });
    return h('label', { class: 'grupo', style: { marginBottom: '10px' } }, h('span', { class: 'rotulo' }, 'Operador'), s);
  })() : null;

  // Operador que também trabalhou como ajudante: escolhe qual produção ver
  const seletorModo = modos ? h('div', { class: 'filtros-chips', style: { display: 'flex', gap: '8px', margin: '12px 0' } },
    h('button', { class: 'btn btn-cinza chip' + (modos.comoAjud ? '' : ' sel'), onclick: () => { escolha.modo = 'operador'; nav.refresh(); } }, 'Como operador'),
    h('button', { class: 'btn btn-cinza chip' + (modos.comoAjud ? ' sel' : ''), onclick: () => { escolha.modo = 'ajudante'; nav.refresh(); } },
      `Como ajudante (${modos.qtd})`)) : null;

  return h('div', null,
    topo(titulo),
    h('div', { class: 'tela' },
      seletorOper,
      seletorModo,
      h('div', { class: 'seletor-mes' },
        h('button', { class: 'btn btn-escuro', 'aria-label': 'Mês anterior', onclick: () => mudarMes(-1) }, '◀'),
        h('div', { class: 'mes' }, U.fmtMonth(mesSel)),
        h('button', { class: 'btn btn-escuro', 'aria-label': 'Próximo mês', disabled: mesSel >= mesAtual, onclick: () => mudarMes(1) }, '▶')),
      h('div', { style: { fontWeight: 700, color: 'var(--texto-2)', marginBottom: '10px' } },
        rotulo, mesSel === mesAtual ? ` · do dia 1º até hoje` : ''),

      h('div', { class: 'totais' },
        total(String(res.qtd), 'estacas'),
        total(U.fmtNum(res.metros), 'metros perfurados'),
        total(U.fmtHM(res.tempo), 'tempo trabalhado'),
        total(String(linhasDia.filter(l => l.qtd).length), 'dias com estacas'),
        total(U.fmtHM(parObra), 'parado – Obra', 'obra'),
        total(U.fmtHM(parFundex), 'parado – Fundex', 'fundex')),

      h('div', { class: 'espaco' }),
      h('button', {
        class: 'btn btn-escuro btn-medio',
        onclick: () => exportarArquivo({ estacas: est, ocorrencias: oc, nome: `Fundex_Producao_${mesSel}_${nomeOper}` }),
      }, '⇪ Exportar Excel do mês'),

      h('div', { class: 'secao-titulo' }, 'Por diâmetro'),
      res.porDiametro.length ? h('table', { class: 'tabela' },
        h('thead', null, h('tr', null, h('th', null, 'Diâmetro'), h('th', null, 'Estacas'), h('th', null, 'Metros'))),
        h('tbody', null, res.porDiametro.map(d => h('tr', null, h('td', null, `Ø ${d.diametro} cm`), h('td', null, String(d.qtd)), h('td', null, U.fmtNum(d.metros))))))
        : h('div', { class: 'vazio' }, 'Nenhuma estaca neste mês.'),

      h('div', { class: 'secao-titulo' }, 'Dia a dia'),
      linhasDia.length ? h('table', { class: 'tabela' },
        h('thead', null, h('tr', null, h('th', null, 'Dia'), h('th', null, 'Estacas'), h('th', null, 'Metros'), h('th', null, 'Acumulado'))),
        h('tbody', null, linhasDia.map(l => h('tr', { class: 'clicavel', onclick: () => nav.go('dia', { data: l.d }) },
          h('td', null,
            h('span', { class: 'dia-nome' }, `${l.d.slice(8)}/${l.d.slice(5, 7)} ${U.weekday(l.d, true)}`),
            l.temOc ? h('span', { title: 'Houve ocorrência', 'aria-label': 'Houve ocorrência' }, ' ⚠️') : null,
            h('div', { class: 'barra-dia', style: { width: `${Math.max(2, (l.metros / maxM) * 100)}%`, opacity: l.metros ? 1 : 0 } })),
          h('td', null, String(l.qtd)), h('td', null, U.fmtNum(l.metros)), h('td', null, U.fmtNum(l.acum))))))
        : h('div', { class: 'vazio' }, 'Nenhum dia trabalhado neste mês.'),
      linhasDia.length ? h('p', { style: { fontSize: '15px', color: 'var(--texto-2)' } }, 'Toque em um dia para ver as estacas e ocorrências.') : null,

      h('div', { class: 'secao-titulo' }, 'Por obra'),
      porObra.size ? h('table', { class: 'tabela' },
        h('thead', null, h('tr', null, h('th', null, 'Obra'), h('th', null, 'Estacas'), h('th', null, 'Metros'))),
        h('tbody', null, [...porObra.values()].map(x => h('tr', null, h('td', null, x.rotulo), h('td', null, String(x.qtd)), h('td', null, U.fmtNum(x.metros))))))
        : h('div', { class: 'vazio' }, '—'),

      h('div', { class: 'secao-titulo' }, 'Tempo parado por tipo'),
      tipos.length ? h('table', { class: 'tabela' },
        h('thead', null, h('tr', null, h('th', null, 'Ocorrência'), h('th', null, 'Vezes'), h('th', null, 'Parado'))),
        h('tbody', null, tipos.map(t => h('tr', null,
          h('td', null, h('span', { class: 'tag ' + (t.resp === 'Obra' ? 'obra' : 'fundex') }, t.resp), ' ', t.tipo),
          h('td', null, String(t.qtd)), h('td', null, t.tempo ? U.fmtHM(t.tempo) : '—')))))
        : h('div', { class: 'vazio' }, 'Nenhuma ocorrência neste mês.')));
});

registrarTela('dia', async ({ data }) => {
  const { est, oc } = await dadosDoOperador();
  const ed = est.filter(e => e.data === data);
  const od = oc.filter(o => o.data === data);
  const parado = od.reduce((s, o) => s + S.tempoParado(o), 0);
  return h('div', null,
    topo(`${U.fmtDate(data)}`),
    h('div', { class: 'tela' },
      h('div', { class: 'secao-titulo' }, `${U.weekday(data)}`),
      blocoResumo(S.resumir(ed)),
      h('div', { class: 'secao-titulo' }, `Estacas (${ed.length})`),
      ed.length ? h('div', { class: 'cartoes' }, ed.map(e => cartaoEstaca(e, () => nav.go('estaca', { modo: 'editar', id: e.id }))))
        : h('div', { class: 'vazio' }, 'Nenhuma estaca neste dia.'),
      h('div', { class: 'secao-titulo' }, `Ocorrências (${od.length})`),
      od.length ? h('div', { class: 'aviso aviso-info', style: { marginBottom: '8px' } }, `Tempo parado total do dia: ${U.fmtHM(parado)}`) : null,
      od.length ? h('div', { class: 'cartoes' }, od.map(o => cartaoOcorrencia(o, () => nav.go('ocorrencia', { id: o.id }))))
        : h('div', { class: 'vazio' }, 'Nenhuma ocorrência neste dia.')));
});
