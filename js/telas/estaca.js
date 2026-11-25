// Formulário da estaca: finalizar (cronômetro), lançar manual e editar.
import { h, nav, registrarTela, topo, toast, mostrarErros, campo, confirmar, pedirSenha, editorAjudantes, seletorMaquina } from '../ui.js';
import * as M from '../maquinas.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { getCfg } from '../db.js';
import * as A from '../auth.js';

const TITULOS = { cronometro: 'Dados da estaca', manual: 'Lançar estaca manual', editar: 'Estaca' };

/** Grade de diâmetros com "Outro". */
export function seletorDiametro(inicial, desabilitado) {
  let valor = inicial || null;
  let outroAtivo = valor != null && !S.DIAMETROS.includes(valor);
  const outroInput = h('input', { class: 'campo', inputmode: 'numeric', pattern: '[0-9]*', placeholder: '30 a 150', value: outroAtivo ? String(valor) : '', disabled: desabilitado });
  const outroBox = h('div', { class: 'campo-unidade', hidden: !outroAtivo }, outroInput, h('span', { class: 'unidade' }, 'cm'));
  const botoes = [];
  const marcar = () => botoes.forEach(([b, d]) => b.classList.toggle('sel', d === 'outro' ? outroAtivo : (!outroAtivo && d === valor)));
  for (const d of [...S.DIAMETROS, 'outro']) {
    const b = h('button', { type: 'button', class: d === 'outro' ? 'outro' : '', disabled: desabilitado }, d === 'outro' ? 'Outro' : String(d));
    b.onclick = () => {
      if (d === 'outro') { outroAtivo = true; outroBox.hidden = false; outroInput.focus(); }
      else { outroAtivo = false; outroBox.hidden = true; valor = d; }
      marcar();
    };
    botoes.push([b, d]);
  }
  marcar();
  return {
    el: h('div', null, h('div', { class: 'grade-diam' }, botoes.map(b => b[0])), h('div', { style: { marginTop: '8px' } }, outroBox)),
    /** Retorna número válido ou uma mensagem de erro (string). */
    ler() {
      if (outroAtivo) {
        const n = U.parseNum(outroInput.value);
        if (!Number.isFinite(n)) return 'Digite o diâmetro em "Outro".';
        if (n < 30 || n > 150) return 'O diâmetro deve ficar entre 30 e 150 cm.';
        return Math.round(n);
      }
      return valor == null ? 'Escolha o diâmetro.' : valor;
    },
  };
}

export const numParaCampo = n => (n == null || n === '' ? '' : String(n).replace('.', ','));

/**
 * Serviços adicionais da estaca (alargamento de base e colocação de armadura): data, início e término de cada um.
 * Tudo em branco = serviço não feito. Se o horário não mudou, mantém o horário exato do cronômetro.
 */
function editorServicos(inicial = {}, { disabled = false, dataPadrao = U.today() } = {}) {
  const linhas = S.TIPOS_SERVICO.map(tipo => {
    const s = inicial[tipo];
    const fD = h('input', { type: 'date', class: 'campo', value: s && s.inicio ? U.dateOf(s.inicio) : '', max: U.today(), disabled });
    const fI = h('input', { type: 'time', class: 'campo', value: s && s.inicio ? U.timeOf(s.inicio) : '', disabled });
    const fF = h('input', { type: 'time', class: 'campo', value: s && s.fim ? U.timeOf(s.fim) : '', disabled });
    const tempo = h('div', { class: 'v' }, '—');
    const att = () => { const d = U.hmDiff(fI.value, fF.value); tempo.textContent = d == null ? '—' : d <= 0 ? 'Término deve ser depois do início' : U.fmtDur(d); };
    [fI, fF].forEach(x => x.addEventListener('input', () => { if (!fD.value && (fI.value || fF.value)) fD.value = dataPadrao; att(); }));
    att();
    const limpar = disabled ? null : h('button', { type: 'button', class: 'link-discreto', onclick: () => { fD.value = ''; fI.value = ''; fF.value = ''; att(); } }, 'Não foi feito (limpar)');
    const el = h('div', { class: 'conferencia-box', style: { marginTop: '8px' } },
      h('b', null, S.SERVICOS[tipo]),
      campo('Data', fD),
      h('div', { class: 'linha-2' }, campo('Início', fI), campo('Término', fF)),
      h('div', { class: 'dado' }, h('div', { class: 'k' }, 'Tempo'), tempo),
      disabled && !(s && s.inicio) ? h('div', { class: 'v' }, 'Não feito') : limpar);
    const ler = () => {
      if (!fD.value && !fI.value && !fF.value) return { tipo, s: null };
      if (!fD.value || !fI.value || !fF.value) return { tipo, erro: `${S.SERVICOS[tipo]}: preencha data, início e término (ou toque em "limpar").` };
      if (U.hmDiff(fI.value, fF.value) <= 0) return { tipo, erro: `${S.SERVICOS[tipo]}: o término precisa ser depois do início.` };
      let ini = U.toTs(fD.value, fI.value), fim = U.toTs(fD.value, fF.value);
      if (s && s.inicio && U.dateOf(s.inicio) === fD.value && U.timeOf(s.inicio) === fI.value) ini = s.inicio;
      if (s && s.fim && U.dateOf(s.fim) === fD.value && U.timeOf(s.fim) === fF.value) fim = s.fim;
      if (fim > Date.now() + 60000) return { tipo, erro: `${S.SERVICOS[tipo]}: o término não pode ser no futuro.` };
      return { tipo, s: { inicio: ini, fim, operador: (s && s.operador) || (A.sessao() ? A.sessao().nome : '') } };
    };
    return { el, ler };
  });
  return {
    el: h('div', { class: 'grupo' }, h('span', { class: 'rotulo' }, 'Serviços adicionais'),
      h('div', { class: 'dica' }, 'Preencha só se o serviço foi feito nesta estaca.'), linhas.map(l => l.el)),
    /** Retorna {servicos} ou {erros: [...]} */
    ler() {
      const r = linhas.map(l => l.ler());
      const erros = r.filter(x => x.erro).map(x => x.erro);
      if (erros.length) return { erros };
      const servicos = {};
      for (const x of r) if (x.s) servicos[x.tipo] = x.s;
      return { servicos };
    },
  };
}

