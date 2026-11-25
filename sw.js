// Service worker: guarda o app no celular para abrir e funcionar sem internet.
// Ao publicar uma atualização, aumente a versão abaixo (e em js/versao.js).
const CACHE = 'fundex-escavada-1.4.1';
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'img/logo.svg', 'img/icone-192.png', 'img/icone-512.png', 'img/icone-maskable-512.png', 'img/apple-touch-icon.png',
  'js/app.js', 'js/ui.js', 'js/db.js', 'js/util.js', 'js/store.js', 'js/rows.js', 'js/sync.js', 'js/xlsx.js',
  'js/exportar.js', 'js/versao.js', 'js/auth.js', 'js/inicio.js', 'js/maquinas.js', 'js/config-padrao.js',
  'js/telas/login.js', 'js/telas/usuarios.js', 'js/telas/maquinas.js', 'js/telas/servico.js', 'js/telas/principal.js', 'js/telas/obra.js', 'js/telas/conferencia.js', 'js/telas/estaca.js', 'js/telas/lista.js',
  'js/telas/cartoes.js', 'js/telas/ocorrencias.js', 'js/telas/producao.js', 'js/telas/config.js',
];

// cache: 'reload' busca direto do GitHub, sem pegar cópia velha guardada pelo navegador (o GitHub Pages guarda por 10 min).
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Responde do cache na hora (funciona offline) e atualiza o cache em segundo plano.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const chave = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const salvo = await cache.match(chave, { ignoreSearch: true });
    const rede = fetch(req, { cache: 'no-cache' }).then(resp => {
      if (resp && resp.ok) cache.put(chave, resp.clone());
      return resp;
    }).catch(() => null);
    if (salvo) { e.waitUntil(rede); return salvo; }
    const r = await rede;
    return r || new Response('Sem conexão', { status: 503 });
  }));
});
