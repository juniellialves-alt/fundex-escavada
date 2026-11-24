// Cadastro de usuários (só Adm): nome, usuário, perfil, senha e ativo/desativado.
import { h, nav, registrarTela, topo, toast, mostrarErros, campo, confirmar } from '../ui.js';
import * as A from '../auth.js';
import * as M from '../maquinas.js';

registrarTela('usuarios', async () => {
  if (!A.ehAdm()) { setTimeout(() => nav.back()); return h('div'); }
  const usuarios = await A.listarUsuarios();
  const nomeMaq = Object.fromEntries((await M.listarMaquinas()).map(m => [m.id, m.nome]));
  const cartao = u => h('div', {
    class: 'cartao' + (u.ativo ? '' : ' inativo'), role: 'button', tabindex: '0',
    onclick: () => nav.go('usuario', { id: u.id }),
  },
    h('div', { class: 'l1' },
      h('span', { class: 'nome' }, u.nome),
      h('span', { class: 'icones' },
        h('span', { class: 'tag perfil-' + u.perfil }, A.PERFIS[u.perfil]),
        u.sync === 'pendente' ? h('span', { class: 'ic pend', title: 'Pendente de envio', 'aria-label': 'Pendente de envio' }, '⏳') : null)),
    h('div', { class: 'l3' }, `Usuário: ${u.login}`, nomeMaq[u.maquinaId] ? ` · Máquina ${nomeMaq[u.maquinaId]}` : '', u.ativo ? '' : ' · DESATIVADO'));

  return h('div', null,
    topo('Usuários'),
    h('div', { class: 'tela' },
      h('button', { class: 'btn btn-verde btn-medio', style: { marginTop: '14px' }, onclick: () => nav.go('usuario', {}) }, '+ Novo usuário'),
      h('button', { class: 'btn btn-escuro btn-medio', style: { marginTop: '10px' }, onclick: () => nav.go('maquinas') }, '🚜 Máquinas'),
      h('div', { class: 'aviso aviso-info', style: { marginTop: '12px' } },
        'Os usuários vão para a planilha e chegam sozinhos aos outros celulares. A conta "admin" (senha do escritório) sempre funciona e não aparece aqui.'),
      usuarios.length
        ? h('div', { class: 'cartoes' }, usuarios.map(cartao))
        : h('div', { class: 'vazio' }, 'Nenhum usuário cadastrado ainda.')));
});

