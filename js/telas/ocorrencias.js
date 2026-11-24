// Ocorrências do dia (diário de obra): lista do dia e formulário rápido.
import { h, nav, registrarTela, topo, toast, mostrarErros, campo, confirmar, pedirSenha, editorAjudantes } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { cartaoOcorrencia } from './cartoes.js';
import * as A from '../auth.js';

registrarTela('ocorrencias', async () => {
  const hoje = U.today();
  // Operador vê as dele; Adm vê as de todos
  const lista = (await S.listarOcorrencias()).filter(o => o.data === hoje && (A.ehAdm() || S.ehMeu(o)));
  const parado = lista.reduce((s, o) => s + S.tempoParado(o), 0);
  return h('div', null,
    topo('Ocorrências do dia'),
    h('div', { class: 'tela' },
      h('div', { class: 'secao-titulo' }, `${U.fmtDate(hoje)} (${U.weekday(hoje)})`),
      h('button', { class: 'btn btn-escuro btn-gigante', style: { minHeight: '90px' }, onclick: () => nav.go('ocorrencia', {}) }, '+ Nova ocorrência'),
      lista.length && parado ? h('div', { class: 'aviso aviso-info', style: { marginTop: '12px' } }, `Tempo parado hoje: ${U.fmtHM(parado)}`) : null,
      lista.length
        ? h('div', { class: 'cartoes' }, lista.map(o => cartaoOcorrencia(o, () => nav.go('ocorrencia', { id: o.id }))))
        : h('div', { class: 'vazio' }, 'Nenhuma ocorrência registrada hoje.')));
});

