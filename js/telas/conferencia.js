// Conferência dos dados na primeira estaca do dia.
import { h, nav, registrarTela, topo, toast } from '../ui.js';
import * as S from '../store.js';
import * as U from '../util.js';

registrarTela('conferencia', async () => {
  const ativo = await S.getAtivo();
  if (!ativo) { setTimeout(() => nav.reset('obra', { primeira: true })); return h('div'); }
  const hoje = U.today();
  const o = ativo.obra;
  const dado = (k, v) => h('div', { class: 'dado' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v || '—'));

  let ocupado = false;
  async function iniciar() {
    if (ocupado) return;
    ocupado = true;
    const ts = Date.now(); // a hora de início da estaca é o momento deste toque
    const crono = await S.getCrono();
    if (!crono) {
      await S.registrarConferencia(ativo, ts);
      await S.iniciarCrono(ts);
      toast('Estaca iniciada');
    }
    nav.reset('principal');
  }

  return h('div', null,
    topo('Confira os dados de hoje'),
    h('div', { class: 'tela' },
      h('div', { class: 'conferencia-box', style: { marginTop: '14px' } },
        dado('Data de hoje', `${U.fmtDate(hoje)} (${U.weekday(hoje)})`),
        dado('Cliente', o.cliente),
        dado('Obra', o.nome),
        dado('Endereço', o.endereco),
        dado('Nº da obra', o.numero),
        dado('Operador', ativo.operador),
        dado('Ajudante(s)', S.fmtAjudantes(ativo.ajudantes)),
        dado('Máquina', ativo.maquina)),
      h('div', { class: 'form' },
        h('button', { class: 'btn btn-verde btn-gigante', onclick: iniciar }, '✔ ESTÁ CERTO – INICIAR'),
        h('button', { class: 'btn btn-laranja btn-gigante', style: { minHeight: '84px' }, onclick: () => nav.go('obra', { depois: 'conferencia' }) }, '✎ ALTERAR DADOS'))));
});
