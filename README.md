# Nuvio Simple Config — no VM

**[Download this branch as a ZIP](https://github.com/AMurtadaa/nuvio-community-config/archive/refs/heads/simple-config.zip)** · **[Step-by-step setup guide](docs/setup-guide.md)**

This branch keeps each streaming service's browsing categories inside its own folder. **More Browsing is removed.** You use your existing Nuvio app and native catalog integrations. There is no server to set up, no hosted addon to install, and no laptop that must stay on.

This is a community configuration, not an official Nuvio release. It does not provide video streams, subscriptions, debrid access or API credentials.

## The quickest way to use it

1. **Export a backup** of your target profile in [Kaptain Studio](https://kaptain.stream/studio). Use a spare profile first; the import replaces the profile's collection list.
2. Download the ZIP using the link above and **extract all files**.
3. Double-click **`setup.html`**. It opens a local setup tool in your browser. No Node installation or terminal is needed.
4. In the tool, choose **`config/collections.template.json`** from the extracted folder. Enter your numeric `profileId`, found in your own Studio backup opened locally in a text editor. Do not give the setup tool your private backup.
5. Choose optional extras. Leave TopX blank if you do not use it. Home ordering and TV appearance are separate opt-ins.
6. Click **Check my choices → Download Studio import**.
7. In Studio, select that profile → **Backups & Updates → Import backup file**. Select the downloaded file, then click **Restore** on the imported item.
8. Fully close and reopen Nuvio, select the profile, and test a service folder, details and playback.

The setup tool reads the public template locally and downloads a file. It does not log in, upload your data, install addons, apply the import or ask for credentials. The generated file must be restored manually. See the [full guide](docs/setup-guide.md) if any step is unfamiliar.

## What you get

| Item | Included |
| --- | --- |
| Streaming services | 22 folders, with their original categories back inside them |
| More Browsing | Removed; all 897 overflow source positions returned to their owners |
| Full source template | 19 collections, 786 folders, 3,612 native/direct sources |
| Service source definitions | 741 total, including optional service charts |
| Service artwork | Existing static covers and GIF URLs/flags retained |
| Top 10 charts | Optional; your own TopX addon is required |
| Global BetterPosters Top 25 folders | Optional; your own compatible BetterPosters addon is required |
| Home ordering | Optional; replaces Home preferences if selected |
| TV appearance | Optional; changes only the supplied TV appearance settings group |
| Playback, credentials, watch history | Not included or configured |

If you omit optional chart/BetterPosters sources, the tool deliberately removes those references and any folders left empty by that choice. It reports the exact resulting counts. All 22 service folders remain. With both optional providers included, all 3,612 source positions are retained; with neither, there are 3,590.

The services are Netflix, Apple TV+, Hulu, Prime Video, AMC+, Crave, Criterion, Crunchyroll, Curiosity Stream, Discovery+, Disney+, Hayu, HBO Max, Magellan, MGM+, Mubi, Paramount+, Peacock, Pluto TV, Shudder, Starz and Tubi TV. The saved watch-region filters are **US**; this package does not automatically adapt service availability to other countries.

## Understand the trade-off

This branch removes server setup, but it also removes the hosted cache. Nuvio fetches categories using its existing TMDB, Trakt and addon integrations. A client may fetch many categories when you open a service, so restoring them all can increase initial loading on a low-powered TV.

This configuration does **not** add native lazy loading, a shared cache, eight-item response limits, continuous horizontal fetching or new remote-focus behavior. Shelf length, paging, GIF animation, hero banners and scroll restoration depend on the client/version and device settings. No universal smoothness claim is made.

For the optional cached VM setup, use the separate [main branch](https://github.com/AMurtadaa/nuvio-community-config/tree/main). Nothing in this simple branch requires that deployment, its endpoint or its code. Publishing this branch does not change an existing hosted installation.

## What's in the ZIP?

| Path | Purpose |
| --- | --- |
| `setup.html` | Local, browser-based setup tool; start here |
| `scripts/setup.js`, `scripts/preset.js`, `scripts/defaults.js` | Tool logic and public defaults |
| `config/collections.template.json` | Restored source template; choose this in the setup tool, do not import it directly with unresolved placeholders |
| `config/home.template.json` | Optional Home arrangement |
| `config/tv-appearance.json` | Optional TV appearance preset |
| `config/topx-us-landscape.json` | Recipe for configuring your own TopX charts |
| `docs/setup-guide.md` | Detailed setup, testing and recovery instructions |
| `docs/attribution.md` | Providers, artwork references and rights |
| `scripts/generate.mjs` | Optional command-line generator for Node users |
| `test/`, `.github/workflows/validate.yml` | Automated checks and GitHub CI |

## Optional command-line method

Node.js 22+ is needed only for this method or development. No npm dependency installation is required. From the extracted repository root:

```sh
node scripts/generate.mjs --profile-id 1
```

Replace `1` with your own profile ID. This basic command omits optional TopX and BetterPosters sources and leaves Home/appearance unchanged. To include everything, after installing your own referenced addons:

```sh
node scripts/generate.mjs --profile-id 1 --topx-addon-id com.topx.YOUR_ID --include-betterposters --include-home --include-tv-appearance
```

The flags that change Home and appearance are explicit. Files are saved under `generated/`; the command refuses overwrites. Use `--out generated/another-attempt` for a fresh output folder.

## Testing and recovery

Configuration tests verify source retention, direct queries, optional providers, Home ordering, GIF flags and appearance opt-in. Physical TV/phone performance still needs testing. Developers can run:

```sh
npm test
npm run validate
```

To undo an import, restore your own pre-import Studio backup, then fully reopen Nuvio. Keep backups and credentials out of GitHub. Full instructions and common problems are in [the guide](docs/setup-guide.md).

Original code/documentation are MIT licensed. Third-party artwork, trademarks, APIs, lists and software retain their own rights and terms. See [attribution](docs/attribution.md).
