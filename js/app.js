// Inicialização do aplicativo.
import { nav } from './ui.js';
import * as S from './store.js';
import { pedirArmazenamentoPersistente } from './db.js';
import { iniciarSync } from './sync.js';
import './telas/principal.js';
import './telas/obra.js';
import './telas/conferencia.js';
import './telas/estaca.js';
import './telas/lista.js';
import './telas/ocorrencias.js';
import './telas/producao.js';
import './telas/config.js';

async function iniciar() {
  const inicio = Date.now();
  pedirArmazenamentoPersistente();
  const ativo = await S.getAtivo();
  if (ativo) await nav.reset('principal');
  else await nav.reset('obra', { primeira: true });
  // mantém a abertura com o logo por pelo menos 0,9 s
  setTimeout(() => {
    const s = document.getElementById('splash');
    s.classList.add('sai');
    setTimeout(() => s.remove(), 400);
  }, Math.max(0, 900 - (Date.now() - inicio)));
  iniciarSync();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e)));
}

iniciar().catch(e => {
  console.error(e);
  document.getElementById('app').textContent = 'Erro ao abrir o aplicativo: ' + e.message;
});