registrarTela('ocorrencia', async ({ id }) => {
  const ativo = await S.getAtivo();
  let antigo = null;
  if (id) {
    antigo = await S.getOcorrencia(id);
    if (!antigo || antigo.excluido) { setTimeout(() => nav.back()); return h('div'); }
  }
  if (!antigo && !ativo) { setTimeout(() => nav.back()); return h('div'); }
  const somenteLeitura = !!antigo && !S.podeEditar(antigo);
  const travada = antigo && !somenteLeitura && S.travado(antigo);
  const desbloqueada = antigo && !somenteLeitura && S.bloqueado(antigo) && !travada;
  const dis = !!travada || somenteLeitura;
  const hoje = U.today();
  const base = antigo || { data: hoje, obra: ativo.obra, operador: ativo.operador, operadorId: ativo.operadorId, ajudantes: ativo.ajudantes, maquina: ativo.maquina };

  let tipo = base.tipo || null;
  let resp = base.responsabilidade || null;

  // ---- escolha da ocorrência (toque) ----
  const botoes = [];
  const fOutros = h('input', { class: 'campo', value: base.outros || '', lang: 'pt-BR', autocapitalize: 'sentences', placeholder: 'O que aconteceu? (pode ditar)', disabled: dis, maxlength: '120' });
  const boxOutros = campo(['Descreva a ocorrência', h('span', { class: 'obrig' }, ' *')], fOutros);
  const marcar = () => {
    botoes.forEach(([b, t]) => b.classList.toggle('sel', t === tipo));
    boxOutros.hidden = !S.ehOutros(tipo);
  };
  const grupo = (r, classe, titulo) => h('div', { class: 'grupo-oc ' + classe },
    h('h3', null, titulo),
    h('div', { class: 'grade-oc' }, S.OCORRENCIAS[r].map(t => {
      const b = h('button', { type: 'button', disabled: dis }, t);
      b.onclick = () => { tipo = t; resp = r; marcar(); if (S.ehOutros(t)) fOutros.focus(); };
      botoes.push([b, t]);
      return b;
    })));

  // ---- demais campos ----
  const fData = h('input', { type: 'date', class: 'campo', value: base.data, max: hoje, min: desbloqueada ? null : U.addDays(hoje, -S.PRAZO_DIAS), disabled: dis });
  const fIni = h('input', { type: 'time', class: 'campo', value: base.inicio || '', disabled: dis });
  const fFim = h('input', { type: 'time', class: 'campo', value: base.fim || '', disabled: dis });
  const parado = h('div', { class: 'v' }, '—');
  const atualizarParado = () => {
    const d = U.hmDiff(fIni.value, fFim.value);
    parado.textContent = d == null ? '—' : d <= 0 ? 'Término deve ser depois do início' : U.fmtHM(d);
  };
  [fIni, fFim].forEach(x => x.addEventListener('input', atualizarParado));
  atualizarParado();
  const agora = inp => h('button', { type: 'button', class: 'btn btn-cinza', disabled: dis, onclick: () => { inp.value = U.timeOf(Date.now()); atualizarParado(); } }, 'Agora');
  const fCompl = h('input', { class: 'campo', value: base.complemento || '', lang: 'pt-BR', autocapitalize: 'sentences', placeholder: 'Opcional. Ex.: troca da mangueira', disabled: dis, maxlength: '120' });
  const obras = await S.listarObras();
  const fObra = h('select', { class: 'campo', disabled: dis },
    obras.map(o => h('option', { value: o.id, selected: o.id === base.obra.id ? 'selected' : null }, `${o.numero} – ${o.nome}`)));
  if (!obras.some(o => o.id === base.obra.id)) fObra.prepend(h('option', { value: base.obra.id, selected: 'selected' }, S.rotuloObra(base.obra)));
  const fOper = h('input', { class: 'campo', value: base.operador, disabled: dis || !A.ehAdm() }); // só o Adm troca o operador
  const fMaq = h('input', { class: 'campo', value: base.maquina, disabled: dis });
  const ajud = editorAjudantes(base.ajudantes || [], { disabled: dis, sugestoes: dis ? [] : await A.nomesAjudantes() });
  const erros = h('div', { class: 'erros', hidden: true });

  let salvando = false;
  async function salvar(outra) {
    if (salvando) return;
    const e = [];
    if (!tipo) e.push('Toque na ocorrência.');
    if (S.ehOutros(tipo) && !fOutros.value.trim()) e.push('Descreva o que aconteceu em "Outros".');
    const data = fData.value;
    if (!data) e.push('Escolha a data.');
    else if (data > hoje) e.push('Não é permitido data futura.');
    else if (!desbloqueada && U.diffDays(data, hoje) > S.PRAZO_DIAS) e.push(`A data não pode ter mais de ${S.PRAZO_DIAS} dias.`);
    if (fIni.value && fFim.value && U.hmDiff(fIni.value, fFim.value) <= 0) e.push('O término precisa ser depois do início.');
    if (!fOper.value.trim() || !fMaq.value.trim()) e.push('Informe operador e máquina.');
    mostrarErros(erros, e);
    if (e.length) return;
    salvando = true;
    try {
      const obra = (await S.getObra(fObra.value)) || base.obra;
      const novo = {
        ...(antigo || {}), tipo, responsabilidade: resp, outros: S.ehOutros(tipo) ? fOutros.value.trim() : '',
        data, inicio: fIni.value, fim: fFim.value, complemento: fCompl.value.trim(),
        obra, operador: fOper.value.trim(), operadorId: base.operadorId, ajudantes: ajud.ler(), maquina: fMaq.value.trim(),
      };
      if (!novo.operadorId || novo.operador !== base.operador) delete novo.operadorId; // vale o nome
      await S.salvarOcorrencia(novo, antigo);
      toast('Ocorrência salva');
      if (outra) nav.go('ocorrencia', {}, { replace: true });
      else nav.back();
    } finally { salvando = false; }
  }
  async function excluir() {
    if (await confirmar(`Excluir a ocorrência "${S.nomeOcorrencia(antigo)}"?`, { sim: 'EXCLUIR', nao: 'VOLTAR', classeSim: 'btn-vermelho' })) {
      await S.excluirOcorrencia(antigo); toast('Ocorrência excluída'); nav.back();
    }
  }
  async function desbloquear() {
    if (await pedirSenha(S.senhaOk, 'Desbloquear ocorrência – senha de um Adm')) { S.desbloqueados.add(antigo.id); nav.refresh(); }
  }

  const acoes = somenteLeitura ? []
    : travada
    ? [h('button', { class: 'btn btn-escuro btn-medio', onclick: desbloquear }, '🔓 Desbloquear (Adm)')]
    : antigo
      ? [h('button', { class: 'btn btn-verde btn-gigante', onclick: () => salvar(false) }, 'SALVAR'),
        h('button', { class: 'btn btn-perigo btn-medio', onclick: excluir }, '🗑 Excluir ocorrência')]
      : [h('button', { class: 'btn btn-verde btn-gigante', onclick: () => salvar(false) }, 'SALVAR'),
        h('button', { class: 'btn btn-escuro btn-medio', onclick: () => salvar(true) }, 'SALVAR E LANÇAR OUTRA')];

  const el = h('div', null,
    topo(antigo ? 'Ocorrência' : 'Nova ocorrência'),
    h('div', { class: 'tela' },
      h('div', { class: 'form' },
        somenteLeitura ? h('div', { class: 'aviso aviso-info' }, `👁 Ocorrência de ${antigo.operador}: somente consulta`) : null,
        travada ? h('div', { class: 'aviso aviso-bloqueio' }, '🔒 Ocorrência bloqueada para edição (mais de 3 dias)') : null,
        desbloqueada ? h('div', { class: 'aviso aviso-info' }, A.ehAdm() ? '🔓 Mais de 3 dias (Adm pode alterar)' : '🔓 Desbloqueada pelo Adm') : null,
        h('span', { class: 'rotulo' }, 'Toque na ocorrência', h('span', { class: 'obrig' }, ' *')),
        grupo('Obra', 'obra', 'Por parte da obra'),
        grupo('Fundex', 'fundex', 'Por parte da Fundex'),
        boxOutros,
        campo('Data', fData),
        campo('Hora de início (opcional)', h('div', { class: 'hora-agora' }, fIni, agora(fIni))),
        campo('Hora de término (opcional)', h('div', { class: 'hora-agora' }, fFim, agora(fFim))),
        h('div', { class: 'dado' }, h('div', { class: 'k' }, 'Tempo parado'), parado),
        campo('Complemento', fCompl),
        campo('Obra', fObra),
        h('div', { class: 'linha-2' }, campo('Operador', fOper), campo('Máquina', fMaq)),
        ajud.el,
        erros,
        acoes)));
  marcar();
  return el;
});
