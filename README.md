# Nuvio Community Config

Reusable US collections, streaming-service folders, numbered landscape Top 10 charts, and a TV appearance preset. Includes an **experimental** service-hub catalog backend for developers.

This is a community setup, not an official Nuvio release. It does not provide movies, playback streams, subscriptions, or Real-Debrid access.

## Choose what to use

| Package | What you get | Status |
| --- | --- | --- |
| Collection templates | 20 collections, 918 folders, 3,612 catalog/query sources; 22 streaming-service tiles | Derived from a saved account configuration; requires your own addons and client verification |
| TopX recipe | 2 general US charts and 18 service charts, all landscape | Recipe for your own TopX configuration; no shared account URL |
| TV appearance | Modern layout, hero enabled, backdrop expansion, Bttr IMDb poster pattern | Saved-state verified; physical Fire TV/LG rendering still needs testing |
| Optional Home template | Movies Top 10 first, Series Top 10 second, Streaming Services third | Explicit opt-in because it replaces Home row preferences |
| Experimental service hub | Catalog Worker with 22 services, 723 category definitions, caching and bounded requests | Prototype; not deployed or a finished native TV interface |

## Start here

1. **Export a backup of your own Nuvio profile** in [Kaptain Studio](https://kaptain.stream/studio). Test in a spare profile first. Imports replace the collections they contain; they do not merge arbitrary personal folders.
2. Configure your own addon at [TopX](https://topx.stremio-italia.eu/). The exact catalog IDs and display options are in [the US landscape recipe](config/topx-us-landscape.json). Set all 20 charts to **landscape**, classic style, black canvas, with the recipe's remaining options. These are configuration values; this repository does not assume the configurator supports uploading this JSON.
3. Install that TopX addon in your test profile. Open its HTTPS manifest JSON and copy the top-level `id`, such as `com.topx.YOUR_ID`. Keep the same catalog IDs from the recipe: the collection references depend on them.
4. Set up your own [BetterPosters](https://btttr.cc/configure) catalog addon if you want the two global Top 25 folders. Its manifest ID must be `community.betterposters` for those references. The Bttr poster URL itself selects IMDb with `rs=IM`; it needs no RPDB key. If the provider changes its manifest ID, update those two source references before importing.
5. Download this repository (Code → Download ZIP) and extract it, or clone it. With Node.js 20+ installed, open a terminal in its root. No npm dependency installation is required:

   ```sh
   node scripts/generate.mjs --topx-addon-id com.topx.YOUR_ID --profile-id 1
   ```

   Replace both example values. `profile-id` is the positive numeric `profileId` in **your own Studio backup**. Do not upload that backup to GitHub. The script creates `generated/collections.json` and `generated/studio-import.json`; it refuses to overwrite existing files.
6. For collections only, import `generated/collections.json` through your normal Nuvio collection import. For collections **plus the TV appearance preset**, import `generated/studio-import.json` in Studio → Backups & Updates, then Restore the imported item. That file contains collections and a small TV appearance settings group; no addons, playback settings, credentials or watch history are included.
7. In Home controls, place the general movie chart first, series chart second, and Streaming Services third. Keep collection pins off. Hide the duplicate “Top 10 in the US - JustWatch” collection and standalone service-chart rows on Home; those sources remain available inside the service folders. Alternatively, regenerate into a fresh output folder with `--include-home` to explicitly include the supplied Home arrangement. **That option replaces Home preferences**, including any unrelated Home row choices.
8. Fully close and reopen Nuvio on every device and select the target profile. Verify the hero, GIF-on-focus behavior, rank artwork, service navigation, title details and playback before using your main profile.

Each person supplies their own TMDB/Trakt integration where their client requires it, metadata addons and playback addons. Existing Real-Debrid setup remains separate. The repository contains no Real-Debrid keys and the experimental addon does not accept them.

## What the design preserves

- Streaming-service tiles retain static covers and GIF URLs, with GIFs enabled for all 22 service tiles. Clients decide whether/how to animate on focus; this cannot force animation support on every platform.
- Bttr stays available on Home and other supported screens. Landscape chart artwork avoids the portrait-only global poster replacement observed on Windows. Client implementations and versions differ; this is a workaround, not a universal per-row override API.
- Top 10 sources sit first within the nine services with supported US charts: Netflix, Prime Video, Apple TV+, Disney+, HBO Max, Hulu, Paramount+, Peacock and Crunchyroll. The other 13 services retain browsing categories without invented rankings.
- General charts use JustWatch via TopX; service charts use the FlixPatrol-backed TopX catalog IDs. These are provider charts, not audited viewership figures. Poster badges from a different provider may describe a different ranking. Freshness is controlled by the upstream provider.
- All source definitions are retained. The current configuration moves 897 source definitions into 132 overflow folders in **More Browsing**, limiting the main folder source lists to eight. This is a temporary organization, not a completed single-page native service hub. Restoring all categories inside each main service may increase entry-time loading on clients that fetch them all.
- Most non-service GIF flags remain disabled from the browsing-performance pass. The 22 service GIF flags and Modern TV appearance were deliberately restored; enabling all visual features everywhere is not presented as a performance fix.

## Performance and platform limits

Cover URLs request bounded-size WebP artwork through an external image proxy. Existing providers retain control of caching, availability and image quality. Source count reductions at entry are configuration changes; they cannot implement native list virtualization, focus restoration, image decoding limits, scroll-to-top behavior or a shared responsive UI engine.

Desktop, Android/Fire TV and webOS clients use different implementations and settings mappings. Use the [platform checklist](docs/platform-checklist.md) to test them independently. No universal smoothness claim is made. In particular, there are **no physical TV memory, frame-time or playback-start benchmarks** in this release.

## Developers

```sh
npm test
npm run validate
cd experimental/service-hub
npm run build
npm test
npm run validate
node scripts/dev.mjs
```

Read [the prototype README](experimental/service-hub/README.md) before hosting or installing it. The preview runs on `127.0.0.1:8787`. It is separate from the collection templates and makes no changes to a Nuvio account.

## Privacy, rollback and attribution

Public files are generated from an explicit collection/appearance allowlist. They contain public artwork references, catalog IDs and filters, with newly assigned generic collection/folder/source IDs. They exclude original account exports, addon installation URLs, personal Home addon references, account/profile names, tracker/watch history, API keys and hosting account metadata. Generated presets are ignored by Git.

To undo an import, restore your own pre-import Studio backup and reopen Nuvio. An addon backend cannot undo or modify a native client build.

Code and original documentation are MIT licensed. Third-party artwork, trademarks, catalog data, provider APIs and Nuvio/Kaptain/TopX/Bttr software remain subject to their owners' rights and terms; the code license does not relicense them. This project references remote artwork and does not redistribute image binaries. See [attribution](docs/attribution.md).
