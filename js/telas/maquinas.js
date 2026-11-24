// Cadastro de máquinas (só Adm): nome e ativa/desativada.
import { h, nav, registrarTela, topo, toast, mostrarErros, campo, confirmar } from '../ui.js';
import * as A from '../auth.js';
import * as M from '../maquinas.js';

registrarTela('maquinas', async () => {
  if (!A.ehAdm()) { setTimeout(() => nav.back()); return h('div'); }
  const maquinas = await M.listarMaquinas();
  const cartao = m => h('div', {
    class: 'cartao' + (m.ativo ? '' : ' inativo'), role: 'button', tabindex: '0',
    onclick: () => nav.go('maquina', { id: m.id }),
  },
    h('div', { class: 'l1' },
      h('span', { class: 'nome' }, '🚜 ' + m.nome),
      h('span', { class: 'icones' },
        m.sync === 'pendente' ? h('span', { class: 'ic pend', title: 'Pendente de envio', 'aria-label': 'Pendente de envio' }, '⏳') : null)),
    h('div', { class: 'l3' }, m.ativo ? 'Ativa (aparece para escolher)' : 'DESATIVADA (não aparece para escolher)'));

  return h('div', null,
    topo('Máquinas'),
    h('div', { class: 'tela' },
      h('button', { class: 'btn btn-verde btn-medio', style: { marginTop: '14px' }, onclick: () => nav.go('maquina', {}) }, '+ Nova máquina'),
      h('div', { class: 'aviso aviso-info', style: { marginTop: '12px' } },
        'O operador escolhe a máquina tocando no nome, sem digitar. As máquinas vão para a planilha e chegam sozinhas aos outros celulares.'),
      maquinas.length
        ? h('div', { class: 'cartoes' }, maquinas.map(cartao))
        : h('div', { class: 'vazio' }, 'Nenhuma máquina cadastrada ainda.')));
});

registrarTela('maquina', async ({ id }) => {
  if (!A.ehAdm()) { setTimeout(() => nav.back()); return h('div'); }
  const antiga = id ? await M.getMaquina(id) : null;
  let ativo = antiga ? antiga.ativo : true;
  const fNome = h('input', { class: 'campo', value: antiga ? antiga.nome : '', autocapitalize: 'characters', autocomplete: 'off', placeholder: 'Ex.: TM270-1' });
  const erros = h('div', { class: 'erros', hidden: true });
  const fAtivo = h('button', { type: 'button', class: 'btn btn-medio' });
  fAtivo.onclick = () => { ativo = !ativo; marcar(); };
  function marcar() {
    fAtivo.className = 'btn btn-medio ' + (ativo ? 'btn-verde' : 'btn-perigo');
    fAtivo.textContent = ativo ? '✔ Ativa (aparece para escolher)' : '✕ Desativada (não aparece)';
  }
  marcar();

  let salvando = false;
  async function salvar() {
    if (salvando) return;
    const nome = M.nomeMaquina(fNome.value);
    if (antiga && nome !== antiga.nome &&
      !(await confirmar(`Trocar o nome de ${antiga.nome} para ${nome}?\nAs estacas já lançadas continuam com o nome antigo.`, { sim: 'TROCAR', nao: 'VOLTAR' }))) return;
    salvando = true;
    try {
      const r = await M.salvarMaquina({ id: antiga && antiga.id, nome, ativo });
      if (!r.ok) { mostrarErros(erros, [r.msg]); return; }
      toast(antiga ? 'Máquina alterada' : `Máquina ${r.maquina.nome} cadastrada`);
      nav.back();
    } finally { salvando = false; }
  }

  return h('div', null,
    topo(antiga ? antiga.nome : 'Nova máquina'),
    h('div', { class: 'tela' },
      h('div', { class: 'form' },
        campo(['Nome da máquina', h('span', { class: 'obrig' }, ' *')], fNome),
        antiga ? fAtivo : null,
        erros,
        h('button', { class: 'btn btn-verde btn-gigante', onclick: salvar }, 'SALVAR'))));
});
