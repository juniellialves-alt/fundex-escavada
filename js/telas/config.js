// Configuração (só Adm): endereço do script da planilha, código de acesso, envio e usuários.
import { h, nav, registrarTela, topo, toast, campo, confirmar, avisar } from '../ui.js';
import * as U from '../util.js';
import { getCfg, setCfg } from '../db.js';
import { statusSync, sincronizar, testarConexao, marcarTudoParaReenvio, zerarCursores } from '../sync.js';
import { VERSAO } from '../versao.js';
import * as A from '../auth.js';

registrarTela('config', async () => {
  if (!A.ehAdm()) { setTimeout(() => nav.back()); return h('div'); }
  const fUrl = h('input', { class: 'campo', type: 'url', value: (await getCfg('scriptUrl')) || '', placeholder: 'https://script.google.com/macros/s/.../exec', autocomplete: 'off', style: { fontSize: '16px' } });
  const fCod = h('input', { class: 'campo', value: (await getCfg('codigoAcesso')) || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const status = h('div', { class: 'conferencia-box' });

  async function desenharStatus() {
    const st = await statusSync();
    const dado = (k, v) => h('div', { class: 'dado' }, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '19px' } }, v));
    status.replaceChildren(
      dado('Registros pendentes', String(st.pendentes)),
      dado('Último envio', st.ultimoEnvio ? U.fmtDateTime(st.ultimoEnvio) : '—'),
      dado('Última atualização recebida', st.ultimaBaixa ? U.fmtDateTime(st.ultimaBaixa) : '—'),
      dado('Último erro', st.erro ? `${U.fmtDateTime(st.erro.quando)} – ${st.erro.msg}` : 'Nenhum'));
  }
  await desenharStatus();

  const validarUrl = u => /^https:\/\/script\.google\.com\/.+\/exec$/.test(u);

  async function salvar() {
    const url = fUrl.value.trim(), cod = fCod.value.trim();
    if (url && !validarUrl(url)) { await avisar('O endereço deve começar com https://script.google.com/ e terminar com /exec'); return; }
    if (url !== ((await getCfg('scriptUrl')) || '')) await zerarCursores(); // planilha nova: baixa tudo
    await setCfg('scriptUrl', url);
    await setCfg('codigoAcesso', cod);
    toast('Configuração salva');
    const r = await sincronizar();
    if (!r.ok) toast(r.msg);
    desenharStatus();
  }
  async function testar() {
    const url = fUrl.value.trim();
    if (!validarUrl(url)) { await avisar('Cole o endereço do aplicativo da web (termina com /exec).'); return; }
    toast('Testando…');
    const r = await testarConexao(url, fCod.value.trim());
    await avisar(r.msg, r.ok ? '✔ Tudo certo' : '✕ Falhou');
  }
  async function enviar() {
    const r = await sincronizar();
    toast(r.ok ? `${r.total || 0} enviado(s) · ${r.baixados || 0} recebido(s)` : r.msg);
    desenharStatus();
  }
  async function reenviar() {
    if (await confirmar('Marcar TODOS os registros para enviar de novo?\nUse quando trocar de planilha. Não cria linhas repetidas.', { sim: 'REENVIAR', nao: 'CANCELAR' })) {
      await marcarTudoParaReenvio(); toast('Reenvio iniciado'); desenharStatus();
    }
  }

  return h('div', null,
    topo('Configuração'),
    h('div', { class: 'tela' },
      h('div', { class: 'form' },
        h('div', { class: 'aviso aviso-info' }, 'Área do Adm. O operador não precisa mexer aqui.'),
        h('button', { class: 'btn btn-escuro btn-medio', onclick: () => nav.go('usuarios') }, '👥 Usuários do app'),
        h('div', { class: 'secao-titulo' }, 'Planilha'),
        campo('Endereço do script da planilha (aplicativo da web)', fUrl),
        campo('Código de acesso (o mesmo escrito no script)', fCod),
        h('button', { class: 'btn btn-verde btn-medio', onclick: salvar }, 'SALVAR'),
        h('button', { class: 'btn btn-cinza btn-medio', onclick: testar }, 'Testar conexão'),
        h('div', { class: 'secao-titulo' }, 'Sincronização'),
        h('p', { style: { margin: 0 } }, 'É automática: ao abrir o app, ao salvar, quando a internet volta e a cada 2 minutos. O celular envia o que foi lançado nele e recebe o que foi lançado nos outros.'),
        status,
        h('button', { class: 'btn btn-escuro btn-medio', onclick: enviar }, 'Sincronizar agora'),
        h('button', { class: 'btn btn-cinza btn-medio', onclick: reenviar }, 'Reenviar tudo'),
        h('div', { class: 'secao-titulo' }, 'Estacas bloqueadas'),
        h('p', { style: { margin: 0 } }, 'Estacas e ocorrências com mais de 3 dias ficam bloqueadas para o operador. O Adm altera sem precisar desbloquear. No celular do operador, toque em "Desbloquear (Adm)" e digite a senha de um Adm ou a do escritório.'),
        h('div', { class: 'versao' }, `Fundex Estaca Escavada – versão ${VERSAO}`))));
});
