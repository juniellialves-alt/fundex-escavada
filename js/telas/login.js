// Tela de entrada: usuário e senha.
import { h, registrarTela, campo } from '../ui.js';
import { entrar } from '../auth.js';
import { getCfg } from '../db.js';
import { baixarAgora } from '../sync.js';
import { irParaInicio } from '../inicio.js';
import { VERSAO } from '../versao.js';

registrarTela('login', async () => {
  const configurado = !!(await getCfg('scriptUrl'));
  const fLogin = h('input', { class: 'campo', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Ex.: joao.silva' });
  const fSenha = h('input', { class: 'campo', type: 'password', autocomplete: 'current-password' });
  const msg = h('div', { class: 'erros', hidden: true, role: 'alert' });
  const btn = h('button', { class: 'btn btn-verde btn-gigante', type: 'submit' }, 'ENTRAR');

  const mostrar = t => { msg.textContent = t ? '⚠ ' + t : ''; msg.hidden = !t; };

  async function tentar(ev) {
    ev.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true; mostrar('');
    try {
      let r = await entrar(fLogin.value, fSenha.value);
      if (!r.ok && r.naoEncontrado && configurado) {
        // Usuário novo: busca a lista atualizada na planilha e tenta de novo
        btn.textContent = 'Buscando usuários…';
        const b = await baixarAgora();
        r = await entrar(fLogin.value, fSenha.value);
        if (!r.ok && r.naoEncontrado && !b.ok) r.msg += ` Não foi possível buscar na planilha: ${b.msg}`;
      }
      if (!r.ok) {
        if (r.naoEncontrado && !configurado) r.msg += ' Este celular ainda não foi configurado: entre como "admin" e configure a planilha.';
        mostrar(r.msg); fSenha.select(); return;
      }
      await irParaInicio();
    } finally { btn.disabled = false; btn.textContent = 'ENTRAR'; }
  }

  return h('div', { class: 'tela-login' },
    h('img', { src: 'img/logo.svg', alt: 'Fundex', class: 'logo-login' }),
    h('div', { class: 'titulo-login' }, 'Estaca Escavada'),
    h('form', { class: 'form', onsubmit: tentar },
      campo('Usuário', fLogin),
      campo('Senha', fSenha),
      msg,
      btn),
    !configurado ? h('div', { class: 'aviso aviso-info', style: { marginTop: '16px' } },
      'Primeiro acesso neste celular? Entre com o usuário "admin" e a senha do escritório para ligar o app à planilha.') : null,
    h('div', { class: 'versao' }, `Versão ${VERSAO}`));
});
