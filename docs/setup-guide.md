# Set up the simple Nuvio package

This guide is for the **simple-config branch**. It does not require Oracle, Cloudflare, SSH, a VM, Docker, a server or a custom Nuvio build. Your laptop is needed only to prepare and import the configuration, not to keep it working afterward.

## 1. What this configuration changes

It puts the categories previously separated under **More Browsing** back inside their original folders. Netflix's categories are inside Netflix, Prime Video's inside Prime Video, and so on. The same restoration is applied to overflow categories outside Streaming Services so that removing More Browsing does not silently discard them.

The complete template has 19 collections, 786 folders and 3,612 source positions. A source is a saved query or catalog/list reference. **It is not a fixed movie library or a video file.** Providers decide which matching titles are available when Nuvio requests it.

The package preserves covers, artwork URLs and the 22 service folders' GIF flags. It does not force the client to animate them. It does not find video streams, configure subscriptions, import watch history or provide credentials.

There is no hosted cache in this branch. The app uses its existing native catalog integrations. Initial folder loading can be heavier because all categories are together again. The VM version and its small cached responses remain a separate option on the main branch.

## 2. What you need

- Nuvio installed, signed in, and using the profile you want to configure.
- Access to [Kaptain Studio](https://kaptain.stream/studio).
- Your normal metadata/catalog integrations working. The saved queries use native TMDB/Trakt support and direct addons; client requirements vary. If your client asks for a TMDB credential or Trakt authorization, configure your own in its supported integration settings.
- Your own playback addons/provider if you want to watch something. This package does not replace that setup.
- A laptop/desktop browser to prepare the file. No developer software is required for the browser method.

TopX and BetterPosters are **optional**. You can skip them and still use all 22 streaming-service folders. Existing Real-Debrid setup stays with your playback addons. Never enter Real-Debrid or TMDB credentials into this package's local tool; it has no credential fields.

## 3. Back up before changing a profile

1. Open Kaptain Studio and sign in to your own Nuvio account.
2. Select the profile you want to configure.
3. Open **Backups & Updates**.
4. Click **Export backup file** and save the JSON privately.
5. Keep that original file somewhere you can find it again.

For your first import, use a spare profile. The generated import **replaces the target profile's collection list**. It does not merge unrelated personal collections or deduplicate a customized profile automatically.

The default generated import contains only collections. Home and TV settings are included only if you select those extras. Installed addons, keys, playback settings and watch history are not included.

## 4. Find your profile ID

Open your exported backup **locally** in a text editor. Find the top-level field:

```json
"profileId": 1
```

Your number may be different. It must be a positive whole number. The profile's display name, such as “Family,” is not the numeric ID.

Do not upload or paste the backup into the setup page. The page needs only the number. Do not post the backup in a GitHub issue.

## 5. Download the correct branch

Use [this ZIP download](https://github.com/AMurtadaa/nuvio-community-config/archive/refs/heads/simple-config.zip), or visit the repository, switch the branch dropdown to **simple-config**, then choose **Code → Download ZIP**.

Extract the entire ZIP. On Windows, right-click → **Extract All**. Open the extracted folder; you should see `setup.html`, `README.md`, `config` and `scripts`. If you see only another folder, open that inner folder.

Do not open `setup.html` from inside the compressed ZIP. Its adjacent scripts must also be extracted. Do not use the main branch's hosted instructions or its `generate-shelves.mjs` script for this package.

## 6. Open the local setup tool

Double-click **setup.html**. If necessary, right-click → Open with Chrome, Edge or Firefox.

The browser address will normally start with `file:///`. That is expected. The tool runs locally, blocks automatic network connections, reads the public template you select and downloads an import file. It does not log in or apply changes to Nuvio.

Inside the tool:

1. Click the file chooser.
2. Open the extracted package's **config** folder.
3. Select **collections.template.json**.
4. Enter your numeric profile ID from step 4.

Choose the supplied public template, **not** your private Studio backup. The raw template contains placeholders for optional addon references. Do not import that raw file directly; let the tool resolve or remove those references first.

## 7. Decide whether you want numbered Top 10 charts

### If you do not use TopX

Leave the **TopX manifest ID** field empty. The tool omits the 20 TopX source references and any folders emptied by that choice. All 22 streaming-service folders remain. You will still have their ordinary browsing categories.

### If you want numbered charts

1. Create/configure your own addon at [TopX](https://topx.stremio-italia.eu/).
2. Use the catalog IDs and options in **config/topx-us-landscape.json**. This is a recipe to follow in the configurator, not a promise that it accepts uploading that JSON file.
3. Use US rankings and **landscape** artwork for all 20 charts. The recipe includes two general charts and movie/series charts for nine supported services.
4. Install that addon in the same Nuvio profile and save the addon changes.
5. Open your own addon's manifest JSON and find its top-level `id`:

   ```json
   "id": "com.topx.YOUR_ID"
   ```

6. Paste that **ID only** into the local setup tool.

Do not paste a URL, API key, login or someone else's saved configuration. The recipe's catalog IDs must match what your own manifest exposes; the package cannot create missing charts in a third-party addon.

The nine services with chart references are Netflix, Prime Video, Apple TV+, Disney+, HBO Max, Hulu, Paramount+, Peacock and Crunchyroll. Other services retain ordinary categories; this package does not invent rankings for them.

General charts use JustWatch-backed TopX IDs; service charts use FlixPatrol-backed IDs. They are provider rankings, not independently audited viewership numbers. A poster's “# Today” badge may use a different ranking and disagree with a chart position.

## 8. Decide whether to include the BetterPosters Top 25 folders

Leave the checkbox off if you do not have that addon. These are two optional global Top 25 folders, separate from the service Top 10s.

To include them, configure/install your own [BetterPosters addon](https://btttr.cc/configure) in the same profile. Its manifest ID must be **community.betterposters** for the supplied references. Enable the checkbox only after checking that ID and addon availability. If the provider changes it, leave the extra off until its source references are updated.

Using the Bttr **poster URL** is different from installing its **catalog addon**. A poster pattern changes images; it does not automatically supply these two lists.

If both TopX and these two global lists are omitted, the tool retains 3,590 source positions. If both are included, it retains all 3,612. It displays the actual counts for your choices before you download.

## 9. Decide whether to replace Home ordering

The **Apply the supplied Home row order** checkbox is off by default.

If enabled with TopX configured, the supplied configured-content rows begin:

1. US Top 10 Movies.
2. US Top 10 Series.
3. Streaming Services.

Without TopX, Streaming Services is first. Client-controlled elements such as a hero or Continue Watching can still have their own placement.

This option **replaces Home preferences**, including unrelated custom row choices. It keeps the duplicate chart collection hidden. It does not necessarily hide every standalone row from other addons already installed on your account; review those in Studio afterward.

If you leave it off, arrange Home manually after import. Newly added collection visibility can vary by client. In Studio's Home controls, enable Streaming Services and the other collection rows you want, hide unwanted duplicates, and place them in your preferred order. Keep collection pins off if they interfere with your ordering.

## 10. Decide whether to change TV appearance

The **Apply the optional TV appearance preset** checkbox is also off by default. Leave it off to retain your existing appearance.

If enabled, the supplied TV appearance group includes:

- Modern layout.
- Hero section enabled.
- Focused poster backdrop expansion enabled.
- The Bttr IMDb poster URL pattern on its listed supported screens.

It does not add playback/debrid settings, credentials or watch history. It does not configure desktop/phone settings or override every device-local image/performance preference.

The Bttr pattern requests IMDb using `rs=IM`. That does not guarantee an identical score to another provider at the same moment. The package does not fetch RPDB ratings or invent IMDb ratings from TMDB votes.

Landscape numbered charts are the observed workaround for a portrait-only poster override on Windows. Different clients can render them differently. This is not a universal per-row poster exception setting.

## 11. Generate and download

Click **Check my choices**. Read the summary:

- It should show 22 streaming services.
- It should say there is no More Browsing and no hosted addon.
- Counts depend on your optional providers.
- Home and TV appearance should say “unchanged” unless you deliberately selected them.
- The profile ID must match your target profile.

Click **Download Studio import**. Save `nuvio-simple-studio-import.json`.

The **Download collections only** button is for clients/importers supporting plain collection-array JSON. It excludes profile ID, Home preferences and settings. The Studio import is the recommended route in this guide.

If you edit a choice, the download buttons disable until you check again. This prevents downloading an old result after changing your options. If your browser blocks the download, allow downloads for this local page or use the optional CLI method below.

## 12. Import and apply it

In Kaptain Studio:

1. Select the profile matching the generated file's profile ID.
2. Open **Backups & Updates**.
3. Click **Import backup file**.
4. Choose `nuvio-simple-studio-import.json`.
5. Find the imported **Simple Nuvio service folders - no VM** item.
6. Click **Restore** and confirm.
7. Wait for the success message.

**Importing into the backup list does not apply the file. Restore is required.**

Fully close and reopen Nuvio on the device you want to test. Select the same profile. You do not need to leave the local setup page or laptop running.

## 13. Check the result

Open Streaming Services → Netflix, then try another service:

- Its browsing categories should be inside the service folder.
- More Browsing should be absent.
- Optional Top 10 sources should appear first in the supported service folders if configured.
- Open a category, browse beyond the initial items, and open a title.
- Check details, stream discovery and playback using your existing addons.
- Go Back and check focus/scroll restoration.
- Check service covers, GIF behavior and the Home banner separately.

Repeat on each actual device. On Fire TV use the remote; on LG test the installed webOS client; on a phone test touch and returning from details. Record the client version when reporting problems.

This branch does not force eight-item shelves or automatic horizontal pagination. Native page sizes and shelf behavior apply. On Windows, a category arrow may be the way to reach a larger list. On other clients, paging and navigation can differ. No smoothness or identical-layout guarantee is made for every platform.

## 14. Common problems

**“More Browsing is still there.”** Check that you downloaded the **simple-config** branch, generated a new file, restored it into the right profile, and reopened Nuvio. The old main-branch configuration-only generator used an overflow layout.

**“The setup page doesn't work.”** Extract the whole ZIP, keep the `scripts` folder next to `setup.html`, use a regular browser, and select the correct public template. Do not open it inside the ZIP. Browser extensions or security policies may block local scripts; use the optional CLI instead of disabling browser security.

**“Top 10 folders are blank.”** Install your own TopX addon in this profile; verify its manifest ID, exact catalog IDs and supported chart configuration. If you do not want that dependency, regenerate with TopX blank. Save addon changes as well as restoring the collections.

**“Ordinary categories are blank.”** Check your client's native TMDB/Trakt integration and any required metadata addons. The package contains query/list references, not credentials or a substitute provider server. Some US-specific service/filter combinations can legitimately return no matches.

**“The service takes longer to open.”** This is the direct-loading version. A client can request many categories immediately. This configuration cannot impose server caching or native lazy loading. Keep the layout if you prefer the simpler setup, use device-local image/performance options thoughtfully, or consider the separate hosted version if the direct-loading cost is unacceptable.

**“GIFs or the hero differ on my TV.”** The 22 service GIF flags are retained, but animation and hero support/settings differ by client. The appearance checkbox changes only the supplied TV settings group. Check the actual client settings and profile sync; a configuration file cannot add a missing native feature.

**“I see duplicate Home rows.”** If you kept Home unchanged, arrange the new rows manually. If you used the supplied Home preset, review standalone rows from your own installed addons; the package cannot know all of those account-specific rows.

**“Playback doesn't work.”** This is a catalog configuration. Check your playback addon and provider independently. Do not enter Real-Debrid credentials in the local tool or upload them to GitHub.

## 15. Undo the import

Select the same profile in Studio → Backups & Updates → restore your own pre-import backup. Then reopen Nuvio. If you installed optional addons during setup and no longer want them, disable/remove those deliberately after checking whether other folders use them.

There is no VM to stop and no shared service to uninstall for this branch. Restoring a backup is the recovery path; deleting collection folders manually is not required.

## Optional: use Node instead of the browser tool

Install Node.js 22 or newer from [the official Node website](https://nodejs.org/en/download). From the extracted repository root:

```sh
node scripts/generate.mjs --profile-id 1
```

Replace the profile ID. To include optional providers and layout choices:

```sh
node scripts/generate.mjs --profile-id 1 --topx-addon-id com.topx.YOUR_ID --include-betterposters --include-home --include-tv-appearance
```

The flags have the same meaning as the browser checkboxes. Outputs are `generated/studio-import.json` and `generated/collections.json`. The command refuses to overwrite existing files; add `--out generated/second-attempt` to use a new folder. No `npm install` is needed.

Both methods use the same preset builder. They generate files only and do not contact Nuvio or alter your account. Apply the file using the same Studio Restore steps above.