registrarTela('usuario', async ({ id }) => {
  if (!A.ehAdm()) { setTimeout(() => nav.back()); return h('div'); }
  const antigo = id ? await A.getUsuario(id) : null;
  const euMesmo = antigo && A.sessao().id === antigo.id;
  let perfil = antigo ? antigo.perfil : 'operador';
  let ativo = antigo ? antigo.ativo : true;

  const fNome = h('input', { class: 'campo', value: antigo ? antigo.nome : '', autocapitalize: 'words', autocomplete: 'off', placeholder: 'Ex.: João da Silva' });
  const fLogin = h('input', { class: 'campo', value: antigo ? antigo.login : '', autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false', placeholder: 'Ex.: joao.silva' });
  const fSenha = h('input', { class: 'campo', type: 'text', autocomplete: 'new-password', autocapitalize: 'none', spellcheck: 'false',
    placeholder: antigo ? 'Deixe em branco para manter a senha atual' : 'Mínimo de 4 caracteres' });
  const erros = h('div', { class: 'erros', hidden: true });

  // sugere o usuário a partir do nome (joão da silva -> joao.silva)
  if (!antigo) {
    fNome.addEventListener('input', () => {
      if (fLogin.dataset.mexeu) return;
      const p = A.normLogin(fNome.value).split('.').filter(x => x && !['da', 'de', 'do', 'das', 'dos', 'e'].includes(x));
      fLogin.value = p.length > 1 ? `${p[0]}.${p[p.length - 1]}` : (p[0] || '');
    });
    fLogin.addEventListener('input', () => { fLogin.dataset.mexeu = '1'; });
  }

  const botoesPerfil = Object.keys(A.PERFIS).map(p => {
    const b = h('button', { type: 'button', class: 'opcao-perfil', disabled: euMesmo },
      h('b', null, A.PERFIS[p]), h('span', null, A.DESCRICAO_PERFIL[p]));
    b.onclick = () => { perfil = p; marcar(); };
    return [b, p];
  });
  const fAtivo = h('button', { type: 'button', class: 'btn btn-medio', disabled: euMesmo });
  fAtivo.onclick = () => { ativo = !ativo; marcar(); };

  // Máquina de costume (só para Operador)
  const maquinas = (await M.listarMaquinas()).filter(m => m.ativo || (antigo && m.id === antigo.maquinaId));
  let maquinaId = antigo && antigo.maquinaId && maquinas.some(m => m.id === antigo.maquinaId) ? antigo.maquinaId : null;
  const botoesMaq = [...maquinas.map(m => [m.nome, m.id]), ['Sem máquina fixa', null]].map(([nome, mid]) => {
    const b = h('button', { type: 'button', class: 'opcao' }, nome);
    b.onclick = () => { maquinaId = mid; marcar(); };
    return [b, mid];
  });
  const blocoMaq = h('div', { class: 'grupo' },
    h('span', { class: 'rotulo' }, 'Máquina do operador'),
    h('div', { class: 'dica' }, maquinas.length
      ? 'Já vem marcada para ele na tela "Dados da obra". Se um dia ele trabalhar em outra, troca lá.'
      : 'Nenhuma máquina cadastrada ainda: cadastre em 🚜 Máquinas.'),
    h('div', { class: 'grade-opcoes' }, botoesMaq.map(b => b[0])));

  function marcar() {
    botoesPerfil.forEach(([b, p]) => b.classList.toggle('sel', p === perfil));
    botoesMaq.forEach(([b, mid]) => b.classList.toggle('sel', mid === maquinaId));
    blocoMaq.hidden = perfil !== 'operador';
    fAtivo.className = 'btn btn-medio ' + (ativo ? 'btn-verde' : 'btn-perigo');
    fAtivo.textContent = ativo ? '✔ Ativo (pode entrar no app)' : '✕ Desativado (não entra no app)';
  }
  marcar();

  let salvando = false;
  async function salvar() {
    if (salvando) return;
    const nome = fNome.value.trim();
    const login = A.normLogin(fLogin.value);
    const senha = fSenha.value;
    const e = [];
    if (!nome) e.push('Informe o nome.');
    if (!login) e.push('Informe o usuário.');
    else if (!A.loginValido(login)) e.push('Usuário: de 3 a 30 letras ou números, sem espaços (pode usar ponto). Ex.: joao.silva');
    if (!antigo && !senha) e.push('Crie uma senha.');
    if (senha && senha.length < 4) e.push('A senha precisa ter pelo menos 4 caracteres.');
    mostrarErros(erros, e);
    if (e.length) return;
    if (antigo && !ativo && antigo.ativo &&
      !(await confirmar(`Desativar ${nome}?\nEle não vai mais conseguir entrar no app.`, { sim: 'DESATIVAR', nao: 'VOLTAR', classeSim: 'btn-vermelho' }))) return;
    salvando = true;
    try {
      const r = await A.salvarUsuario({ id: antigo && antigo.id, nome, login, perfil, senha, ativo, maquinaId });
      if (!r.ok) { mostrarErros(erros, [r.msg]); return; }
      toast(antigo ? 'Usuário alterado' : `Usuário ${login} criado`);
      nav.back();
    } finally { salvando = false; }
  }

  return h('div', null,
    topo(antigo ? antigo.nome : 'Novo usuário'),
    h('div', { class: 'tela' },
      h('div', { class: 'form' },
        euMesmo ? h('div', { class: 'aviso aviso-info' }, 'Este é o seu usuário: você pode mudar o nome e a senha, mas não o perfil.') : null,
        campo(['Nome completo', h('span', { class: 'obrig' }, ' *')], fNome),
        campo(['Usuário (para entrar no app)', h('span', { class: 'obrig' }, ' *')], fLogin),
        campo(antigo ? 'Nova senha' : ['Senha', h('span', { class: 'obrig' }, ' *')], fSenha),
        h('div', { class: 'grupo' }, h('span', { class: 'rotulo' }, 'Perfil'), h('div', { class: 'grade-perfil' }, botoesPerfil.map(b => b[0]))),
        blocoMaq,
        antigo ? fAtivo : null,
        erros,
        h('button', { class: 'btn btn-verde btn-gigante', onclick: salvar }, 'SALVAR'))));
});