registrarTela('estaca', async ({ modo = 'manual', id }) => {
  const ativo = await S.getAtivo();
  let crono = null, antigo = null;
  if (modo === 'cronometro') {
    crono = await S.getCrono();
    if (!crono || !crono.fim) { setTimeout(() => nav.reset('principal')); return h('div'); }
  }
  if (modo === 'editar') {
    antigo = await S.getEstaca(id);
    if (!antigo || antigo.excluido) { setTimeout(() => nav.back()); return h('div'); }
  }
  if (modo !== 'editar' && !ativo) { setTimeout(() => nav.reset('principal')); return h('div'); }
  const somenteLeitura = modo === 'editar' && !S.podeEditar(antigo); // estaca de outro operador (ou Ajudante)
  const travada = modo === 'editar' && !somenteLeitura && S.travado(antigo);
  const desbloqueada = modo === 'editar' && S.bloqueado(antigo) && !travada && !somenteLeitura;
  const dis = travada || somenteLeitura;
  const hoje = U.today();
  const base = antigo || {};
  const ctx = crono ? (crono.ativo || ativo) : ativo; // dados ativos no início da estaca

  // ---- campos ----
  const fNome = h('input', { class: 'campo', value: base.nome || '', autocapitalize: 'characters', autocomplete: 'off', placeholder: 'Ex.: E-12, P5-A', disabled: dis });
  const diam = seletorDiametro(base.diametro ?? (await getCfg('ultimoDiametro')), dis);
  const fProf = h('input', { class: 'campo', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Ex.: 12,50', value: numParaCampo(base.profundidade), disabled: dis });
  const fObs = h('textarea', { class: 'campo', lang: 'pt-BR', autocapitalize: 'sentences', placeholder: 'Opcional. Ex.: presença de água a 8 m. Toque no microfone do teclado para ditar.', disabled: dis }, base.observacao || '');
  const erros = h('div', { class: 'erros', hidden: true });

  // data/hora (manual e editar)
  const minData = desbloqueada ? null : U.addDays(hoje, -S.PRAZO_DIAS);
  const fData = h('input', { type: 'date', class: 'campo', value: base.data || hoje, max: hoje, min: minData, disabled: dis });
  const fIni = h('input', { type: 'time', class: 'campo', value: base.inicio ? U.timeOf(base.inicio) : '', disabled: dis });
  const fFim = h('input', { type: 'time', class: 'campo', value: base.fim ? U.timeOf(base.fim) : '', disabled: dis });
  const duracaoTxt = h('div', { class: 'v' }, '—');
  const atualizarDuracao = () => {
    const d = U.hmDiff(fIni.value, fFim.value);
    duracaoTxt.textContent = d == null ? '—' : d <= 0 ? 'Término deve ser depois do início' : U.fmtDur(d);
  };
  [fIni, fFim].forEach(x => x.addEventListener('input', atualizarDuracao));
  atualizarDuracao();

  // obra (manual e editar)
  const obras = await S.listarObras();
  const obraInicial = (antigo ? antigo.obra.id : ativo && ativo.obra.id);
  const fObra = h('select', { class: 'campo', disabled: dis },
    obras.map(o => h('option', { value: o.id, selected: o.id === obraInicial ? 'selected' : null }, `${o.numero} – ${o.nome}`)));
  if (antigo && !obras.some(o => o.id === antigo.obra.id)) {
    fObra.prepend(h('option', { value: antigo.obra.id, selected: 'selected' }, S.rotuloObra(antigo.obra)));
  }
  // só o Adm troca o operador de uma estaca
  const fOper = h('input', { class: 'campo', value: base.operador || '', disabled: dis || !A.ehAdm() });
  const maq = seletorMaquina(base.maquina || '', dis ? [] : await M.nomesMaquinas(), { disabled: dis });
  const ajud = editorAjudantes(base.ajudantes || [], { disabled: dis, sugestoes: dis ? [] : await A.nomesAjudantes(), operadores: dis ? [] : await A.nomesOperadores(base.operador) });

  // serviços: da estaca (editar), do cronômetro (feitos na sequência da perfuração) ou nenhum (manual)
  const servIniciais = modo === 'cronometro' ? (crono.servicos || {}) : (base.servicos || {});
  const serv = editorServicos(servIniciais, { disabled: dis, dataPadrao: base.data || (crono ? U.dateOf(crono.inicio) : hoje) });

  const dado = (k, v, largo) => h('div', { class: 'dado' + (largo ? ' largo' : '') }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v || '—'));

  // ---- salvar ----
  let salvando = false;
  async function salvar() {
    if (salvando) return;
    const e = [];
    const nome = fNome.value.trim();
    if (!nome) e.push('Informe o nome/identificação da estaca.');
    const d = diam.ler();
    if (typeof d === 'string') e.push(d);
    const prof = U.parseNum(fProf.value);
    if (!fProf.value.trim()) e.push('Informe a profundidade.');
    else if (!Number.isFinite(prof) || prof <= 0 || prof > 150) e.push('Profundidade inválida (use vírgula, ex.: 12,50).');

    let inicio, fim, data;
    if (modo === 'cronometro') { inicio = crono.inicio; fim = crono.fim; }
    else {
      data = fData.value;
      if (!data) e.push('Escolha a data.');
      else if (data > hoje) e.push('Não é permitido data futura.');
      else if (!desbloqueada && U.diffDays(data, hoje) > S.PRAZO_DIAS) e.push(`A data não pode ter mais de ${S.PRAZO_DIAS} dias.`);
      if (!fIni.value || !fFim.value) e.push('Informe a hora de início e de término.');
      else if (U.hmDiff(fIni.value, fFim.value) <= 0) e.push('A hora de término precisa ser depois da hora de início.');
      if (data && fIni.value && fFim.value) { inicio = U.toTs(data, fIni.value); fim = U.toTs(data, fFim.value); }
      if (inicio && fim > Date.now() + 60000) e.push('O término não pode ser no futuro.');
    }
    if (modo === 'editar' && (!fOper.value.trim() || !maq.ler())) e.push('Informe operador e máquina.');
    const sv = serv.ler();
    if (sv.erros) e.push(...sv.erros);
    mostrarErros(erros, e);
    if (e.length) return;

    salvando = true;
    try {
      const obraSel = modo === 'cronometro' ? ctx.obra : (await S.getObra(fObra.value)) || (antigo && antigo.obra);
      const dados = { nome, diametro: d, profundidade: Math.round(prof * 100) / 100, observacao: fObs.value.trim(), inicio, fim, obra: obraSel, servicos: sv.servicos };

      if (modo === 'cronometro') {
        await S.criarEstaca({ ...dados, operador: ctx.operador, operadorId: ctx.operadorId || A.sessao().id, ajudantes: ctx.ajudantes || [], maquina: ctx.maquina, manual: false });
        await S.limparCrono();
        toast(`Estaca ${nome} salva`);
        nav.reset('principal');
      } else if (modo === 'manual') {
        const conflito = await S.sobreposicao({ id: null, inicio, fim, maquina: ativo.maquina });
        if (conflito && !(await confirmar(`Já existe a estaca ${conflito.nome} nesse horário. Salvar mesmo assim?`, { sim: 'SALVAR', nao: 'VOLTAR' }))) return;
        await S.criarEstaca({ ...dados, operador: ativo.operador, operadorId: ativo.operadorId, ajudantes: ativo.ajudantes || [], maquina: ativo.maquina, manual: true });
        toast(`Estaca ${nome} lançada`);
        nav.back();
      } else {
        const novo = { ...antigo, ...dados, operador: fOper.value.trim(), ajudantes: ajud.ler(), maquina: maq.ler() };
        if (novo.operador !== antigo.operador) delete novo.operadorId; // Adm trocou o operador: passa a valer o nome
        await S.editarEstaca(antigo, novo);
        toast('Alterações salvas');
        nav.back();
      }
    } finally { salvando = false; }
  }

  async function excluir() {
    if (await confirmar(`Excluir a estaca ${antigo.nome}?\nEla sai da lista e da produção.`, { sim: 'EXCLUIR', nao: 'VOLTAR', classeSim: 'btn-vermelho' })) {
      await S.excluirEstaca(antigo);
      toast('Estaca excluída');
      nav.back();
    }
  }

  async function desbloquear() {
    if (await pedirSenha(S.senhaOk, 'Desbloquear estaca – senha de um Adm')) { S.desbloqueados.add(antigo.id); toast('Estaca desbloqueada'); nav.refresh(); }
  }

  // ---- montagem ----
  const ob = h('span', { class: 'obrig' }, ' *');
  const blocoTopo = [];
  if (modo === 'cronometro') {
    blocoTopo.push(h('div', { class: 'conferencia-box dados-compactos' },
      dado('Obra', `${ctx.obra.numero} – ${ctx.obra.nome}`, true),
      dado('Máquina', ctx.maquina), dado('Operador', ctx.operador),
      (ctx.ajudantes || []).length ? dado('Ajudante(s)', S.fmtAjudantes(ctx.ajudantes), true) : null,
      dado('Data', U.fmtDate(U.dateOf(crono.inicio))), dado('Duração', U.fmtDur((crono.fim - crono.inicio) / 1000)),
      dado('Início', U.timeOf(crono.inicio, true)), dado('Término', U.timeOf(crono.fim, true))));
  }
  if (somenteLeitura) {
    blocoTopo.push(h('div', { class: 'aviso aviso-info' }, `👁 Estaca de ${antigo.operador}: somente consulta`));
  } else if (travada) {
    blocoTopo.push(h('div', { class: 'aviso aviso-bloqueio' }, '🔒 Estaca bloqueada para edição (mais de 3 dias)'));
  } else if (desbloqueada) {
    blocoTopo.push(h('div', { class: 'aviso aviso-info' }, A.ehAdm() ? '🔓 Estaca com mais de 3 dias (Adm pode alterar)' : '🔓 Estaca desbloqueada pelo Adm'));
  }
  if (modo === 'editar' && antigo.manual) blocoTopo.push(h('div', { class: 'aviso aviso-info' }, 'Lançamento manual (tempo não cronometrado)'));

  const camposDataHora = modo !== 'cronometro' ? [
    campo(['Data', ob.cloneNode(true)], fData),
    h('div', { class: 'linha-2' }, campo(['Início', ob.cloneNode(true)], fIni), campo(['Término', ob.cloneNode(true)], fFim)),
    h('div', { class: 'dado' }, h('div', { class: 'k' }, 'Duração (calculada)'), duracaoTxt),
  ] : [];

  const camposEquipe = modo === 'manual' ? [
    campo('Obra', fObra),
    h('div', { class: 'conferencia-box dados-compactos' }, dado('Operador', ativo.operador), dado('Máquina', ativo.maquina),
      ativo.ajudantes.length ? dado('Ajudante(s)', S.fmtAjudantes(ativo.ajudantes), true) : null),
  ] : modo === 'editar' ? [campo('Obra', fObra), campo('Operador', fOper), maq.el, ajud.el] : [];

  const botoes = [];
  if (somenteLeitura) { /* sem botões */ }
  else if (travada) botoes.push(h('button', { class: 'btn btn-escuro btn-medio', onclick: desbloquear }, '🔓 Desbloquear (Adm)'));
  else {
    botoes.push(h('button', { class: 'btn btn-verde btn-gigante', onclick: salvar }, 'SALVAR'));
    if (modo === 'editar') botoes.push(h('button', { class: 'btn btn-perigo btn-medio', onclick: excluir }, '🗑 Excluir estaca'));
  }

  return h('div', null,
    topo(modo === 'editar' ? `Estaca ${antigo.nome}` : TITULOS[modo]),
    h('div', { class: 'tela' },
      h('div', { class: 'form' },
        blocoTopo,
        campo(['Nome/identificação da estaca', ob.cloneNode(true)], fNome),
        h('div', { class: 'grupo' }, h('span', { class: 'rotulo' }, 'Diâmetro (cm)', ob.cloneNode(true)), diam.el),
        campo(['Profundidade (m)', ob.cloneNode(true)], h('div', { class: 'campo-unidade' }, fProf, h('span', { class: 'unidade' }, 'm'))),
        camposDataHora,
        campo('Observação da estaca', fObs),
        camposEquipe,
        serv.el,
        erros,
        botoes)));
});
