// Tela principal: cronômetro, acessos e situação do envio.
import { h, nav, onLeave, registrarTela, confirmar, toast } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { statusSync, enviarAgora } from '../sync.js';
import { VERSAO } from '../versao.js';

registrarTela('principal', async () => {
  const ativo = await S.getAtivo();
  if (!ativo) { setTimeout(() => nav.reset('obra', { primeira: true })); return h('div'); }
  let crono = await S.getCrono();

  const tempo = h('div', { class: 'tempo', 'aria-live': 'off' });
  const info = h('div', { class: 'info' });
  const btn = h('button', { class: 'btn btn-gigante' });
  const cancelar = h('button', { class: 'link-discreto' }, 'Cancelar estaca iniciada por engano');
  const syncBox = h('div', { class: 'sync-barra' });
  let ocupado = false;

  function atualizar() {
    btn.className = 'btn btn-gigante';
    if (!crono) {
      tempo.textContent = '00:00:00'; tempo.classList.add('parado');
      info.textContent = 'Pronto para iniciar';
      btn.classList.add('btn-verde'); btn.textContent = '▶ INICIAR ESTACA';
      cancelar.hidden = true;
    } else if (!crono.fim) {
      tempo.textContent = U.fmtDur((Date.now() - crono.inicio) / 1000); tempo.classList.remove('parado');
      info.textContent = `Início às ${U.timeOf(crono.inicio)}`;
      btn.classList.add('btn-vermelho'); btn.textContent = '■ FINALIZAR ESTACA';
      cancelar.hidden = false;
    } else {
      tempo.textContent = U.fmtDur((crono.fim - crono.inicio) / 1000); tempo.classList.add('parado');
      info.textContent = `Finalizada às ${U.timeOf(crono.fim)} – falta preencher os dados`;
      btn.classList.add('btn-escuro'); btn.textContent = '✎ PREENCHER DADOS DA ESTACA';
      cancelar.hidden = false;
    }
  }

  btn.addEventListener('click', async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      const ts = Date.now();
      crono = await S.getCrono();
      if (!crono) {
        if (await S.precisaConferencia()) { nav.go('conferencia'); return; }
        await S.iniciarCrono(ts);
        crono = await S.getCrono();
        atualizar(); toast('Estaca iniciada');
      } else if (!crono.fim) {
        if (await confirmar('Finalizar estaca?', { sim: 'FINALIZAR', nao: 'CONTINUAR', classeSim: 'btn-vermelho' })) {
          crono = await S.pararCrono(ts);
          nav.go('estaca', { modo: 'cronometro' });
        }
      } else {
        nav.go('estaca', { modo: 'cronometro' });
      }
    } finally { ocupado = false; }
  });

  cancelar.addEventListener('click', async () => {
    if (await confirmar('Descartar esta estaca?\nO tempo marcado será perdido.', { sim: 'DESCARTAR', nao: 'VOLTAR', classeSim: 'btn-vermelho' })) {
      await S.limparCrono(); crono = null; atualizar(); toast('Estaca descartada');
    }
  });

  async function desenharSync() {
    const st = await statusSync();
    const ultimo = st.ultimoEnvio ? `Último envio: ${U.fmtDateTime(st.ultimoEnvio)}` : 'Nenhum envio ainda';
    let linha1;
    if (st.rodando) linha1 = '⇅ Enviando…';
    else if (st.pendentes === 0) linha1 = '✔ Tudo enviado';
    else linha1 = `⏳ ${st.pendentes} ${st.pendentes === 1 ? 'registro aguardando' : 'registros aguardando'} internet`;
    const aviso = !st.configurado ? 'Planilha não configurada' : (st.erro && st.pendentes ? `Falha: ${st.erro.msg}` : '');
    syncBox.className = 'sync-barra ' + (st.pendentes ? 'pend' : 'ok');
    const enviar = h('button', { class: 'btn btn-escuro' }, 'Enviar agora');
    enviar.onclick = async () => {
      enviar.disabled = true;
      const r = await enviarAgora();
      toast(r.ok ? (r.total ? `${r.total} registro(s) enviado(s)` : 'Nada pendente') : r.msg);
    };
    syncBox.replaceChildren(
      h('div', { class: 'txt' }, h('b', null, linha1), h('br'), ultimo, aviso ? h('div', { style: { color: '#7A0000', fontWeight: 700 } }, aviso) : null),
      enviar);
  }

  atualizar();
  desenharSync();
  const timer = setInterval(() => { if (crono && !crono.fim) atualizar(); }, 1000);
  const onSync = () => desenharSync();
  const onVis = async () => { if (document.visibilityState === 'visible') { crono = await S.getCrono(); atualizar(); } };
  window.addEventListener('sync-status', onSync);
  document.addEventListener('visibilitychange', onVis);
  onLeave(() => {
    clearInterval(timer);
    window.removeEventListener('sync-status', onSync);
    document.removeEventListener('visibilitychange', onVis);
  });

  const o = ativo.obra;
  return h('div', null,
    h('header', { class: 'cab-principal' },
      h('img', { src: 'img/logo.svg', alt: 'Fundex' }),
      h('div', { class: 'titulo-app' }, 'Estaca', h('br'), 'Escavada'),
      h('button', { class: 'btn-icone engrenagem', 'aria-label': 'Configuração', onclick: () => nav.go('config') }, '⚙')),
    h('div', { class: 'resumo-ativo' },
      h('div', { class: 'txt' },
        h('b', null, `Obra ${o.numero} – ${o.nome}`), h('br'),
        `Máquina: ${ativo.maquina} | Operador: ${ativo.operador}`,
        ativo.ajudantes.length ? ` | Ajudante(s): ${S.fmtAjudantes(ativo.ajudantes)}` : ''),
      h('button', { class: 'btn-icone', 'aria-label': 'Editar dados da obra', onclick: () => nav.go('obra') }, '✏️')),
    h('div', { class: 'tela' },
      h('div', { class: 'cronometro' }, tempo, info),
      btn,
      cancelar,
      h('div', { class: 'grade-acessos' },
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('lista') }, h('span', { class: 'ico' }, '📋'), 'Lista de estacas'),
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('estaca', { modo: 'manual' }) }, h('span', { class: 'ico' }, '✍️'), 'Lançar estaca manual'),
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('ocorrencias') }, h('span', { class: 'ico' }, '⚠️'), 'Ocorrências do dia'),
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('producao') }, h('span', { class: 'ico' }, '📊'), 'Minha produção')),
      syncBox,
      h('div', { class: 'versao' }, `Versão ${VERSAO}`)));
});
