// Tela principal: cronômetro, acessos e situação do envio.
import { h, nav, onLeave, registrarTela, confirmar, toast, pedirSenha } from '../ui.js';
import { destrancar, configurarSeFaltar } from '../config-padrao.js';
import * as S from '../store.js';
import * as U from '../util.js';
import { statusSync, sincronizar } from '../sync.js';
import { VERSAO } from '../versao.js';
import * as A from '../auth.js';

/** Cabeçalho com logo, nome de quem está no app, Sair e (para o Adm) a engrenagem. */
function cabecalho() {
  const s = A.sessao();
  async function sair() {
    const c = await S.getCrono();
    const msg = c ? 'Há uma estaca em andamento neste celular. Sair mesmo assim?\nO cronômetro continua salvo.' : `Sair do app?\nVocê está como ${s.nome}.`;
    if (await confirmar(msg, { sim: 'SAIR', nao: 'VOLTAR', classeSim: 'btn-vermelho' })) {
      await A.sair();
      (await import('../inicio.js')).irParaInicio();
    }
  }
  return h('header', { class: 'cab-principal' },
    h('img', { src: 'img/logo.svg', alt: 'Fundex' }),
    h('div', { class: 'titulo-app' }, h('span', { class: 'quem' }, s.nome), h('br'), A.PERFIS[s.perfil]),
    h('div', { class: 'acoes-cab' },
      A.ehAdm() ? h('button', { class: 'btn-icone', 'aria-label': 'Configuração', onclick: () => nav.go('config') }, '⚙') : null,
      h('button', { class: 'btn-icone btn-sair', 'aria-label': 'Sair', onclick: sair }, 'Sair')));
}

/** Barra de sincronização: pendentes, última atualização e botão de reserva. */
function barraSync() {
  const box = h('div', { class: 'sync-barra' });
  async function desenhar() {
    const st = await statusSync();
    const quando = Math.max(st.ultimoEnvio || 0, st.ultimaBaixa || 0);
    const ultimo = quando ? `Atualizado: ${U.fmtDateTime(quando)}` : 'Ainda não sincronizado';
    let linha1;
    if (st.rodando) linha1 = '⇅ Sincronizando…';
    else if (st.pendentes === 0) linha1 = '✔ Tudo enviado';
    else linha1 = `⏳ ${st.pendentes} ${st.pendentes === 1 ? 'registro aguardando' : 'registros aguardando'} internet`;
    const aviso = !st.configurado ? 'Planilha não configurada' : (st.erro && st.pendentes ? `Falha: ${st.erro.msg}` : '');
    box.className = 'sync-barra ' + (st.pendentes ? 'pend' : 'ok');
    const btn = h('button', { class: 'btn btn-escuro', disabled: st.rodando }, st.configurado ? 'Atualizar agora' : '🔗 Ligar à planilha');
    btn.onclick = async () => {
      btn.disabled = true;
      if (!st.configurado) {
        // a senha do escritório destranca o endereço e o código da planilha
        let senha = '';
        const ok = await pedirSenha(async s => { senha = s; return !!(await destrancar(s)); }, 'Ligar à planilha – senha do escritório');
        if (!ok) { btn.disabled = false; return; }
        await configurarSeFaltar(senha);
        toast('Buscando cadastros na planilha…');
      }
      const r = await sincronizar();
      toast(r.ok ? `Atualizado${r.total ? ` · ${r.total} enviado(s)` : ''}${r.baixados ? ` · ${r.baixados} recebido(s)` : ''}` : r.msg);
      if (r.baixados && !document.querySelector('.modal-fundo')) nav.refresh();
    };
    box.replaceChildren(
      h('div', { class: 'txt' }, h('b', null, linha1), h('br'), ultimo, aviso ? h('div', { style: { color: '#7A0000', fontWeight: 700 } }, aviso) : null),
      btn);
  }
  desenhar();
  const on = () => desenhar();
  window.addEventListener('sync-status', on);
  return { el: box, parar: () => window.removeEventListener('sync-status', on) };
}

