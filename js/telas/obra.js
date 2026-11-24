// Tela "Dados da obra": cliente, obra, endereço, nº, operador e máquina.
import { h, nav, registrarTela, topo, toast, mostrarErros, campo, editorAjudantes, seletorMaquina } from '../ui.js';
import * as S from '../store.js';
import * as A from '../auth.js';
import * as M from '../maquinas.js';
import { getCfg } from '../db.js';

/** Máquina que já vem marcada: a que este operador escolheu por último ou, se não houver, a máquina do cadastro dele. */
async function maquinaInicial(cfgAtivo, nomes) {
  const s = A.sessao();
  const escolhida = cfgAtivo.maquina;
  if (!nomes.length) return escolhida || ''; // nenhuma máquina cadastrada: campo de texto
  const minha = cfgAtivo.maquinaDe === s.id || (!cfgAtivo.maquinaDe && s.perfil === 'adm');
  if (escolhida && minha && nomes.includes(escolhida)) return escolhida;
  const u = await A.getUsuario(s.id);
  const padrao = u && u.maquinaId ? await M.getMaquina(u.maquinaId) : null;
  if (padrao && padrao.ativo) return padrao.nome;
  return escolhida && nomes.includes(escolhida) ? escolhida : '';
}

registrarTela('obra', async ({ primeira = false, depois = null }) => {
  if (!A.podeOperar()) { setTimeout(() => nav.back()); return h('div'); }
  const ativo = await S.getAtivo();
  // mantém máquina e ajudantes já usados neste celular, mesmo que a obra ainda não esteja definida
  const cfgAtivo = ativo || (await getCfg('ativo')) || {};
  const obras = await S.listarObras();
  const ob = cfgAtivo.obra || {};

  const inp = (valor, extra = {}) => h('input', { class: 'campo', value: valor || '', autocomplete: 'off', ...extra });
  const f = {
    numero: inp(ob.numero, { inputmode: 'text', placeholder: 'Ex.: 260.614' }),
    cliente: inp(ob.cliente, { autocapitalize: 'words' }),
    nome: inp(ob.nome, { autocapitalize: 'words', placeholder: 'Ex.: Galpão SIA' }),
    endereco: inp(ob.endereco),
  };
  const nomesMaq = await M.nomesMaquinas();
  const maq = seletorMaquina(await maquinaInicial(cfgAtivo, nomesMaq), nomesMaq, { obrig: true });
  const ajud = editorAjudantes(cfgAtivo.ajudantes || [], { sugestoes: await A.nomesAjudantes(), operadores: await A.nomesOperadores(A.sessao().nome) });
  const erros = h('div', { class: 'erros', hidden: true });

  // Lista de obras já cadastradas
  const itens = [];
  function marcar(id) { itens.forEach(([b, o]) => b.classList.toggle('sel', o && o.id === id)); }
  const listaObras = obras.length ? h('div', null,
    h('div', { class: 'secao-titulo' }, 'Escolher obra cadastrada'),
    h('div', { class: 'lista-obras' },
      obras.map(o => {
        const b = h('button', { class: 'item-obra', type: 'button' },
          h('b', null, `${o.numero} – ${o.nome}`), h('br'), o.cliente);
        b.onclick = () => {
          f.numero.value = o.numero; f.cliente.value = o.cliente; f.nome.value = o.nome; f.endereco.value = o.endereco || '';
          marcar(o.id); toast('Obra selecionada');
        };
        itens.push([b, o]);
        return b;
      }),
      (() => {
        const b = h('button', { class: 'btn btn-cinza btn-medio', type: 'button' }, '+ Nova obra');
        b.onclick = () => {
          for (const k of ['numero', 'cliente', 'nome', 'endereco']) f[k].value = '';
          marcar(null); f.numero.focus();
        };
        return b;
      })())) : null;
  if (ob.id) setTimeout(() => marcar(ob.id));

  async function salvar() {
    const v = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
    v.maquina = maq.ler();
    const e = [];
    if (!v.numero) e.push('Informe o Nº da obra.');
    if (!v.cliente) e.push('Informe o Cliente.');
    if (!v.nome) e.push('Informe o nome da Obra.');
    if (!v.maquina) e.push(nomesMaq.length ? 'Toque na Máquina.' : 'Informe a Máquina.');
    mostrarErros(erros, e);
    if (e.length) return;
    await S.salvarDadosObra({ ...v, ajudantes: ajud.ler() });
    toast('Dados salvos');
    if (primeira) nav.reset('principal');
    else nav.back(); // volta para a principal ou para a conferência (que mostra os dados novos)
  }

  const ob1 = h('span', { class: 'obrig' }, ' *');
  return h('div', null,
    topo('Dados da obra', { voltar: !primeira }),
    h('div', { class: 'tela' },
      primeira ? h('div', { class: 'aviso aviso-info', style: { marginTop: '14px' } },
        `Bem-vindo, ${A.sessao().nome}! Preencha os dados da obra, da máquina e dos ajudantes. Eles ficam salvos no celular.`) : null,
      depois === 'conferencia' ? h('div', { class: 'aviso aviso-info', style: { marginTop: '14px' } },
        'Corrija o que mudou e toque em SALVAR. Depois você confere e inicia a estaca.') : null,
      listaObras,
      h('div', { class: 'form' },
        h('div', { class: 'secao-titulo', style: { margin: '4px 0 0' } }, 'Obra'),
        campo(['Nº da obra', ob1.cloneNode(true)], f.numero),
        campo(['Cliente', ob1.cloneNode(true)], f.cliente),
        campo(['Obra', ob1.cloneNode(true)], f.nome),
        campo('Endereço', f.endereco),
        h('div', { class: 'secao-titulo', style: { margin: '8px 0 0' } }, 'Equipe'),
        h('div', { class: 'dado' }, h('div', { class: 'k' }, 'Operador'), h('div', { class: 'v' }, A.sessao().nome)),
        maq.el,
        ajud.el,
        erros,
        h('button', { class: 'btn btn-verde btn-gigante', onclick: salvar }, 'SALVAR'),
        primeira ? h('button', {
          class: 'link-discreto', type: 'button',
          onclick: async () => { await A.sair(); nav.reset('login'); },
        }, `Não é ${A.sessao().nome}? Sair`) : null)));
});
