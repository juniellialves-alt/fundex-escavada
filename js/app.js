// Inicialização do aplicativo.
import { nav } from './ui.js';
import { pedirArmazenamentoPersistente, getCfg, setCfg } from './db.js';
import { iniciarSync, marcarTudoParaReenvio } from './sync.js';
import { carregarSessao, revalidarSessao } from './auth.js';
import { irParaInicio } from './inicio.js';
import './telas/login.js';
import './telas/principal.js';
import './telas/obra.js';
import './telas/conferencia.js';
import './telas/estaca.js';
import './telas/lista.js';
import './telas/ocorrencias.js';
import './telas/producao.js';
import './telas/config.js';
import './telas/usuarios.js';
import './telas/maquinas.js';

// Telas que só mostram dados: são redesenhadas quando chegam novidades da planilha.
const TELAS_DE_CONSULTA = ['principal', 'lista', 'producao', 'dia', 'ocorrencias', 'usuarios', 'maquinas'];

async function iniciar() {
  const inicio = Date.now();
  pedirArmazenamentoPersistente();
  // Versão 1.2: reenvia tudo uma vez, para a planilha receber a coluna "Dados" (usada pelos outros celulares)
  // e apagar as linhas das estacas que já tinham sido excluídas.
  if (!(await getCfg('migrou-1.2'))) { await marcarTudoParaReenvio(); await setCfg('migrou-1.2', true); }
  await carregarSessao();
  await revalidarSessao();
  await irParaInicio();
  // mantém a abertura com o logo por pelo menos 0,9 s
  setTimeout(() => {
    const s = document.getElementById('splash');
    s.classList.add('sai');
    setTimeout(() => s.remove(), 400);
  }, Math.max(0, 900 - (Date.now() - inicio)));
  iniciarSync();
  window.addEventListener('dados-baixados', async () => {
    if (!(await revalidarSessao())) { irParaInicio(); return; } // usuário desativado pelo escritório
    const atual = nav.atual();
    if (atual && TELAS_DE_CONSULTA.includes(atual.nome) && !document.querySelector('.modal-fundo')) nav.refresh();
  });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e)));
}

iniciar().catch(e => {
  console.error(e);
  document.getElementById('app').textContent = 'Erro ao abrir o aplicativo: ' + e.message;
});
