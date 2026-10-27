# Set up Service Shelves on Oracle Cloud, step by step

This guide assumes you are starting from scratch. Commands marked **Windows** run on your laptop. Commands marked **VM** run after you connect to Oracle with SSH.

You will finish with a catalog addon that runs while your laptop is off, and service folders containing their own categories. It serves browsing information, not video.

## 1. Understand the four pieces

1. **Nuvio** is the app you already use on your devices.
2. **The Oracle VM** is a small computer that stays online and runs the addon.
3. **TMDB** supplies movie and series catalog data. You use your own TMDB API credential.
4. **Your existing playback addons and provider** handle video. Keep that setup separate.

The VM remembers catalog responses in a cache. When another device requests the same category, it can reuse that result instead of repeating the provider request. Smaller initial responses reduce data sent to Nuvio. This does not replace native app performance work.

## 2. What you need before starting

- An Oracle Cloud account and a **fresh, dedicated Linux VM**.
- Your own TMDB API Read Access Token or v3 API key, obtained through your TMDB account's API settings. Read and follow [TMDB's API terms and attribution requirements](https://developer.themoviedb.org/docs/getting-started).
- Your own Nuvio account and access to [Kaptain Studio](https://kaptain.stream/studio).
- A Windows laptop with PowerShell and OpenSSH. A Mac/Linux laptop can use the equivalent `ssh`, `scp`, and Node commands.
- Node.js 24 LTS on the laptop for generating the preset. Download from [the official Node website](https://nodejs.org/en/download), then reopen your terminal and check `node --version`.
- Your own TopX addon if you want the numbered charts in the supplied preset. Follow [the existing chart setup](../README.md#start-here) and [recipe](../config/topx-us-landscape.json).

No Real-Debrid credential is needed by this addon. Do not give it one.

## 3. Create the Oracle VM

In Oracle Cloud Console, open **Compute → Instances → Create instance**. Console wording can change slightly.

Use these settings:

| Setting | Choose |
| --- | --- |
| Name | Any clear name, such as `Nuvio` |
| Region | Your home region if using Always Free resources |
| Operating system | **Oracle Linux 9**, standard image |
| Shape | **VM.Standard.A1.Flex** |
| Size | **1 OCPU, 6 GB RAM** is the tested starting size |
| Capacity | On-demand |
| Networking | A public subnet with a public IPv4 address |
| Boot volume | Default approximately 50 GB is enough |
| Extra data disks | None needed |
| SSH key | Upload your public key, or generate a new pair and save the private key |

Do not select the larger Cloud Developer image for this 6 GB setup. This installer also supports Oracle Linux 9 on x86-64, but the ARM A1 deployment is the one tested on a real VM.

Check the console's eligibility and cost information **before creating anything**. Free capacity depends on your account, region and remaining allowances. Oracle's current documentation lists an A1 allowance equivalent to 2 OCPUs and 12 GB RAM for Always Free tenancies and 200 GB of combined boot/block storage. Do not assume another VM or larger disk is free because this example is small. See [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

If Oracle says **out of host capacity**, the VM has not been created. Another availability domain or trying later may help. Do not select a paid shape merely to get past that message unless you intend to pay.

**Checkpoint:** the instance says **Running**, and you have its public IP, username and matching private-key file.

## 4. Save the connection details

Open the instance details and find **Instance access**. For Oracle Linux, the username is normally `opc`.

Write down these values locally:

```text
Public IP: YOUR_PUBLIC_IP
Username: opc
Private key file: C:\Users\YOUR_NAME\Downloads\YOUR_KEY.key
```

The public key goes on the server. The matching private key stays on your laptop. They are different files. Never upload the private key to GitHub, put it in this repository, or paste its contents into a chat.

## 5. Connect using SSH

**Windows — PowerShell:**

```powershell
ssh -i "C:\Users\YOUR_NAME\Downloads\YOUR_KEY.key" opc@YOUR_PUBLIC_IP
```

Replace the path and IP. Keep the quotation marks around the path, especially if it contains spaces.

On the first connection, SSH displays a host-key fingerprint. Verify it using an independently trusted source or Oracle's console access where possible, then accept the new host. Do not disable host-key checking. If SSH later warns that an existing host key changed, investigate before accepting a replacement.

After connecting, your prompt changes to the remote Linux machine. You are now running commands on the **VM**.

**VM:**

```sh
uname -m
free -m
df -h /
```

For an A1 instance, `uname -m` should show `aarch64`. With 6 GB configured, Linux may report around 5.6 GB total. That difference is normal.

If SSH rejects the key as having overly open permissions, see [the Windows SSH section](service-shelves-troubleshooting.md#windows-says-unprotected-private-key-file). Do not paste the key anywhere to troubleshoot it.

## 6. Choose your public HTTPS hostname

You have two choices:

**Free option, no domain purchase:** use a hostname from [sslip.io / nip.io](https://sslip.io/) that embeds your IP. For example, an example VM at `203.0.113.10` would use:

```text
nuvio-203-0-113-10.sslip.io
```

That IP is documentation-only: replace it with **your actual VM IP**, changing the dots to dashes. The hostname points directly to your VM; this does not host the addon on somebody else's server. DNS and certificate issuance still depend on third parties.

**Your own domain:** point an ordinary DNS `A` record for a subdomain, such as `nuvio.your-domain.example`, at the VM's public IPv4 address. Wait for it to resolve before continuing.

Use a hostname only, without `https://` or `/manifest.json`, when running the installer.

The free IP-based name changes if the VM's public IP changes. For a longer-term setup, consider a stable/reserved IP subject to Oracle's current availability and pricing, or a domain you control. Never assume a stopped/recreated instance will keep an ephemeral IP.

## 7. Allow public web access in Oracle networking

There are two firewall layers: **Oracle's network rules** and **the Linux firewall inside the VM**. Both must permit web traffic. The installer handles the Linux rules; you handle Oracle's rules here.

Open the VM's attached subnet/security list or attached network security group. Add **stateful ingress** rules for:

| Source CIDR | Protocol | Destination port | Purpose |
| --- | --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` | Certificate checks and HTTP-to-HTTPS redirects |
| `0.0.0.0/0` | TCP | `443` | Encrypted public addon access |

Leave source ports unrestricted. Keep your working SSH access on TCP 22; restrict its source to your own public IP where practical. Do **not** open port 8790 to the Internet. Do not disable the firewall or SELinux to solve a connection problem.

If you created your VM in a subnet shared with other services, remember that editing its security list affects that subnet. An instance-specific security group is preferable when you need isolation.

Also confirm that the public subnet has an Internet Gateway route and normal outbound Internet access. The VM needs outbound HTTPS to download software and contact TMDB and certificate services.

## 8. Download the repository onto the VM

**VM:**

```sh
sudo dnf install -y git curl tar xz
git clone https://github.com/AMurtadaa/nuvio-community-config.git
cd nuvio-community-config/addons/service-shelves
```

The first package-manager command can take a few minutes on a fresh VM while Oracle downloads its repository indexes. No TMDB credential is entered in these commands.

The following installer is intended for a **fresh dedicated Oracle Linux 9 VM**. It creates `nuvio-shelves` and `caddy` system services and writes their configuration. Do not run it casually on a server already using those names or web ports for something important.

You can read it first:

```sh
less install-oracle.sh
```

Press `q` to leave the viewer.

## 9. Install the addon and HTTPS service

**VM:**

```sh
sudo bash install-oracle.sh YOUR_HOSTNAME
```

For example, replace `YOUR_HOSTNAME` with your own IP-based hostname from step 6. Do not copy the documentation-only IP.

The installer:

1. Chooses ARM64 or x86-64 downloads for the VM architecture.
2. Downloads pinned Node 24 LTS and Caddy releases from their official distribution locations and checks publisher checksums.
3. Installs the catalog files under `/opt/nuvio-shelves`.
4. Creates separate unprivileged `nuvio` and `caddy` service users.
5. Starts the addon on **loopback only**, port 8790.
6. Configures Caddy for HTTPS, exposing catalog routes and a simple landing message.
7. Excludes setup and diagnostics from the public address.
8. Enables automatic startup and restart after service failure.
9. Opens TCP web access in the VM's Linux firewall.

At the end, both services should say `active`. Diagnostics should initially show `"configured":false`. That is expected: you have not entered TMDB yet.

**VM — check:**

```sh
systemctl is-active nuvio-shelves caddy
curl http://127.0.0.1:8790/health.json
```

**Laptop — open in a browser:**

```text
https://YOUR_HOSTNAME/manifest.json
```

You should see JSON with `"id":"community.nuvio.serviceshelves.us"`. The manifest can load before TMDB is configured; catalog content cannot yet load.

If HTTPS does not work, fix it before installing in Nuvio. Do not bypass a certificate warning. See the troubleshooting guide.

## 10. Open the private TMDB setup through SSH

Keep your original SSH window if you want. Open a **second PowerShell window on the laptop**.

**Windows:**

```powershell
ssh -N -L 127.0.0.1:8790:127.0.0.1:8790 -i "C:\Users\YOUR_NAME\Downloads\YOUR_KEY.key" -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 opc@YOUR_PUBLIC_IP
```

This window may appear to do nothing. That is expected: `-N` creates a tunnel instead of opening a shell. Keep it running for setup.

On the laptop, open:

```text
http://127.0.0.1:8790/
```

Although the browser address looks local, the tunnel sends this connection securely to your Oracle VM. This is different from running the addon on your laptop.

Choose the credential type that matches what TMDB gave you:

- **TMDB API Read Access Token:** select the token option.
- **TMDB v3 API key:** select the key option.

Paste it into the password field and click **Verify and connect**. Wait for **Connected successfully**. The field clears after a successful save.

The VM validates it with TMDB, then saves it in a private file so restarts work. It is not stored in the catalog cache or published manifest. Never put it in GitHub, a public URL, or a support screenshot.

**Checkpoint:** the private page says connected and diagnostics show `"configured":true` and `"categories":709`.

You may then stop the tunnel with **Ctrl+C**. The public addon keeps running. You need the tunnel again only for private setup or diagnostics.

## 11. Test the hosted catalogs before changing Nuvio

**VM:**

```sh
cd ~/nuvio-community-config/addons/service-shelves
ADDON_URL=https://YOUR_HOSTNAME /opt/nuvio-runtime/bin/node check-live.mjs
```

Use the base HTTPS address, without `/manifest.json`. This makes real TMDB requests and can take a minute. Do not run it repeatedly without a reason.

Expected result: all 709 catalog routes return status 200. Some saved categories can legitimately have no matching titles; a zero count is different from an HTTP failure. The local report is `private/live-report.json` and is ignored by Git.

For the offline automated tests, no credential is required:

```sh
/opt/nuvio-runtime/bin/node --test test/*.test.mjs
```

## 12. Back up Nuvio and select a test profile

Open Kaptain Studio, select your own profile, then **Backups & Updates → Export backup file**. Save it privately. Do not upload it to GitHub.

For your first attempt, use a spare profile. The supplied generator creates a complete collection preset. **Importing it replaces that profile's collection list; it does not merge arbitrary personal collections.** Home replacement is a separate explicit option. This is why the backup and spare profile matter.

Keep your working playback addons. This addon does not configure Real-Debrid, subscriptions or scrapers.

## 13. Install your hosted addon in Nuvio

In Studio for the target profile, open **Add-ons → Add an add-on**. Paste:

```text
https://YOUR_HOSTNAME/manifest.json
```

Wait for **Service Shelves — US**, click **Add it**, then **Save changes**.

Do not install somebody else's private deployment as a substitute for hosting yours. Their credential, availability, quota and future changes would control your browsing.

Installing the addon alone does **not** automatically rearrange your service folders. The next step creates the folder references.

## 14. Download this repo to your laptop and generate your preset

On GitHub, choose **Code → Download ZIP**, extract it, and open PowerShell in the extracted repository root. Alternatively, clone the repository with Git.

On Windows, open the extracted folder in File Explorer, click its address bar, type `powershell`, and press Enter. Check that `README.md` and the `scripts` folder are visible there. If you only see another folder called `nuvio-community-config-main`, open that inner folder first. Run `node --version` to confirm Node is installed.

You need two values in addition to your addon URL:

- **Profile ID:** open your own exported backup locally in a text editor and find the top-level numeric `profileId`. The number `1` below is only an example.
- **TopX manifest ID:** open your own TopX manifest and read the top-level `id`, such as `com.topx.YOUR_ID`. This is the addon ID, not its full installation URL. Keep the recipe's catalog IDs and landscape chart settings.

**Windows — from the repository root, one line:**

```powershell
node scripts/generate-shelves.mjs --topx-addon-id com.topx.YOUR_ID --profile-id 1 --addon-url https://YOUR_HOSTNAME/manifest.json --include-home
```

Replace all three example values. No `npm install` is needed.

`--include-home` explicitly includes the supplied Home arrangement: global movie chart first, global series chart second, Streaming Services third, and all 709 standalone hosted catalog rows hidden. **It replaces the profile's Home preferences**, including unrelated custom row choices. Use it first in the spare profile.

If you omit `--include-home`, the import contains collections only. You must then arrange Home and hide unwanted standalone addon rows manually; clients may differ in how they honor the manifest's `showInHome:false` hint.

The generator creates:

| File | What it is |
| --- | --- |
| `generated/shelves/studio-import.json` | Studio backup-format import for your chosen profile |
| `generated/shelves/collections.json` | Collections-only JSON for clients/importers that support that format |
| `generated/shelves/installation.json` | A local reminder of your own manifest URL and ID |

Generated files are ignored by Git. The generator refuses to overwrite existing files. To regenerate safely, use a new output folder, for example append `--out generated/shelves-second-attempt`.

This generator does not add appearance settings or playback addons. To use the optional TV appearance preset, follow the separate repository instructions; do not assume artwork settings are identical across clients.

## 15. Import and apply the preset

In Studio, select the **same profile ID** you used in the command:

1. Open **Backups & Updates**.
2. Click **Import backup file**.
3. Select `generated/shelves/studio-import.json`.
4. Find the imported **Service Shelves - cached service folders** item.
5. Click **Restore** and confirm.
6. Wait until Studio says it restored the file.
7. Fully close and reopen Nuvio and select that profile.

Importing a file into Studio's backup list is not the same as applying it. The **Restore** step is required.

You should now have 19 collections, 786 folders and 3,612 source positions, with all browsing categories inside their original owners. The redundant More Browsing collection is removed. The 22 services retain their covers and GIF flags from the template. The 709 regular service queries use your hosted addon; 32 service list/ranking sources stay direct.

The optional Home arrangement keeps the duplicate chart collection hidden. Make sure your own TopX and any other referenced metadata/list addons are installed. The two optional global BetterPosters Top 25 folders still require that separate addon as described in the main README.

## 16. Test each device

Use the same profile on each device. Begin with Netflix, then a second service:

1. Open Streaming Services and enter the service folder.
2. Confirm its Top 10 rows, where supported, and browsing shelves appear.
3. Open a category using its arrow/action, then load enough titles to go beyond the first 20.
4. Open a title, check details and start playback through your existing setup.
5. Go Back and check focus/scroll behavior.
6. Check service GIFs, the Home banner and posters separately.
7. Repeat after the app is closed and reopened.

**Windows:** short shelves are intentional; the category arrow opens the larger list. Continuous horizontal fetching has not been added to the app.

**Fire TV / Android TV:** test with the remote, including the last item in a shelf, category entry, Back and app resume. A responsive laptop is not proof of remote navigation quality.

**LG / webOS:** verify HTTPS access, images, focus and category paging on the actual installed client. Do not disable certificate checks if a client cannot connect.

**Phone:** verify touch navigation, category expansion, rotation where supported and returning from details.

The backend protocol was inspected across the clients, but the finished hosted preset has not been physically benchmarked on all platforms. See [the platform checklist](platform-checklist.md). This addon cannot force GIF animation, the hero banner, or native focus restoration into a client that lacks those features or maps settings differently.

## 17. Day-to-day use

Your laptop and SSH tunnel can be off. The VM services start automatically after reboot. Keep the VM running and the hostname pointing at it.

The first uncached request depends on TMDB. Repeat requests can use cached pages. Rankings still use their existing providers. A cached catalog does not cache video and does not guarantee instant playback.

For maintenance, failures, changing your credential, updates and undoing the preset, use [troubleshooting and recovery](service-shelves-troubleshooting.md).
