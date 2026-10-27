# Service Shelves troubleshooting and recovery

Start with the [setup guide](oracle-service-shelves-setup.md) if you have not installed the addon yet. Never paste a private SSH key, TMDB credential, full account backup or private addon URL into an issue. Screenshots must hide credentials.

## Windows says “UNPROTECTED PRIVATE KEY FILE”

OpenSSH is refusing a key file that other local users/groups can read.

In Windows File Explorer:

1. Right-click the **private key file**, then open **Properties → Security → Advanced**.
2. Confirm your Windows account owns it.
3. Disable inherited permissions for this individual file.
4. Remove permissions for broad groups such as Users, Everyone, Authenticated Users or an extra sandbox group.
5. Keep your own account's access. SYSTEM and Administrators may also retain access.
6. Apply the change and retry SSH.

Change only that key file, not the Downloads folder or your whole user directory. Do not solve this by uploading the key somewhere else. If you need help with permissions, share the error and permission-entry names, not the key contents.

## SSH says “Permission denied (publickey)”

Check the public IP, `opc` username for Oracle Linux, matching private-key file, and any local permission warning immediately above the error. A newly generated key cannot access an older instance unless its matching public key was installed there. Do not replace keys on another working VM to troubleshoot this one.

If SSH times out, verify the VM is running, its public IP is current, and Oracle permits TCP 22 from your current IP. A VPN can change your source IP.

## The private page at 127.0.0.1:8790 does not open

The SSH tunnel must be running **on the same laptop as the browser**. The VM addon must also be running. Check the tunnel terminal for errors.

If the laptop already uses port 8790, identify what owns that port. Close that application only if it is safe to do so, or use another laptop for setup. This version deliberately checks the browser's loopback Host header, so changing the tunnel's local port alone is not a drop-in solution. Do not expose `/setup` publicly or weaken the Host check to work around it.

To check on the VM:

```sh
systemctl is-active nuvio-shelves
curl http://127.0.0.1:8790/health.json
```

Do not use `http://YOUR_PUBLIC_IP:8790`. That port is intentionally private.

## HTTPS times out or a certificate cannot be issued

Check these in order:

1. The hostname resolves to your VM's current public IP.
2. The VM has a public subnet and Internet Gateway route.
3. Oracle's attached security list/security group allows inbound TCP 80 and 443.
4. The Linux firewall permits `http` and `https`.
5. Caddy is running and its configuration contains the correct hostname.

VM commands:

```sh
sudo firewall-cmd --list-services
systemctl is-active caddy
sudo journalctl -u caddy -n 60 --no-pager
```

Certificate issuance can take a short time. Repeatedly restarting Caddy or requesting new certificates can hit provider limits. Read the actual error instead. If a free hostname is blocked by your network's DNS policy, use a domain you control rather than bypassing browser security warnings.

`https://YOUR_HOSTNAME/setup` and `/health.json` should return **404**. That is expected and protects private setup/diagnostics. Access them through SSH at the loopback address.

## “setup_required”, invalid credential, or no catalogs

Open the SSH tunnel and private setup page. Choose the correct credential type. A TMDB token is not a Real-Debrid token, and a v3 API key is not the same format as a Read Access Token. Click Verify and connect and check the status.

Never inspect the secret file by printing it in a support terminal. Diagnostics report whether setup is complete without exposing the credential:

```sh
curl http://127.0.0.1:8790/health.json
```

`startupCredentialError:true` means the saved file could not be read or parsed. Re-enter the credential through the private page and check ownership/permissions. A temporary TMDB outage does not require replacing a previously saved valid credential.

## The addon is installed but my service folders did not change

Installing the addon and importing folder references are separate steps. Generate the shelves preset, import it into Studio, then click **Restore** on that imported item. Select the correct profile and fully reopen Nuvio. Merely importing a file into Studio's backup list does not apply it.

The old `scripts/generate.mjs` creates the legacy More Browsing layout. The hosted layout uses **`scripts/generate-shelves.mjs`**.

## Hundreds of addon rows appeared on Home

Some clients do not honor the manifest's `showInHome:false` hint. The shelves generator's explicit `--include-home` option hides all 709 standalone hosted rows while keeping service folders accessible. That option replaces Home preferences, so use it knowingly on a backed-up test profile. Alternatively hide those rows manually in Studio.

## A shelf stops at around eight items

