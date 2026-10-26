# Device verification and troubleshooting

Use a spare profile, keep your backup and record the client version. Account-setting verification is distinct from seeing a result on a physical TV.

| Check | Expected behavior | If it differs |
| --- | --- | --- |
| Home order | General movie chart, general series chart, then Streaming Services among configured content rows | Clear collection pins; inspect Home order/sync and any local ordering option |
| Number art | Landscape numbered items within chart feeds | Check TopX `shape=landscape`; check whether the client respects poster shape and its poster-override rules |
| Other posters | Bttr IMDb pattern on supported screens | Verify URL ends with `?rs=IM`; score freshness and title matching still belong to the provider |
| Hero above Continue Watching | Modern layout and hero setting enabled | Check both settings, selected profile and sync; check that hero/catalog data is available; restart before assuming a client defect |
| Service GIFs | 22 service folders have `focusGifEnabled=true` and an existing GIF URL | Check local Load GIFs/performance preferences, focus versus hover, image availability and client support |
| Opening a service | Supported Top 10 sources first within that folder | Some clients restore the last focused row/scroll position; a config cannot universally force top-of-page entry |
| Real-Debrid playback | User's own playback addon resolves the selected title | Keep keys in the playback addon; a catalog/appearance import does not add or configure debrid |

Repeat on Windows/macOS/Linux clients, Fire TV/Android TV and LG webOS as applicable. Check cold start, warm start, rapid remote navigation, back-navigation focus, reconnect after network loss, empty/error catalogs and memory pressure. Do not remove content or disable expected visuals as a substitute for measuring performance.

The source configuration was corrected by restoring Modern layout, hero enabled, backdrop expansion and all 22 service GIF flags from the pre-performance backup. Changing only the hero-enabled flag had been insufficient because Classic layout and disabled GIF flags remained. The public preset guards these settings in validation. It does not prove that an unavailable physical Fire TV displays the hero or animations.

There is no need to install a custom Nuvio build for these collection and appearance settings. A genuinely unified native service page with robust remote focus, scrolling and adaptive rendering may require changes in the relevant clients; a catalog addon alone cannot inject that interface.
