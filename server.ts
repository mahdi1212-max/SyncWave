import { mkdir, unlink } from "node:fs/promises";
import { join, extname, basename } from "node:path";

const MUSIC_DIR = join(import.meta.dir, "music");
await mkdir(MUSIC_DIR, { recursive: true });

const PORT = 3990;

function safeName(name: string) {
  return basename(name).replace(/[\\/:*?"<>|]/g, "_");
}

async function listTracks() {
  const glob = new Bun.Glob("*");
  const out: { name: string; size: number }[] = [];
  for await (const file of glob.scan({ cwd: MUSIC_DIR, onlyFiles: true })) {
    const stat = await Bun.file(join(MUSIC_DIR, file)).stat();
    out.push({ name: file, size: stat?.size ?? 0 });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function mimeFromName(name: string) {
  const ext = extname(name).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".opus": "audio/opus",
    ".webm": "audio/webm",
  };
  return map[ext] ?? "application/octet-stream";
}

// ---------- presence ----------
type Presence = {
  id: string;
  name: string;
  track: string | null;
  time: number;
  playing: boolean;
  ts: number;
};
const clients = new Map<string, Presence>();

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",

  async fetch(req, srv) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ---- WebSocket ----
    if (path === "/ws") {
      const ok = srv.upgrade(req, { data: { id: crypto.randomUUID() } });
      if (ok) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // ---- Service Worker ----
    if (path === "/sw.js") {
      return new Response(Bun.file(join(import.meta.dir, "sw.js")), {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
          "Service-Worker-Allowed": "/",
        },
      });
    }

    // ---- index.html ----
    if (path === "/" || path === "/index.html") {
      return new Response(Bun.file(join(import.meta.dir, "index.html")), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    // ---- لیست آهنگ‌ها ----
    if (path === "/api/tracks") {
      return Response.json(await listTracks());
    }

    // ---- آپلود ----
    if (path === "/api/upload" && req.method === "POST") {
      const form = await req.formData();
      const files = form.getAll("files") as File[];
      const saved: string[] = [];
      for (const f of files) {
        if (!(f instanceof File)) continue;
        const n = safeName(f.name);
        await Bun.write(join(MUSIC_DIR, n), f);
        saved.push(n);
      }
      return Response.json({ saved });
    }

    // ---- حذف ----
    if (path === "/api/track" && req.method === "DELETE") {
      const name = safeName(url.searchParams.get("name") ?? "");
      if (!name) return new Response("Bad request", { status: 400 });
      try {
        await unlink(join(MUSIC_DIR, name));
        return Response.json({ ok: true });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }

    // ---- استریم با Range ----
    if (path.startsWith("/stream/")) {
      const name = safeName(decodeURIComponent(path.slice("/stream/".length)));
      const file = Bun.file(join(MUSIC_DIR, name));
      if (!(await file.exists())) {
        return new Response("Not found", { status: 404 });
      }

      const size = file.size;
      const type = mimeFromName(name);
      const range = req.headers.get("range");

      if (!range) {
        return new Response(file, {
          headers: {
            "Content-Type": type,
            "Content-Length": String(size),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (!m) return new Response("Bad range", { status: 416 });
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : size - 1;
      const chunkSize = end - start + 1;

      return new Response(file.slice(start, end + 1).stream(), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      ws.subscribe("music");
      console.log("✅ client connected");
    },

    message(ws, raw) {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const id = (ws.data as any).id as string;

      // ---- hello: ثبت اسم ----
      if (msg.type === "hello") {
        const name = String(msg.name || "بی‌نام").slice(0, 24).trim() || "بی‌نام";
        clients.set(id, {
          id,
          name,
          track: null,
          time: 0,
          playing: false,
          ts: Date.now(),
        });
        broadcastPresence();
        return;
      }

      // ---- presence: وضعیت پخش ----
      if (msg.type === "presence") {
        const c = clients.get(id);
        if (!c) return;
        c.track = msg.track ? String(msg.track).slice(0, 200) : null;
        c.time = Math.max(0, Number(msg.time) || 0);
        c.playing = !!msg.playing;
        c.ts = Date.now();
        broadcastPresence();
        return;
      }

      // ---- بقیه پیام‌ها (tracks_changed) ----
      ws.publish("music", raw.toString());
    },

    close(ws) {
      const id = (ws.data as any).id as string;
      clients.delete(id);
      broadcastPresence();
      ws.unsubscribe("music");
      console.log("❌ client disconnected");
    },
  },
});

function broadcastPresence() {
  const users = [...clients.values()];
  server.publish("music", JSON.stringify({ type: "presence_list", users }));
}

console.log(`🎵 Music Player: http://localhost:${server.port}`);
console.log(`   Network:      http://192.168.1.13:${server.port}`);
console.log(`   Music dir:    ${MUSIC_DIR}`);