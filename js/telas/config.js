// Configuração protegida por senha (uso do escritório): endereço do script da planilha e código de acesso.
import { h, nav, registrarTela, topo, toast, campo, confirmar, pedirSenha, avisar } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { getCfg, setCfg } from '../db.js';
import { statusSync, enviarAgora, testarConexao, marcarTudoParaReenvio } from '../sync.js';
import { VERSAO } from '../versao.js';

registrarTela('config', async () => {
  if (!(await pedirSenha(S.senhaOk, 'Configuração – senha do escritório'))) {
    setTimeout(() => nav.back());
    return h('div');
  }
  const fUrl = h('input', { class: 'campo', type: 'url', value: (await getCfg('scriptUrl')) || '', placeholder: 'https://script.google.com/macros/s/.../exec', autocomplete: 'off', style: { fontSize: '16px' } });
  const fCod = h('input', { class: 'campo', value: (await getCfg('codigoAcesso')) || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const status = h('div', { class: 'conferencia-box' });

  async function desenharStatus() {
    const st = await statusSync();
    const dado = (k, v) => h('div', { class: 'dado' }, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '19px' } }, v));
    status.replaceChildren(
      dado('Registros pendentes', String(st.pendentes)),
      dado('Último envio', st.ultimoEnvio ? U.fmtDateTime(st.ultimoEnvio) : '—'),
      dado('Último erro', st.erro ? `${U.fmtDateTime(st.erro.quando)} – ${st.erro.msg}` : 'Nenhum'));
  }
  await desenharStatus();

  const validarUrl = u => /^https:\/\/script\.google\.com\/.+\/exec$/.test(u);

  async function salvar() {
    const url = fUrl.value.trim(), cod = fCod.value.trim();
    if (url && !validarUrl(url)) { await avisar('O endereço deve começar com https://script.google.com/ e terminar com /exec'); return; }
    await setCfg('scriptUrl', url);
    await setCfg('codigoAcesso', cod);
    toast('Configuração salva');
    const r = await enviarAgora();
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
  async function enviar() { const r = await enviarAgora(); toast(r.ok ? `${r.total || 0} registro(s) enviado(s)` : r.msg); desenharStatus(); }
  async function reenviar() {
    if (await confirmar('Marcar TODOS os registros para enviar de novo?\nUse quando trocar de planilha. Não cria linhas repetidas.', { sim: 'REENVIAR', nao: 'CANCELAR' })) {
      await marcarTudoParaReenvio(); toast('Reenvio iniciado'); desenharStatus();
    }
  }

  return h('div', null,
    topo('Configuração'),
    h('div', { class: 'tela' },
      h('div', { class: 'form' },
        h('div', { class: 'aviso aviso-info' }, 'Área do escritório. O operador não precisa mexer aqui.'),
        campo('Endereço do script da planilha (aplicativo da web)', fUrl),
        campo('Código de acesso (o mesmo escrito no script)', fCod),
        h('button', { class: 'btn btn-verde btn-medio', onclick: salvar }, 'SALVAR'),
        h('button', { class: 'btn btn-cinza btn-medio', onclick: testar }, 'Testar conexão'),
        h('div', { class: 'secao-titulo' }, 'Envio para a planilha'),
        status,
        h('button', { class: 'btn btn-escuro btn-medio', onclick: enviar }, 'Enviar agora'),
        h('button', { class: 'btn btn-cinza btn-medio', onclick: reenviar }, 'Reenviar tudo'),
        h('div', { class: 'secao-titulo' }, 'Estacas bloqueadas'),
        h('p', { style: { margin: 0 } }, 'Estacas e ocorrências com mais de 3 dias ficam bloqueadas. Para desbloquear, abra o registro na lista e toque em "Desbloquear (escritório)" usando esta mesma senha.'),
        h('div', { class: 'versao' }, `Fundex Estaca Escavada – versão ${VERSAO}`))));
});
