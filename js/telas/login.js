// Tela de entrada: usuário e senha.
import { h, registrarTela, campo, toast, pedirSenha, modal } from '../ui.js';
import { entrar, sair, trocarMinhaSenha } from '../auth.js';

/** Primeiro acesso com senha provisória: pede a senha definitiva (duas vezes). Retorna true se trocou. */
async function criarSenhaDefinitiva() {
  const s1 = h('input', { type: 'password', class: 'campo', autocomplete: 'new-password', 'aria-label': 'Nova senha' });
  const s2 = h('input', { type: 'password', class: 'campo', autocomplete: 'new-password', 'aria-label': 'Repita a nova senha' });
  const erro = h('p', { class: 'erro-texto', hidden: true });
  const v = await modal({
    titulo: 'Crie a sua senha',
    corpo: h('div', null,
      h('p', null, 'Você entrou com uma senha provisória. Crie agora a sua senha (mínimo de 4 caracteres).'),
      campo('Nova senha', s1), campo('Repita a nova senha', s2), erro),
    botoes: [{ texto: 'CANCELAR', valor: false }, { texto: 'SALVAR', classe: 'btn-verde', valor: true }],
    antesDeFechar: async ok => {
      if (!ok) return true;
      const falha = s1.value.length < 4 ? 'A senha precisa ter pelo menos 4 caracteres.' : s1.value !== s2.value ? 'As duas senhas estão diferentes.' : '';
      if (falha) { erro.textContent = falha; erro.hidden = false; return false; }
      const r = await trocarMinhaSenha(s1.value);
      if (!r.ok) { erro.textContent = r.msg; erro.hidden = false; return false; }
      return true;
    },
  });
  if (v) toast('Senha criada. Use ela das próximas vezes.');
  return v === true;
}
import { getCfg } from '../db.js';
import { baixarAgora, sincronizar } from '../sync.js';
import { configurarSeFaltar, destrancar } from '../config-padrao.js';
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
      if (!r.ok && r.naoEncontrado && !(await getCfg('scriptUrl'))) {
        // Celular ainda não ligado à planilha: a senha do escritório liga na hora e o login é tentado de novo
        let senhaEsc = '';
        const ok = await pedirSenha(async s => { senhaEsc = s; return !!(await destrancar(s)); },
          'Primeiro acesso neste celular: digite a senha do escritório para buscar os usuários');
        if (ok && (await configurarSeFaltar(senhaEsc))) {
          btn.textContent = 'Buscando usuários…';
          const b = await sincronizar();
          r = await entrar(fLogin.value, fSenha.value);
          if (!r.ok && r.naoEncontrado && !b.ok) r.msg += ` Não foi possível buscar na planilha: ${b.msg}`;
        }
      } else if (!r.ok && r.naoEncontrado) {
        // Usuário novo: busca a lista atualizada na planilha e tenta de novo
        btn.textContent = 'Buscando usuários…';
        const b = await baixarAgora();
        r = await entrar(fLogin.value, fSenha.value);
        if (!r.ok && r.naoEncontrado && !b.ok) r.msg += ` Não foi possível buscar na planilha: ${b.msg}`;
      }
      if (!r.ok) {
        if (r.naoEncontrado && !(await getCfg('scriptUrl'))) r.msg += ' Este celular ainda não está ligado à planilha: é preciso a senha do escritório uma vez.';
        mostrar(r.msg); fSenha.select(); return;
      }
      // Senha provisória (cadastro feito pela planilha): a pessoa cria a senha dela agora
      if (r.trocarSenha && !(await criarSenhaDefinitiva())) {
        await sair();
        mostrar('Para entrar, crie a sua senha.'); return;
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
      'Primeiro acesso neste celular? Entre com o seu usuário: o app pede a senha do escritório uma única vez, se liga à planilha e busca os usuários e as máquinas.') : null,
    h('div', { class: 'versao' }, `Versão ${VERSAO}`));
});