/** Ajudante: só consulta a produção. */
function telaAjudante() {
  const sync = barraSync();
  onLeave(sync.parar);
  return h('div', null,
    cabecalho(),
    h('div', { class: 'tela' },
      h('div', { class: 'aviso aviso-info', style: { marginTop: '14px' } },
        'Você pode acompanhar a produção. As estacas são lançadas pelo operador e chegam aqui sozinhas quando há internet.'),
      h('button', { class: 'btn btn-escuro btn-gigante', style: { marginTop: '14px' }, onclick: () => nav.go('producao') }, '📊 Ver produção'),
      h('div', { class: 'espaco' }),
      sync.el,
      h('div', { class: 'versao' }, `Versão ${VERSAO}`)));
}

/** Adm sem obra definida neste celular. */
function telaSemObra() {
  const sync = barraSync();
  onLeave(sync.parar);
  return h('div', null,
    cabecalho(),
    h('div', { class: 'tela' },
      h('div', { class: 'aviso aviso-info', style: { marginTop: '14px' } },
        'Para usar o cronômetro neste celular, defina a obra, a máquina e os ajudantes.'),
      h('button', { class: 'btn btn-verde btn-medio', style: { marginTop: '12px' }, onclick: () => nav.go('obra') }, 'Definir obra e máquina'),
      h('div', { class: 'grade-acessos' },
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('lista') }, h('span', { class: 'ico' }, '📋'), 'Lista de estacas'),
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('producao') }, h('span', { class: 'ico' }, '📊'), 'Produção'),
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('usuarios') }, h('span', { class: 'ico' }, '👥'), 'Usuários'),
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('maquinas') }, h('span', { class: 'ico' }, '🚜'), 'Máquinas'),
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('config') }, h('span', { class: 'ico' }, '⚙'), 'Configuração')),
      sync.el,
      h('div', { class: 'versao' }, `Versão ${VERSAO}`)));
}

registrarTela('principal', async () => {
  if (!A.sessao()) { setTimeout(() => nav.reset('login')); return h('div'); }
  if (A.ehAjudante()) return telaAjudante();
  const ativo = await S.getAtivo();
  if (!ativo) {
    if (A.ehAdm()) return telaSemObra();
    setTimeout(() => nav.reset('obra', { primeira: true })); return h('div');
  }
  let crono = await S.getCrono();

  const tempo = h('div', { class: 'tempo', 'aria-live': 'off' });
  const info = h('div', { class: 'info' });
  const btn = h('button', { class: 'btn btn-gigante' });
  const cancelar = h('button', { class: 'link-discreto' }, 'Cancelar estaca iniciada por engano');
  const sync = barraSync();
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

  atualizar();
  const timer = setInterval(() => { if (crono && !crono.fim) atualizar(); }, 1000);
  const onVis = async () => { if (document.visibilityState === 'visible') { crono = await S.getCrono(); atualizar(); } };
  document.addEventListener('visibilitychange', onVis);
  onLeave(() => {
    clearInterval(timer);
    sync.parar();
    document.removeEventListener('visibilitychange', onVis);
  });

  const o = ativo.obra;
  return h('div', null,
    cabecalho(),
    h('div', { class: 'resumo-ativo' },
      h('div', { class: 'txt' },
        h('b', null, `Obra ${o.numero} – ${o.nome}`), h('br'),
        `Máquina: ${ativo.maquina}`,
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
        h('button', { class: 'btn btn-cinza', onclick: () => nav.go('producao') }, h('span', { class: 'ico' }, '📊'), A.ehAdm() ? 'Produção' : 'Minha produção'),
        A.ehAdm() ? h('button', { class: 'btn btn-cinza', onclick: () => nav.go('usuarios') }, h('span', { class: 'ico' }, '👥'), 'Usuários') : null,
        A.ehAdm() ? h('button', { class: 'btn btn-cinza', onclick: () => nav.go('maquinas') }, h('span', { class: 'ico' }, '🚜'), 'Máquinas') : null),
      sync.el,
      h('div', { class: 'versao' }, `Versão ${VERSAO}`)));
});
