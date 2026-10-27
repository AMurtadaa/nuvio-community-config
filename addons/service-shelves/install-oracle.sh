#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
hostname=${1:?Usage: sudo bash install-oracle.sh YOUR_HTTPS_HOSTNAME}
[[ "$hostname" =~ ^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$ ]] || { echo "Use a hostname without https:// or a path"; exit 1; }
case "$(uname -m)" in aarch64) arch=arm64;; x86_64) arch=x64;; *) echo "Unsupported architecture"; exit 1;; esac
caddyarch=$arch
test "$arch" != x64 || caddyarch=amd64
getent passwd nuvio >/dev/null || useradd --system --home-dir /var/lib/nuvio-shelves --shell /sbin/nologin nuvio
getent passwd caddy >/dev/null || useradd --system --home-dir /var/lib/caddy --shell /sbin/nologin caddy
install -d -m 755 /opt/nuvio-shelves /opt/nuvio-runtime /etc/caddy
install -d -m 700 -o nuvio -g nuvio /var/lib/nuvio-shelves
install -d -m 700 -o caddy -g caddy /var/lib/caddy
install -m 644 core.mjs server.mjs feeds.json setup.html package.json /opt/nuvio-shelves/
stage=$(mktemp -d /var/tmp/nuvio-install.XXXXXX)
trap 'rm -f "$stage"/*; rmdir "$stage"' EXIT
cd "$stage"
curl -fsSLO https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-${arch}.tar.xz
curl -fsSLo node-SHASUMS.txt https://nodejs.org/dist/v24.22.1/SHASUMS256.txt
grep " node-v24.22.1-linux-${arch}.tar.xz$" node-SHASUMS.txt | sha256sum -c -
tar -xJf node-v24.22.1-linux-${arch}.tar.xz --strip-components=1 -C /opt/nuvio-runtime
curl -fsSLO https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_linux_${caddyarch}.tar.gz
curl -fsSLo caddy-checksums.txt https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_checksums.txt
grep " caddy_2.11.7_linux_${caddyarch}.tar.gz$" caddy-checksums.txt | sha512sum -c -
tar -xzf caddy_2.11.7_linux_${caddyarch}.tar.gz caddy
install -m 755 caddy /usr/local/bin/caddy
cat >/etc/systemd/system/nuvio-shelves.service <<'UNIT'
[Unit]
Description=Nuvio Service Shelves metadata addon
After=network-online.target
Wants=network-online.target
[Service]
User=nuvio
Group=nuvio
WorkingDirectory=/opt/nuvio-shelves
Environment=PORT=8790
Environment=CACHE_DIRECTORY=/var/lib/nuvio-shelves/cache
Environment=TMDB_SECRET_FILE=/var/lib/nuvio-shelves/tmdb.json
ExecStart=/opt/nuvio-runtime/bin/node --max-old-space-size=256 /opt/nuvio-shelves/server.mjs
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
MemoryMax=512M
TasksMax=64
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/nuvio-shelves
[Install]
WantedBy=multi-user.target
UNIT
sed "s/__ADDON_HOST__/$hostname/g" >/etc/caddy/Caddyfile <<'CADDY' 
__ADDON_HOST__ {
 encode zstd gzip
 @catalog path /manifest.json /catalog/*
 handle @catalog {
  reverse_proxy 127.0.0.1:8790 {
   header_up Host 127.0.0.1:8790
  }
 }
 handle / {
  respond "Nuvio Service Shelves metadata addon. Install using /manifest.json." 200
 }
 handle {
  respond "Not found" 404
 }
}
CADDY
cat >/etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=HTTPS for Nuvio metadata addon
After=network-online.target
Wants=network-online.target
[Service]
User=caddy
Group=caddy
Environment=HOME=/var/lib/caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
Restart=on-failure
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/caddy
MemoryMax=192M
[Install]
WantedBy=multi-user.target
UNIT
/usr/local/bin/caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl daemon-reload
systemctl enable --now nuvio-shelves caddy
firewall-cmd --permanent --add-service=http --add-service=https
firewall-cmd --reload
/opt/nuvio-runtime/bin/node --version
/usr/local/bin/caddy version
systemctl is-active nuvio-shelves caddy
curl --fail --silent http://127.0.0.1:8790/health.json
