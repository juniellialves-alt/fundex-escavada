// Banco de dados local (IndexedDB). Tudo fica salvo no celular.
const DB_NAME = 'fundex-escavada';
const VERSAO = 3; // 2: usuários; 3: máquinas
export const STORES = ['config', 'obras', 'estacas', 'ocorrencias', 'conferencias', 'alteracoes', 'usuarios', 'maquinas'];

let dbp = null;
function abrir() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, VERSAO);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'config' ? 'key' : 'id' });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await abrir();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    let out;
    const r = fn(t.objectStore(store));
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const db = {
  get: (s, k) => tx(s, 'readonly', st => st.get(k)),
  all: s => tx(s, 'readonly', st => st.getAll()),
  put: (s, v) => tx(s, 'readwrite', st => st.put(v)),
  del: (s, k) => tx(s, 'readwrite', st => st.delete(k)),
};

export async function getCfg(key, def = null) {
  const r = await db.get('config', key);
  return r === undefined ? def : r.value;
}
export async function setCfg(key, value) { await db.put('config', { key, value }); }

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export async function pedirArmazenamentoPersistente() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignora */ }
}
