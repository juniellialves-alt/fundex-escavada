// Ligação automática à planilha: o endereço do script e o código de acesso ficam aqui TRANCADOS
// (AES-GCM com chave derivada da senha do escritório, PBKDF2-SHA256). Quem lê o código do GitHub não
// consegue abrir; quando alguém entra como "admin" num celular novo, o app destranca e se configura sozinho.
// ATENÇÃO: ao trocar a planilha, o código de acesso ou a senha do escritório, este bloco precisa ser gerado de novo
// (PBKDF2 200.000 iterações + AES-GCM sobre {"url","codigo"}); senão a ligação automática deixa de funcionar
// e o celular precisa ser configurado à mão na tela ⚙.
import { getCfg, setCfg } from './db.js';

const TRANCADO = {
  sal: 'e5afa32626a1f12fc293dc7a0fd3f767',
  iv: 'a8d58fa4aacb919caf21220c',
  dados: '3014044a64dfe091f22cd7eacdaef95b607d3c3571e9cc415f5a3f6a1feabb44d2a5618661c407eabe9d1e88b03be0a4ab9071019b86f5560bc87a20cba6f6e989c29e132775a2dc89e8c6c9f837fcdd38ce79c3588fe2119eac77dc94b52862eaf361c1ec88e8c2f281cd568bab7890a7d6c881daa0ca9ba52682ef6705f0c3debc46dd2a2e23fff82d0d5a3bbd5e93962aabfc48ec7eecc6680aa3b4ca952b36e1f67b',
};
const ITERACOES = 200000;

const bytes = hex => Uint8Array.from(hex.match(/../g).map(x => parseInt(x, 16)));

/** Destranca {url, codigo} com a senha do escritório. Retorna null se a senha não abrir. */
export async function destrancar(senha) {
  try {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(senha || '')), 'PBKDF2', false, ['deriveKey']);
    const chave = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(TRANCADO.sal), iterations: ITERACOES },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const txt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(TRANCADO.iv) }, chave, bytes(TRANCADO.dados));
    return JSON.parse(new TextDecoder().decode(txt));
  } catch (e) { return null; }
}

/** Se o celular ainda não está ligado à planilha, liga com o endereço e o código padrão. Retorna true se configurou agora. */
export async function configurarSeFaltar(senha) {
  if (await getCfg('scriptUrl')) return false;
  const c = await destrancar(senha);
  if (!c || !c.url) return false;
  await setCfg('scriptUrl', c.url);
  await setCfg('codigoAcesso', c.codigo);
  await setCfg('cursores', {});
  return true;
}
