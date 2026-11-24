// Componentes de interface: criação de elementos, navegação, janelas de confirmação e avisos.

/** Cria um elemento: h('div', {class:'x', onclick}, 'texto', filho...) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'readOnly') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

/* ---------------- Navegação (com botão Voltar do celular) ---------------- */
const telas = {};
const pilha = [];
let aoSair = null;
let renderId = 0;

export function registrarTela(nome, fn) { telas[nome] = fn; }
/** Função chamada quando o usuário sai da tela atual (ex.: parar timers). */
export function onLeave(fn) { aoSair = fn; }

async function desenhar() {
  const id = ++renderId;
  if (aoSair) { try { aoSair(); } catch (e) { console.error(e); } aoSair = null; }
  const atual = pilha[pilha.length - 1];
  const el = await telas[atual.nome](atual.params || {});
  if (id !== renderId) return;
  const app = document.getElementById('app');
  app.replaceChildren(el);
  window.scrollTo(0, 0);
}

export const nav = {
  /** Abre uma tela. replace=true troca a tela atual (não cria "voltar"). */
  go(nome, params = {}, { replace = false } = {}) {
    if (replace && pilha.length) pilha.pop();
    else if (pilha.length) history.pushState({ d: pilha.length + 1 }, '');
    pilha.push({ nome, params });
    return desenhar();
  },
  /** Limpa a pilha e abre a tela indicada como a primeira. */
  reset(nome, params = {}) {
    const extra = pilha.length - 1;
    pilha.length = 0;
    pilha.push({ nome, params });
    if (extra > 0) { ignorarPop = extra; history.go(-extra); }
    return desenhar();
  },
  back() { if (pilha.length > 1) history.back(); },
  refresh() { return desenhar(); },
  atual() { return pilha[pilha.length - 1]; },
};
let ignorarPop = 0;
window.addEventListener('popstate', e => {
  if (ignorarPop > 0) { ignorarPop = 0; return; }
  if (fecharModalAberto()) { history.pushState({ d: pilha.length }, ''); return; }
  const d = (e.state && e.state.d) || 1;
  if (pilha.length > 1 && d < pilha.length) {
    pilha.length = Math.max(1, d);
    desenhar();
  }
});
history.replaceState({ d: 1 }, '');

/* ---------------- Cabeçalho das telas internas ---------------- */
export function topo(titulo, { voltar = true, direita = null } = {}) {
  return h('header', { class: 'topo' },
    voltar ? h('button', { class: 'btn-voltar', onclick: () => nav.back(), 'aria-label': 'Voltar' }, '◀ Voltar') : h('span'),
    h('h1', null, titulo),
    direita || h('span'));
}

/* ---------------- Janelas (modal) ---------------- */
let modalAtual = null;
function fecharModalAberto() {
  if (modalAtual) { modalAtual(null); return true; }
  return false;
}

/**
 * Abre uma janela. botoes: [{texto, classe, valor}]. Retorna o valor do botão tocado (null se fechar).
 * corpo pode ser texto ou elemento. antesDeFechar(valor) pode retornar false para manter aberta.
 */
export function modal({ titulo, corpo, botoes, antesDeFechar }) {
  return new Promise(res => {
    const fundo = h('div', { class: 'modal-fundo' });
    const fechar = v => {
      modalAtual = null; fundo.remove(); res(v);
    };
    const caixa = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      titulo ? h('h2', null, titulo) : null,
      typeof corpo === 'string' ? h('p', { class: 'modal-texto' }, corpo) : corpo,
      h('div', { class: 'modal-botoes' + (botoes.length > 2 ? ' coluna' : '') }, botoes.map(b =>
        h('button', {
          class: `btn ${b.classe || 'btn-cinza'}`,
          onclick: async () => {
            if (antesDeFechar && (await antesDeFechar(b.valor)) === false) return;
            fechar(b.valor);
          },
        }, b.texto))));
    fundo.append(caixa);
    document.body.append(fundo);
    modalAtual = fechar;
    const foco = caixa.querySelector('input, textarea');
    if (foco) setTimeout(() => foco.focus(), 50);
  });
}

export async function confirmar(msg, { titulo, sim = 'SIM', nao = 'NÃO', classeSim = 'btn-verde' } = {}) {
  const v = await modal({ titulo, corpo: msg, botoes: [{ texto: nao, valor: false }, { texto: sim, classe: classeSim, valor: true }] });
  return v === true;
}
export function avisar(msg, titulo) {
  return modal({ titulo, corpo: msg, botoes: [{ texto: 'OK', classe: 'btn-escuro', valor: true }] });
}

/** Pede a senha de configuração. Retorna true se correta. */
export async function pedirSenha(senhaOk, titulo = 'Senha do escritório') {
  const input = h('input', { type: 'password', class: 'campo', autocomplete: 'off', 'aria-label': 'Senha' });
  const erro = h('p', { class: 'erro-texto', hidden: true }, 'Senha incorreta.');
  let ok = false;
  await modal({
    titulo,
    corpo: h('div', null, input, erro),
    botoes: [{ texto: 'CANCELAR', valor: false }, { texto: 'ENTRAR', classe: 'btn-escuro', valor: true }],
    antesDeFechar: async v => {
      if (!v) return true;
      ok = await senhaOk(input.value);
      if (!ok) { erro.hidden = false; input.select(); return false; }
      return true;
    },
  });
  return ok;
}

let toastTimer;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/** Mostra mensagens de erro de validação numa caixa. */
export function mostrarErros(caixa, erros) {
  caixa.replaceChildren(...erros.map(e => h('div', null, '⚠ ' + e)));
  caixa.hidden = erros.length === 0;
  if (erros.length) caixa.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Lista de ajudantes: um campo por ajudante, com "+ Adicionar ajudante" e ✕ para remover. */
let nDatalist = 0;
export function editorAjudantes(inicial = [], { disabled = false, sugestoes = [] } = {}) {
  const lista = h('div', { class: 'lista-ajudantes' });
  // Sugere os ajudantes cadastrados, mas aceita qualquer nome
  const idLista = sugestoes.length ? `ajudantes-${++nDatalist}` : null;
  const datalist = idLista ? h('datalist', { id: idLista }, sugestoes.map(n => h('option', { value: n }))) : null;
  const linha = (valor = '') => {
    const row = h('div', { class: 'linha-ajudante' },
      h('input', { class: 'campo', value: valor, autocapitalize: 'words', autocomplete: 'off', placeholder: 'Nome do ajudante', disabled, 'aria-label': 'Nome do ajudante', list: idLista }),
      h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Remover ajudante', disabled, onclick: () => row.remove() }, '✕'));
    return row;
  };
  const nomes = (inicial || []).filter(Boolean);
  (nomes.length ? nomes : (disabled ? [] : [''])).forEach(v => lista.append(linha(v)));
  const add = disabled ? null : h('button', {
    type: 'button', class: 'btn btn-cinza btn-medio',
    onclick: () => { const r = linha(); lista.append(r); r.querySelector('input').focus(); },
  }, '+ Adicionar ajudante');
  return {
    el: h('div', { class: 'grupo' }, h('span', { class: 'rotulo' }, 'Ajudante(s)'),
      disabled && !nomes.length ? h('div', { class: 'v' }, '—') : null, lista, datalist, add),
    ler: () => [...lista.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean),
  };
}

/** Campo de formulário com rótulo. */
export function campo(rotulo, input, extra) {
  return h('label', { class: 'grupo' }, h('span', { class: 'rotulo' }, rotulo), input, extra || null);
}
