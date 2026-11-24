// Lista de estacas com filtros por dia e por obra.
import { h, nav, registrarTela, topo } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { cartaoEstaca, cartaoOcorrencia, blocoResumo } from './cartoes.js';
import { exportarArquivo } from '../exportar.js';
import * as A from '../auth.js';

// Filtros ficam guardados enquanto o app estiver aberto (ao voltar da edição continuam iguais).
// obra = chave do Nº da obra (a mesma obra pode ter sido cadastrada em vários celulares).
const filtros = { data: '', obra: '', minhas: null };

registrarTela('lista', async () => {
  const [estacas, ocorrencias, obrasLocais] = await Promise.all([S.listarEstacas(), S.listarOcorrencias(), S.listarObras()]);
  const hoje = U.today(), ontem = U.addDays(hoje, -1);
  // Operador começa vendo só as dele; pode ver as de todos com o botão
  const podeVerTodas = A.perfil() === 'operador';
  if (filtros.dono !== A.sessao().id) Object.assign(filtros, { dono: A.sessao().id, data: '', obra: '', minhas: podeVerTodas });

  // obras: as do celular + as que aparecem nas estacas/ocorrências baixadas
  const obras = new Map();
  for (const o of [...obrasLocais, ...estacas.map(e => e.obra), ...ocorrencias.map(o => o.obra)]) {
    if (o && o.numero && !obras.has(S.chaveObra(o))) obras.set(S.chaveObra(o), o);
  }

  const fData = h('input', { type: 'date', class: 'campo', value: filtros.data, max: hoje, 'aria-label': 'Filtrar por dia' });
  const bHoje = h('button', { class: 'btn btn-cinza chip' }, 'Hoje');
  const bOntem = h('button', { class: 'btn btn-cinza chip' }, 'Ontem');
  const fObra = h('select', { class: 'campo', 'aria-label': 'Filtrar por obra' },
    h('option', { value: '' }, 'Todas as obras'),
    [...obras.entries()].map(([k, o]) => h('option', { value: k, selected: k === filtros.obra ? 'selected' : null }, `${o.numero} – ${o.nome}`)));
  const bMinhas = h('button', { class: 'btn btn-cinza chip' }, 'Só as minhas');
  const bTodas = h('button', { class: 'btn btn-cinza chip' }, 'De todos');
  const bLimpar = h('button', { class: 'btn btn-cinza' }, '✕ Limpar filtros');
  const resultado = h('div');

  function filtrar(lista) {
    return lista.filter(r => (!filtros.data || r.data === filtros.data) && (!filtros.obra || S.chaveObra(r.obra) === filtros.obra)
      && (!filtros.minhas || S.ehMeu(r)));
  }

  function desenhar() {
    fData.value = filtros.data;
    fObra.value = filtros.obra;
    bHoje.classList.toggle('sel', filtros.data === hoje);
    bOntem.classList.toggle('sel', filtros.data === ontem);
    bMinhas.classList.toggle('sel', !!filtros.minhas);
    bTodas.classList.toggle('sel', !filtros.minhas);
    bLimpar.hidden = !filtros.data && !filtros.obra;

    const est = filtrar(estacas);
    const oc = filtrar(ocorrencias);
    const partes = [];
    const desc = [filtros.data ? U.fmtDate(filtros.data) : null, filtros.obra ? S.rotuloObra(obras.get(filtros.obra)) : null,
      filtros.minhas ? 'só as minhas' : null].filter(Boolean).join(' · ');
    partes.push(h('div', { class: 'secao-titulo', style: { marginTop: '4px' } }, desc ? `Resumo: ${desc}` : 'Resumo: todas as estacas'));
    partes.push(blocoResumo(S.resumir(est)));
    partes.push(h('div', { class: 'espaco' }));
    partes.push(h('button', {
      class: 'btn btn-escuro btn-medio',
      onclick: () => exportarArquivo({
        estacas: est, ocorrencias: oc,
        nome: `Fundex_Estacas_${filtros.data ? U.fmtDate(filtros.data).replace(/\//g, '-') : 'todas'}${filtros.obra ? '_obra_' + (obras.get(filtros.obra) || {}).numero : ''}`,
      }),
    }, '⇪ Exportar Excel (o que está filtrado)'));

    partes.push(h('div', { class: 'secao-titulo' }, `Estacas (${est.length})`));
    partes.push(est.length
      ? h('div', { class: 'cartoes' }, est.map(e => cartaoEstaca(e, () => nav.go('estaca', { modo: 'editar', id: e.id }))))
      : h('div', { class: 'vazio' }, 'Nenhuma estaca encontrada.'));

    if (filtros.data) {
      partes.push(h('div', { class: 'secao-titulo' }, `Ocorrências do dia (${oc.length})`));
      partes.push(oc.length
        ? h('div', { class: 'cartoes' }, oc.map(o => cartaoOcorrencia(o, () => nav.go('ocorrencia', { id: o.id }))))
        : h('div', { class: 'vazio' }, 'Nenhuma ocorrência neste dia.'));
    }
    resultado.replaceChildren(...partes);
  }

  fData.addEventListener('change', () => { filtros.data = fData.value; desenhar(); });
  fObra.addEventListener('change', () => { filtros.obra = fObra.value; desenhar(); });
  bHoje.onclick = () => { filtros.data = filtros.data === hoje ? '' : hoje; desenhar(); };
  bOntem.onclick = () => { filtros.data = filtros.data === ontem ? '' : ontem; desenhar(); };
  bMinhas.onclick = () => { filtros.minhas = true; desenhar(); };
  bTodas.onclick = () => { filtros.minhas = false; desenhar(); };
  bLimpar.onclick = () => { filtros.data = ''; filtros.obra = ''; desenhar(); };
  desenhar();

  return h('div', null,
    topo('Lista de estacas'),
    h('div', { class: 'tela' },
      h('div', { class: 'filtros' },
        h('span', { class: 'rotulo' }, 'Dia'),
        h('div', { class: 'linha' }, fData, bHoje, bOntem),
        h('span', { class: 'rotulo' }, 'Obra'),
        fObra,
        podeVerTodas ? h('span', { class: 'rotulo' }, 'Operador') : null,
        podeVerTodas ? h('div', { class: 'linha' }, bMinhas, bTodas) : null,
        bLimpar),
      resultado));
});