That is the selected Windows presentation, not a failed download. Open the category using its arrow/action to browse the full list. The addon cannot add native continuous horizontal loading. Provider-page boundaries can produce batches of 8, 8 and 4 before continuing on the next provider page.

If an expanded category stops too, note the client/version, category name and whether it stops at 8, 16, 20 or later. Use your own manifest and live checker to separate an HTTP failure from a client paging problem.

## One category is empty

A saved query can genuinely match nothing for the US region, date, service and filters. A 200 response with `metas:[]` is different from `provider_error`, `busy` or a timeout. Do not broaden filters silently just to make every shelf nonempty: that can show titles outside the intended service/category.

## Posters, GIFs or the hero differ between devices

This backend returns catalog metadata; it does not install a shared rendering engine. Check that the devices use the same profile and current supported client versions, then check their own image/GIF/hero settings.

The hosted preset import does not change appearance settings. The separate repository appearance preset includes TV settings but cannot guarantee the same mapping on every client. Landscape numbered charts are the observed workaround for a portrait poster override; they do not create a universal per-row poster API.

Record actual differences and client versions before changing settings globally. Do not turn on every animated feature on a low-powered TV as a generic performance fix.

## Browsing works but playback fails

The catalog addon does not find or host video. Check your existing playback addon/provider configuration. Real-Debrid is configured there, not on this VM. Report the exact client and whether the title's details and stream list load. Do not send your debrid credential.

## Basic server checks and restart

VM:

```sh
systemctl is-active nuvio-shelves caddy
sudo systemctl show nuvio-shelves caddy -p Id -p MemoryCurrent -p MemoryMax
free -m
df -h /
sudo journalctl -u nuvio-shelves -n 50 --no-pager
```

To restart just the catalog backend:

```sh
sudo systemctl restart nuvio-shelves
curl http://127.0.0.1:8790/health.json
```

The service reloads its private credential and surviving cache. Caddy keeps serving HTTPS. A full VM restart should also start both services automatically.

Keep diagnostic output private until reviewed. Caddy logs may contain your hostname/IP; full profile backups and other services' logs can contain substantially more sensitive information.

## Update the code without replacing your secret

The installer pins the tested Node and Caddy versions. It does not automatically update them. Review release notes and publisher security updates periodically.

For an addon source update, first review the upstream changes and run tests in the checkout. Do not replace `feeds.json` alone with a different schema or IDs; installed collection references depend on them.

VM:

```sh
cd ~/nuvio-community-config
git pull --ff-only
cd addons/service-shelves
/opt/nuvio-runtime/bin/node --test test/*.test.mjs
```

If tests pass and you have reviewed the changes, save a local copy of the current `/opt/nuvio-shelves` application files before replacing them. Then:

```sh
sudo install -m 644 core.mjs server.mjs setup.html feeds.json package.json /opt/nuvio-shelves/
sudo systemctl restart nuvio-shelves
curl http://127.0.0.1:8790/health.json
```

The secret and cache live under `/var/lib/nuvio-shelves`, separately from the code. Leave them there. To update Node or Caddy, review the pinned download URLs/checksum process and service compatibility first. Re-running the installer rewrites service/Caddy configuration; do not use it to overwrite unrelated custom server changes.

## Change the hostname or public IP

Update DNS if you use your own domain. For an IP-based free hostname, the name itself must change when the IP changes. Update `/etc/caddy/Caddyfile`, validate it, and reload Caddy:

```sh
sudo /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Install the new manifest URL in Nuvio after verifying HTTPS. The manifest ID remains `community.nuvio.serviceshelves.us`, so catalog references can remain the same, but avoid leaving two conflicting installations of that ID enabled. Back up before changing the installation.

## Restore the previous Nuvio setup

1. In Studio, select the affected profile.
2. Open Backups & Updates and restore your own pre-change backup.
3. Disable/remove this addon if the backup did not restore the addon list.
4. Re-enable any local test addon only if you deliberately restored a preset that depends on it.
5. Fully close and reopen Nuvio.

If you no longer need the VM addon, stop its services:

```sh
sudo systemctl disable --now nuvio-shelves caddy
```

Do this only on the dedicated VM described in this guide. These commands do not delete the private credential, cache, boot volume or Oracle instance. Handle any later resource deletion through Oracle deliberately; do not delete a VM still serving another application.
