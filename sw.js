// Service Worker — Music Player
const STATIC_CACHE = "mp-static-v1";
const AUDIO_CACHE = "mp-audio-v1";
const STATIC_URLS = ["/", "/index.html"];

// ---------- install ----------
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------- activate ----------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== AUDIO_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ---------- fetch ----------
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith("/stream/")) {
    e.respondWith(handleAudio(req));
    return;
  }

  if (url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(networkFirst(req, STATIC_CACHE));
    return;
  }

  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) {
    // network only
    return;
  }

  e.respondWith(cacheFirst(req, STATIC_CACHE));
});

// ---------- strategies ----------
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

// ---------- audio with range ----------
async function handleAudio(req) {
  const url = req.url;
  const range = req.headers.get("range");
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(url);

  if (cached) {
    const buf = await cached.arrayBuffer();
    const ct = cached.headers.get("Content-Type") || "audio/mpeg";
    if (!range) return audioResponse(buf, ct);
    return rangeResponse(buf, range, ct);
  }

  // fetch full file (بدون range تا کلش رو بگیریم و کش کنیم)
  let fullRes;
  try {
    fullRes = await fetch(url, { headers: { Range: "" } });
  } catch {
    return new Response("Offline and not cached", { status: 503 });
  }
  if (!fullRes.ok) return fullRes;

  const buf = await fullRes.arrayBuffer();
  const ct = fullRes.headers.get("Content-Type") || "audio/mpeg";

  // ذخیره در cache
  cache.put(
    url,
    new Response(buf.slice(0), {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Length": String(buf.byteLength),
        "Accept-Ranges": "bytes",
      },
    })
  );

  if (!range) return audioResponse(buf, ct);
  return rangeResponse(buf, range, ct);
}

function audioResponse(buf, ct) {
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Content-Length": String(buf.byteLength),
      "Accept-Ranges": "bytes",
    },
  });
}

function rangeResponse(buf, range, ct) {
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return new Response("Bad range", { status: 416 });
  const size = buf.byteLength;
  const start = m[1] ? parseInt(m[1], 10) : 0;
  const end = m[2] ? parseInt(m[2], 10) : size - 1;
  const safeEnd = Math.min(end, size - 1);
  const slice = buf.slice(start, safeEnd + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      "Content-Type": ct,
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${start}-${safeEnd}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}