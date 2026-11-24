// Decide a primeira tela conforme quem está no app.
import { nav } from './ui.js';
import * as S from './store.js';
import { sessao } from './auth.js';

export async function irParaInicio() {
  const s = sessao();
  if (!s) return nav.reset('login');
  // Operador sem obra definida começa pelos dados da obra; Adm e Ajudante vão direto para a principal.
  if (s.perfil === 'operador' && !(await S.getAtivo())) return nav.reset('obra', { primeira: true });
  return nav.reset('principal');
}
