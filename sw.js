const CACHE_NAME = "farm-security-v3";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./192x192.png",
  "./512x512.png"
];

// インストール時にファイルをキャッシュ（1つ失敗しても他は登録する）
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        FILES_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn("キャッシュ失敗（スキップ）:", url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET以外・外部ドメイン・blob等は素通し（録画データの取り扱いに干渉しないため）
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  // HTMLはネットワーク優先：修正版を上げたらすぐ反映され、圏外ならキャッシュで動く
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // それ以外（アイコン等）はキャッシュ優先
  event.respondWith(
    caches.match(req).then((res) => res || fetch(req))
  );
});
