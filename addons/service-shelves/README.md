# Service Shelves: keep each service in one place

**Start with the [complete, step-by-step Oracle setup guide](../../docs/oracle-service-shelves-setup.md).** It starts with creating a VM and ends with testing Nuvio. You do not need a custom Nuvio build to try this addon.

This is the Node.js implementation used for the hosted service-folder rollout. It is separate from the older Worker experiment in `experimental/service-hub`.

## What this does

Inside each streaming-service folder, keep short, stacked browsing shelves. The first response contains up to eight titles. Open the category using the client's category arrow/action to browse more. On Windows, scrolling a shelf horizontally does **not** automatically fetch more titles; this addon does not add that missing native behavior.

The supplied preset has 22 services and 709 TMDB Discover definitions. Existing 32 ranked/list sources stay direct. Restoring the overflow folders retains all 3,612 source positions and 786 original folders. The other 321 restored overflow sources outside Streaming Services remain native and do not gain this addon's cache.

```text
Nuvio on your TV / phone / laptop
              |
       HTTPS catalog requests
              |
     Your Oracle VM: Caddy + addon
              |
       Cache hit? Return saved data
       Cache miss? Fetch from TMDB

Video playback: existing Nuvio playback addons + your own provider
               (video does not pass through this VM)
```

## What the server contains

| File | Purpose |
| --- | --- |
| `feeds.json` | Public US catalog definitions; no credentials |
| `restore-map.json` | Moves the public template's overflow sources back to their owners |
| `core.mjs` | Exact query filters, small batches, request limits, cache |
| `server.mjs` | Addon routes and SSH-only credential setup |
| `setup.html` | Private page where the owner enters their TMDB credential |
| `install-oracle.sh` | Oracle Linux 9 installation with systemd and HTTPS |
| `check-live.mjs` | Tests all catalog routes on your own deployment |
| `test/catalog.test.mjs` | Offline automated checks; no real key required |

## Cache and resource limits

- Provider pages contain up to 20 titles and are served in batches of 8, 8, and 4. Offsets advance by the actual number returned.
- Thirty-minute freshness; cached pages may be used up to six hours old while refreshing.
- Identical queries share one cached page and simultaneous identical requests share a fetch.
- Three simultaneous provider requests; 128 waiting requests maximum; eight-second provider and queue timeouts.
- Cache limited to 1,024 entries and 32 MiB of serialized values. Disk writes are coalesced. Expired entries are not served indefinitely.
- Service capped at 512 MiB; Caddy capped at 192 MiB. These are caps, not promises about typical memory use.
- Provider failures are errors, never cached as empty success lists. A genuine zero-match query can return an empty list.
- The cache survives restart. A saved credential can load without TMDB being reachable at startup, allowing cached browsing during a temporary outage.

The addon does not control client rendering, image decoding, GIF defaults, remote focus, native scroll restoration, or how many categories a client initially requests. It does not fix these by itself. Artwork and playback settings are independent.

## Privacy and ownership

Host your own copy and supply your own TMDB credential. This repository contains no shared live endpoint, private keys, account backups, Real-Debrid credentials, or TMDB credentials. Your public address serves catalog metadata without user authentication; anyone who knows it can request that metadata. The private setup page is excluded from that public address.

The credential is saved as `/var/lib/nuvio-shelves/tmdb.json`, mode 600, owned by the `nuvio` service user. It is sent to TMDB for verification and catalog requests. Never publish that file. Never enter a Real-Debrid credential in this setup page.

The addon does not accept watch history or Real-Debrid credentials. TMDB, artwork hosts and your existing playback addons retain their own behavior and terms. The installer pins tested runtime versions; plan maintenance instead of assuming software updates itself.

## Current verification

The initial Oracle ARM deployment passed all 709 catalog-route checks, with one genuinely empty query. Cache and credential survived restart. The Netflix Windows prototype previously passed user browsing and playback tests. The code has 15 backend tests; the repository adds preset-generation regression checks.

Physical LG/webOS, Fire TV and phone testing of the finished hosted preset is still required. No universal animation, frame-rate, memory or playback-start benchmark is claimed.

For setup, see the [full guide](../../docs/oracle-service-shelves-setup.md). For problems and undo instructions, see [troubleshooting and recovery](../../docs/service-shelves-troubleshooting.md).
