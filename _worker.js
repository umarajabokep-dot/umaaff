export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---- Health check
    if (pathname === "/health") return new Response("ok");

    // ---- Helper: load links.txt dari GitHub + edge cache 60s
    async function loadLinks() {
      const RAW_URL = "https://raw.githubusercontent.com/Hecate1337-py/shopeeaff/main/links.txt";
      const cache = caches.default;
      const cacheKey = new Request(RAW_URL, { cf: { cacheTtl: 60 } });

      let res = await cache.match(cacheKey);
      if (!res) {
        res = await fetch(cacheKey, { cf: { cacheTtl: 60 } });
        if (!res.ok) throw new Error("Failed to load links.txt");
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }
      const text = await res.text();
      const lines = text
        .split("\n")
        .map(l => l.trim().replace(/[\u0000-\u001F\u007F]/g, "")) // bersihin control chars
        .filter(Boolean);
      if (!lines.length) throw new Error("No links available");
      return lines;
    }

    // ---- /proof : halaman bukti yang menampilkan link affiliate (untuk form Shopee)
    if (pathname === "/proof") {
      // Link yang stabil untuk bukti (ENV > baris pertama links.txt > fallback Shopee)
      let aff = (env && env.SHOPEE_AFF_LINK) || "";
      if (!aff) {
        try {
          const lines = await loadLinks();
          aff = lines[0];
        } catch {
          aff = "https://shopee.co.id/";
        }
      }
      // Validasi sederhana
      let safe = "https://shopee.co.id/";
      try {
        const u = new URL(aff);
        if (!/^https?:$/.test(u.protocol)) throw 0;
        safe = u.toString();
      } catch {}

      const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Shopee Affiliate – Promo</title>
<style>
:root{--brand:#ee4d2d}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:40px;text-align:center;color:#111}
.wrap{max-width:760px;margin:0 auto}
.btn{display:inline-block;padding:12px 22px;background:var(--brand);color:#fff;border-radius:10px;text-decoration:none;font-weight:600}
.note{color:#666;font-size:14px;margin-top:14px}
.box{margin-top:24px;padding:12px 16px;background:#fafafa;border:1px solid #eee;border-radius:10px;word-break:break-all}
header{margin-bottom:24px}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Promo Shopee</h1>
      <p>Halaman ini digunakan untuk verifikasi partisipasi program afiliasi.</p>
    </header>
    <p><a class="btn" href="${safe}" target="_blank" rel="noopener noreferrer">Belanja di Shopee</a></p>
    <div class="box"><strong>Tautan afiliasi:</strong><div>${safe}</div></div>
    <p class="note">Tangkapan layar halaman ini digunakan sebagai bukti sesuai permintaan formulir.</p>
  </div>
</body>
</html>`;
      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "Cache-Control": "no-store"
        }
      });
    }

    // ---- /preview : opsional, tampilkan seluruh link untuk pengecekan manual
    if (pathname === "/preview") {
      try {
        const links = await loadLinks();
        const html = `<!doctype html><meta charset="utf-8">
<title>Preview Links</title>
<body style="font-family:system-ui;padding:20px">
<h2>Daftar Link Affiliate</h2>
<ol>${links.map(l => `<li><a href="${l}" target="_blank" rel="noopener noreferrer">${l}</a></li>`).join("")}</ol>
</body>`;
        return new Response(html, { headers: { "content-type": "text/html; charset=UTF-8" } });
      } catch (e) {
        return new Response(String(e?.message || e), { status: 500 });
      }
    }

    // ---- Default: redirect acak dari links.txt
    try {
      const lines = await loadLinks();
      const selected = lines[Math.floor(Math.random() * lines.length)];

      let target;
      try {
        const u = new URL(selected);
        if (!/^https?:$/.test(u.protocol)) throw 0;
        target = u.toString();
      } catch {
        return new Response("Invalid link in links.txt", { status: 400 });
      }

      return new Response(null, {
        status: 302,
        headers: {
          "Location": target,
          "Cache-Control": "no-store"
        }
      });
    } catch (e) {
      return new Response(String(e?.message || e || "Internal Error"), { status: 502 });
    }
  }
}
