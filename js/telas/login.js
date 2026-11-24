// Tela de entrada: usuário e senha.
import { h, registrarTela, campo, toast } from '../ui.js';
import { entrar } from '../auth.js';
import { getCfg } from '../db.js';
import { baixarAgora, sincronizar } from '../sync.js';
import { configurarSeFaltar } from '../config-padrao.js';
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
        if (r.naoEncontrado && !configurado) r.msg += ' Este celular ainda não está ligado à planilha: entre uma vez com o usuário "admin" e a senha do escritório.';
        mostrar(r.msg); fSenha.select(); return;
      }
      // Celular novo: a senha do escritório destranca o endereço da planilha e o app já baixa usuários e máquinas
      if (r.sessao.id === 'admin' && (await configurarSeFaltar(fSenha.value))) {
        btn.textContent = 'Buscando cadastros na planilha…';
        const b = await sincronizar();
        if (!b.ok) toast('Celular ligado à planilha, mas sem conexão agora. Os cadastros chegam quando houver internet.');
        else toast('Celular ligado à planilha. Cadastros recebidos.');
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
      'Primeiro acesso neste celular? Entre uma vez com o usuário "admin" e a senha do escritório: o app se liga sozinho à planilha e recebe os usuários e as máquinas.') : null,
    h('div', { class: 'versao' }, `Versão ${VERSAO}`));
});
