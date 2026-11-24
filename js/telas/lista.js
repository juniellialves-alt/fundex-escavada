// Lista de estacas com filtros por dia e por obra.
import { h, nav, registrarTela, topo } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { cartaoEstaca, cartaoOcorrencia, blocoResumo } from './cartoes.js';
import { exportarArquivo } from '../exportar.js';

// Filtros ficam guardados enquanto o app estiver aberto (ao voltar da edição continuam iguais).
const filtros = { data: '', obraId: '' };

registrarTela('lista', async () => {
  const [estacas, ocorrencias, obras] = await Promise.all([S.listarEstacas(), S.listarOcorrencias(), S.listarObras()]);
  const hoje = U.today(), ontem = U.addDays(hoje, -1);

  const fData = h('input', { type: 'date', class: 'campo', value: filtros.data, max: hoje, 'aria-label': 'Filtrar por dia' });
  const bHoje = h('button', { class: 'btn btn-cinza chip' }, 'Hoje');
  const bOntem = h('button', { class: 'btn btn-cinza chip' }, 'Ontem');
  const fObra = h('select', { class: 'campo', 'aria-label': 'Filtrar por obra' },
    h('option', { value: '' }, 'Todas as obras'),
    obras.map(o => h('option', { value: o.id, selected: o.id === filtros.obraId ? 'selected' : null }, `${o.numero} – ${o.nome}`)));
  const bLimpar = h('button', { class: 'btn btn-cinza' }, '✕ Limpar filtros');
  const resultado = h('div');

  function filtrar(lista) {
    return lista.filter(r => (!filtros.data || r.data === filtros.data) && (!filtros.obraId || r.obra.id === filtros.obraId));
  }

  function desenhar() {
    fData.value = filtros.data;
    fObra.value = filtros.obraId;
    bHoje.classList.toggle('sel', filtros.data === hoje);
    bOntem.classList.toggle('sel', filtros.data === ontem);
    bLimpar.hidden = !filtros.data && !filtros.obraId;

    const est = filtrar(estacas);
    const oc = filtrar(ocorrencias);
    const partes = [];
    const desc = [filtros.data ? U.fmtDate(filtros.data) : null, filtros.obraId ? S.rotuloObra(obras.find(o => o.id === filtros.obraId)) : null].filter(Boolean).join(' · ');
    partes.push(h('div', { class: 'secao-titulo', style: { marginTop: '4px' } }, desc ? `Resumo: ${desc}` : 'Resumo: todas as estacas'));
    partes.push(blocoResumo(S.resumir(est)));
    partes.push(h('div', { class: 'espaco' }));
    partes.push(h('button', {
      class: 'btn btn-escuro btn-medio',
      onclick: () => exportarArquivo({
        estacas: est, ocorrencias: oc,
        nome: `Fundex_Estacas_${filtros.data ? U.fmtDate(filtros.data).replace(/\//g, '-') : 'todas'}${filtros.obraId ? '_obra_' + (obras.find(o => o.id === filtros.obraId) || {}).numero : ''}`,
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
  fObra.addEventListener('change', () => { filtros.obraId = fObra.value; desenhar(); });
  bHoje.onclick = () => { filtros.data = filtros.data === hoje ? '' : hoje; desenhar(); };
  bOntem.onclick = () => { filtros.data = filtros.data === ontem ? '' : ontem; desenhar(); };
  bLimpar.onclick = () => { filtros.data = ''; filtros.obraId = ''; desenhar(); };
  desenhar();

  return h('div', null,
    topo('Lista de estacas'),
    h('div', { class: 'tela' },
      h('div', { class: 'filtros' },
        h('span', { class: 'rotulo' }, 'Dia'),
        h('div', { class: 'linha' }, fData, bHoje, bOntem),
        h('span', { class: 'rotulo' }, 'Obra'),
        fObra,
        bLimpar),
      resultado));
});
