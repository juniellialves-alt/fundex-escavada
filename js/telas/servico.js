// Serviço adicional feito depois da perfuração (outra hora ou outro dia): alargamento de base ou colocação de armadura.
// O operador cronometra (ou lança o horário à mão) e no fim escolhe a estaca em que fez o serviço.
import { h, nav, registrarTela, topo, toast, mostrarErros, campo, confirmar, avisar } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';
import * as A from '../auth.js';
import { cartaoEstaca } from './cartoes.js';

const PASSO_DIAS = 5;

registrarTela('servico', async ({ manual = false, tipoInicial = null } = {}) => {
  if (!A.podeOperar()) { setTimeout(() => nav.back()); return h('div'); }
  const crono = await S.getCrono();
  const avulso = await S.getServicoAvulso();
  if (crono && !avulso) {
    setTimeout(async () => { await avisar('Termine a estaca em andamento antes de cronometrar um serviço separado.\nPara fazer o serviço logo depois da perfuração, use os botões "Finalizar e iniciar…" na tela principal.'); nav.back(); });
    return h('div');
  }
  if (avulso && !avulso.fim) { setTimeout(() => nav.reset('principal')); return h('div'); }

  // ---------- 1) ainda não começou: escolher o serviço e iniciar (ou lançar à mão) ----------
  if (!avulso && !manual) {
    let tipo = tipoInicial;
    const botoes = S.TIPOS_SERVICO.map(t => {
      const b = h('button', { type: 'button', class: 'opcao' }, S.SERVICOS[t]);
      b.onclick = () => { tipo = t; marcar(); };
      return [b, t];
    });
    const marcar = () => botoes.forEach(([b, t]) => b.classList.toggle('sel', t === tipo));
    marcar();
    const erros = h('div', { class: 'erros', hidden: true });
    const exigeTipo = () => { mostrarErros(erros, tipo ? [] : ['Toque no serviço.']); return !!tipo; };
    return h('div', null,
      topo('Serviço adicional'),
      h('div', { class: 'tela' },
        h('div', { class: 'form' },
          h('div', { class: 'aviso aviso-info' }, 'Use para o serviço feito depois, em outra hora ou outro dia. No fim você escolhe a estaca.'),
          h('div', { class: 'grupo' }, h('span', { class: 'rotulo' }, 'Qual serviço?'), h('div', { class: 'grade-opcoes' }, botoes.map(b => b[0]))),
          erros,
          h('button', {
            class: 'btn btn-verde btn-gigante',
            onclick: async () => {
              if (!exigeTipo()) return;
              await S.iniciarServicoAvulso(tipo, Date.now());
              toast(`${S.SERVICOS[tipo]} iniciado`);
              nav.reset('principal');
            },
          }, '▶ INICIAR AGORA'),
          h('button', {
            class: 'btn btn-cinza btn-medio',
            onclick: () => { if (exigeTipo()) nav.go('servico', { manual: true, tipoInicial: tipo }, { replace: true }); },
          }, 'Já fiz: lançar o horário à mão'))));
  }

  // ---------- 2) escolher a estaca (depois do cronômetro ou com horário à mão) ----------
  const tipo = avulso ? avulso.tipo : tipoInicial;
  const hoje = U.today();
  const fData = h('input', { type: 'date', class: 'campo', value: hoje, max: hoje });
  const fIni = h('input', { type: 'time', class: 'campo' });
  const fFim = h('input', { type: 'time', class: 'campo' });
  const erros = h('div', { class: 'erros', hidden: true });

  /** Horário do serviço: o do cronômetro ou o digitado. Retorna {inicio, fim} ou null (com erro na tela). */
  function horario() {
    if (avulso) return { inicio: avulso.inicio, fim: avulso.fim };
    const e = [];
    if (!fData.value) e.push('Escolha a data do serviço.');
    if (!fIni.value || !fFim.value) e.push('Informe o início e o término do serviço.');
    else if (U.hmDiff(fIni.value, fFim.value) <= 0) e.push('O término precisa ser depois do início.');
    let r = null;
    if (!e.length) {
      r = { inicio: U.toTs(fData.value, fIni.value), fim: U.toTs(fData.value, fFim.value) };
      if (r.fim > Date.now() + 60000) e.push('O término não pode ser no futuro.');
    }
    mostrarErros(erros, e);
    return e.length ? null : r;
  }

  // obras: a do celular primeiro, depois as que aparecem nas estacas
  const [estacas, obrasLocais, ativo] = await Promise.all([S.listarEstacas(), S.listarObras(), S.getAtivo()]);
  const obras = new Map();
  if (ativo) obras.set(S.chaveObra(ativo.obra), ativo.obra);
  for (const o of [...obrasLocais, ...estacas.map(e => e.obra)]) if (o && o.numero && !obras.has(S.chaveObra(o))) obras.set(S.chaveObra(o), o);
  let obraSel = obras.size ? [...obras.keys()][0] : '';
  let dias = PASSO_DIAS;
  const fObra = h('select', { class: 'campo', 'aria-label': 'Obra' },
    [...obras.entries()].map(([k, o]) => h('option', { value: k }, `${o.numero} – ${o.nome}`)));
  const lista = h('div');

  async function escolher(e) {
    const hr = horario();
    if (!hr) return;
    const ja = e.servicos && e.servicos[tipo] && e.servicos[tipo].inicio;
    const msg = `${S.SERVICOS[tipo]} (${S.fmtServico(hr)}) na estaca ${e.nome}?` +
      (ja ? `\n\nEssa estaca já tem ${S.SERVICOS[tipo].toLowerCase()} (${S.fmtServico(e.servicos[tipo])}). Ele será substituído.` : '');
    if (!(await confirmar(msg, { sim: ja ? 'SUBSTITUIR' : 'CONFIRMAR', nao: 'VOLTAR' }))) return;
    await S.registrarServico(e, tipo, hr);
    if (avulso) await S.limparServicoAvulso();
    toast(`${S.SERVICOS[tipo]} ligado à estaca ${e.nome}`);
    nav.reset('principal');
  }

  function desenhar() {
    const desde = U.addDays(hoje, -(dias - 1));
    const est = estacas.filter(e => S.chaveObra(e.obra) === obraSel && e.data >= desde)
      .sort((a, b) => (b.data + U.timeOf(b.inicio)).localeCompare(a.data + U.timeOf(a.inicio)));
    lista.replaceChildren(
      h('div', { class: 'secao-titulo' }, `Estacas dos últimos ${dias} dias (${est.length})`),
      est.length ? h('div', { class: 'cartoes' }, est.map(e => {
        const c = cartaoEstaca(e, () => escolher(e));
        if (e.servicos && e.servicos[tipo] && e.servicos[tipo].inicio) {
          c.append(h('div', { class: 'l3' }, `✔ Já tem ${S.SERVICOS[tipo].toLowerCase()}: ${S.fmtServico(e.servicos[tipo])}`));
        }
        return c;
      })) : h('div', { class: 'vazio' }, 'Nenhuma estaca desta obra nesse período.'),
      h('button', { class: 'btn btn-cinza btn-medio', style: { marginTop: '10px' }, onclick: () => { dias += PASSO_DIAS; desenhar(); } }, `Mostrar mais ${PASSO_DIAS} dias`));
  }
  fObra.addEventListener('change', () => { obraSel = fObra.value; desenhar(); });
  desenhar();

  const resumo = avulso
    ? h('div', { class: 'conferencia-box dados-compactos' },
      h('div', { class: 'dado largo' }, h('div', { class: 'k' }, 'Serviço'), h('div', { class: 'v' }, S.SERVICOS[tipo])),
      h('div', { class: 'dado' }, h('div', { class: 'k' }, 'Horário'), h('div', { class: 'v' }, S.fmtServico(avulso))),
      h('div', { class: 'dado' }, h('div', { class: 'k' }, 'Tempo'), h('div', { class: 'v' }, U.fmtDur((avulso.fim - avulso.inicio) / 1000))))
    : h('div', null,
      h('div', { class: 'aviso aviso-info' }, S.SERVICOS[tipo]),
      campo('Data do serviço', fData),
      h('div', { class: 'linha-2' }, campo('Início', fIni), campo('Término', fFim)));

  return h('div', null,
    topo('Em qual estaca?'),
    h('div', { class: 'tela' },
      h('div', { class: 'form' },
        resumo,
        erros,
        obras.size > 1 ? campo('Obra', fObra) : null,
        h('div', { class: 'dica' }, 'Toque na estaca em que o serviço foi feito. A mais recente aparece primeiro.'),
        lista)));
});
