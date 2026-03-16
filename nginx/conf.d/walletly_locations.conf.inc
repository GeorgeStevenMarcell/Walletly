# Shared location blocks — included by both HTTP and HTTPS server blocks

# ── API proxy → backend ───────────────────────────────────────────────────────
location /api/ {
    proxy_pass         http://backend;
    proxy_http_version 1.1;
    proxy_set_header   Connection        "";
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;

    proxy_connect_timeout  10s;
    proxy_send_timeout     30s;
    proxy_read_timeout     30s;

    # Don't buffer API responses
    proxy_buffering    off;
}

# ── Static assets (JS/CSS chunks with content-hash filenames) ─────────────────
location ~* \.(js|css|woff2?|ttf|eot|otf|ico|png|jpg|jpeg|gif|svg|webp)$ {
    expires     1y;
    add_header  Cache-Control "public, immutable";
    access_log  off;
    try_files   $uri =404;
}

# ── SPA fallback — all other routes serve index.html ─────────────────────────
location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
