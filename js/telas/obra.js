// Tela "Dados da obra": cliente, obra, endereço, nº, operador e máquina.
import { h, nav, registrarTela, topo, toast, mostrarErros, campo, editorAjudantes } from '../ui.js';
import * as S from '../store.js';

registrarTela('obra', async ({ primeira = false, depois = null }) => {
  const ativo = await S.getAtivo();
  const cfgAtivo = ativo || {};
  const obras = await S.listarObras();
  const ob = cfgAtivo.obra || {};

  const inp = (valor, extra = {}) => h('input', { class: 'campo', value: valor || '', autocomplete: 'off', ...extra });
  const f = {
    numero: inp(ob.numero, { inputmode: 'text', placeholder: 'Ex.: 260.614' }),
    cliente: inp(ob.cliente, { autocapitalize: 'words' }),
    nome: inp(ob.nome, { autocapitalize: 'words', placeholder: 'Ex.: Galpão SIA' }),
    endereco: inp(ob.endereco),
    operador: inp(cfgAtivo.operador, { autocapitalize: 'words' }),
    maquina: inp(cfgAtivo.maquina, { autocapitalize: 'characters' }),
  };
  const ajud = editorAjudantes(cfgAtivo.ajudantes || []);
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
    const e = [];
    if (!v.numero) e.push('Informe o Nº da obra.');
    if (!v.cliente) e.push('Informe o Cliente.');
    if (!v.nome) e.push('Informe o nome da Obra.');
    if (!v.operador) e.push('Informe o nome do Operador.');
    if (!v.maquina) e.push('Informe a Máquina.');
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
        'Bem-vindo! Preencha os dados da obra, do operador e da máquina. Eles ficam salvos no celular.') : null,
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
        campo(['Operador (nome)', ob1.cloneNode(true)], f.operador),
        ajud.el,
        campo(['Máquina (nome/identificação)', ob1.cloneNode(true)], f.maquina),
        erros,
        h('button', { class: 'btn btn-verde btn-gigante', onclick: salvar }, 'SALVAR'))));
});
