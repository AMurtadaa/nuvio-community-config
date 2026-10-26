# Experimental Service Hub (0.1.0)

Dependency-free Stremio/Nuvio **catalog-only** Worker with a local browser preview. It is not a finished native Nuvio service page and has not been installed into the source profile. No hosted manifest URL is included.

Implemented: 22 services and 723 category definitions, service-specific movie/series manifests, 20-item browse pages, nine supported chart pairs, three simultaneous upstream requests, 24 queued requests, eight-second upstream deadlines, in-flight deduplication, 128-entry/12-MiB isolate cache, five-minute chart TTL, 30-minute browse TTL, and stale recovery for up to six hours. Provider errors are not cached as empty successes. No stream, meta, subtitle or global search resources are implemented. Details and playback stay with the user's existing addons.

## Local use

Node.js 20+; no dependency installation:

```sh
npm run build
npm test
npm run validate
npm run dev
```

Preview: `http://127.0.0.1:8787`. Example endpoints: `/manifest.json`, `/service/netflix/manifest.json`, `/catalog/movie/netflix.browse/genre=Popular&skip=20.json`.

The local dev script explicitly enables a limited public preview for Netflix, Disney+ and Prime Video unless `ALLOW_PUBLIC_PREVIEW=false`. It does not reproduce every original custom filter. The production Worker default has that fallback disabled. Unsupported credential-dependent cases return configuration-required errors.

## Supply your own provider configuration

- The 716 TMDB-backed categories require `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` in the server environment. Seven Trakt categories require `TRAKT_CLIENT_ID`.
- Replace `topxBase` in `worker/config.json` with the base of your own TopX HTTPS manifest URL (remove the final `/manifest.json` or `/nuvio.json`, as appropriate, preserving its configuration path). Keep the chart IDs matching the root recipe and rebuild. The distributed URL is a placeholder, so live chart checks will fail until configured.
- The shared unit tests use mock provider responses. `node test/live.mjs` is an optional network test after configuring TopX, covering 18 charts and the limited public preview. Provider availability and page contents can change. The original prototype had 22 unit tests and 23 live checks; that historical result does not validate your new deployment or all 723 categories.
- Never put TMDB/Trakt secrets into tracked JSON, URL parameters exposed to users, or the browser UI. Keep `.env` local/ignored and configure backend secrets with your host. Real-Debrid credentials are neither needed nor accepted here.

`npm run build` emits an ESM Worker with `default.fetch` to `dist/server/index.js`. Choose a compatible Worker host and configure environment secrets there. No original hosting project ID, deploy token or provider account is shipped. This repository does not automatically deploy a service.

## Limits before rollout

Isolate caching is best-effort; cold starts reset it. Provider/hosting quotas and terms still apply. No native category selector is injected into Nuvio folders. No TV focus/scroll fix or measured frame-time improvement is claimed. TMDB IDs require testing with actual metadata and playback addons; the Worker does not fan out per-item ID conversions or label TMDB vote averages as IMDb.

Keep the existing collections. Test one optional service catalog in a spare native-client profile, including categories, unavailable-provider recovery, posters, details and playback. Only migrate the temporary More Browsing folders once all categories remain reachable and native navigation works. See the root platform checklist and attribution before publishing a hosted instance.
