# C5 full-chain firmware and portal rollout

Prepared 22 October 2026, 08:45 UTC. **Preparation only:** no new firmware,
certificate or portal file has been installed on the C5. Its eight-hour
application observer remains active until at least 09:37:42 UTC.

## Firmware transaction

All helpers below are staged in `/home/pi/envhub-bench-20261022` on Pi.
Use `/home/pi/esptool-venv/bin/python`. Their guards run before any serial
access and return 2 while the full application soak is incomplete.

1. Independently verify terminal evidence with `report_soak.py`; confirm the
   observer service is inactive and its PID is zero.
2. Run `backup_c5_for_fullchain.py` (allow a 1,200-second controller job).
   Require a verified full current-flash backup and successful resume in
   `c5-fullchain-backup.json`. Preserve all private recovery files.
3. Run `upgrade_c5_fullchain.py --check`. The offline planner checks the
   pinned old/new images, identical partition-table sector, active OTA
   metadata with CRC and the exact old application. It requires `ota_0`
   active; it never guesses that an apparently empty slot is inactive.
4. Run `upgrade_c5_fullchain.py` (allow a 2,400-second controller job).
   It acquires the deployment lock, rechecks readiness, selects the exact
   C5 UART and verifies ROM identity. It reads and verifies another complete
   flash snapshot while the chip stays in ROM, preserving measurements
   collected since step 2. The logical FAT image is also saved privately.
5. Only the bootloader region and application are written. The partition
   table, NVS, OTA metadata, inactive OTA slot and FAT partition are checked
   against that immediate snapshot after the write. A failed write or
   verification triggers one full-snapshot rollback and verification.
   Failed recovery leaves the chip in ROM and reports `recovery_required`;
   it never boots an unverified partial image.

A successful transaction reports `firmware_written_boot_validation_pending`,
not a completed rollout. Check the actual board ID, C5 MAC and runtime
`sys.version` containing `cb5301b6fb`, then verify the collector starts.

Nine offline planner tests pass against the actual pinned firmware images
and real FAT volumes, including byte-identical recovery of a 3 MiB file
crossing the non-contiguous FAT/OTA seam. Six fault-injection tests exercise
the actual transaction with a simulated flash device: active-soak refusal,
successful preservation, wrong ROM identity, failed firmware verification,
protected-region corruption and failed rollback. These tests do not replace
the upcoming hardware write/verification.

Staging job `10180d93-c228-4680-afc0-a15216a1c411` verifies all helper/image
hashes and proves the live active-soak guard refused console access.

| Helper | SHA-256 |
|---|---|
| `backup_c5_for_fullchain.py` | `0209e0f4700c2095313df5c49d6bf66ee27494a601105759e5b6761ceabf33ea` |
| `extract_esp_fat.py` | `a9c9f574094136442af169a0a96eff07c602433a9ea752ed068225e618b5865a` |
| `plan_c5_fullchain_flash.py` | `b39741b8931f218d730c6a7dd7ff908a6c5da08e25f03b71aa0250970412e1a5` |
| `upgrade_c5_fullchain.py` | `bf2c78135e944b48937d2dbb76a83fdf68169bedec4e01607ba26797baabcfda` |
| `verify_c5_https.py` | `1473b5719e91decb528f9d5f6073814fcb4377f2814246348362dc10fe1c0c8c` |

## Portal and certificate

After firmware validation, inspect the actual loaded `certstore.__file__`,
filesystem ownership/free space, and existing certificate override before
choosing module paths or changing files. The pinned importer prefers `.py`
over `.mpy` at the same location; preserve the existing compiled module and
user files. The final module/assets installation procedure still needs this
physical inspection and validation.

The corrected `portal-release-a53f137` package and its eight-file manifest
are already verified on Pi. Preserve `/www/vendor`, configuration and
measurements. Install the complete verified certificate through the existing
`certstore.Installer` or `/api/cert` mechanism, without logging key contents.
The private staged files are under `portal-https-staging`. Synchronize the
device clock and restart the collector only after the writes verify.

The staged `verify_c5_https.py` performs normal system-CA validation with SNI
and hostname checking, pins the expected leaf certificate, checks all seven
served web-asset hashes and the certificate/measurement APIs, and requires
wrong-host rejection specifically for a hostname mismatch. It has been
syntax-checked; it has not yet run against the upgraded C5. Its success state
explicitly leaves browser verification pending.

## Actual-browser path

Tachyon has Chromium 155.0.8059.84, Node 22.23.3 and Playwright CLI 0.1.22.
The task browser runs there in `/home/particle/envhub-browser-20261022`,
session `envhub-live-https`, using `playwright.config.json`. The configuration
keeps `ignoreHTTPSErrors` false and enables the experimental WebMCP features.

The temporary `envhub-c5-browser-loopback.service` binds **127.0.0.1:18443
only** and forwards through the existing Pi SSH connection to 192.168.4.1:443.
It has a four-hour runtime limit from 08:39 UTC. There is no listener exposed
on the Tailscale address. Stop this service and close only the named browser
session after portal verification; shared radio-test cleanup remains deferred.

The browser maps the certificate hostname to loopback only in its own launch
configuration. After deployment, navigate it to
`https://192dot168dot4dot1.gundryconsultancy.com:18443/`. TLS identity and trust
checks still apply. Do not use certificate-error bypasses.

The initial browser-launch controller job timed out, but inspection verified
its daemon and Chromium were still alive; job
`5b272383-733f-4656-8b9c-24a6251871ee` successfully read its blank-page state.
Reuse the session. Job `9a11c50e-82f1-4268-a0f5-92234235cd49` then verified a
normal public HTTPS page: secure context true, `document.modelContext.registerTool`
available, `navigator.modelContext` absent, native `LanguageModel` present but
availability `unavailable`. This prepares the actual portal's separate fallback
test; it is not a claim that WebMCP or inference has passed on the C5 origin.

On the C5 page, verify both WebMCP tools, load actual or clearly labelled demo
readings, check read-only SQL behavior, and exercise the explicitly enabled
Prompt API fallback. Save browser evidence and final HTTPS results. Neither
the earlier desktop demo nor the headless simulator TLS result substitutes
for this secure-origin check.


## Prepared portal file transaction, 09:10 UTC

The final installer is now staged, but has **not accessed the C5**. Staging
job `e5bf2478-9afe-403a-bfc8-052ce2d8153b` verified both helper hashes, all
eight pinned release files, the full three-certificate chain and staged key
hash. Both live guards refused console access while the application observer
was active (26,969 seconds elapsed).

| Helper | SHA-256 |
|---|---|
| `inspect_c5_portal.py` | `271da0ed58e6e756ff138196c41a8cf194d822acd113d31b1cfa7054b72a3a25` |
| `deploy_c5_fullchain_portal.py` | `3306a6d481a3c9c7b5b0b39ac8516b1a1733b11332287aa38c2b6eea61cff102` |

After the verified firmware transaction, run the inspector with the Pi
esptool virtual environment (allow 180 seconds). It checks exact board/MAC/
firmware identity and reads only filesystem metadata, current working
directory, loaded module location, storage ownership/free space, certificate
override and served portal root. It requests a collector restart afterwards;
`metadata_verified` does not establish successful restart or HTTPS.

Review the resulting `c5-portal-inspection-*.json` before installation. The
installer supports an MCU-writable `/www` portal and a certstore module at
the observed root or `/lib` location. It normalizes relative module names
against the observed working directory. It refuses an SD portal/certificate
override, unexpected module location, insufficient free space or pre-existing
upload partials, preserving those for inspection.

Then run `deploy_c5_fullchain_portal.py --check`, followed by the helper without
`--check` in a 1,200-second runner job. It rechecks readiness and physical
identity under the same deployment lock, privately backs up the exact selected
files, verifies temporary files before replacement, and verifies each installed
file. The existing `.mpy` module, `/www/vendor`, configuration and measurements
are preserved. It synchronizes the RTC and uses `certstore.Installer` for the
complete certificate. No key contents or raw upload exceptions are logged.

Eight offline tests pass against the actual transaction logic: successful
preservation and backup, lost acknowledgement after rename, partial certificate
pair, final corruption, failed rollback, pre-existing partial refusal,
read-only/SD/module-layout refusal, and the active-soak gate. Recovery restores
and verifies exact originals, including removing newly introduced files. A
failed recovery reports `recovery_required` and leaves the collector stopped
in REPL. These tests are not hardware rollout evidence.

Success reports `installed_runtime_validation_pending`, with both HTTPS and
browser verification still false. Read `c5-portal-deployment.json` and its
private recovery directory before retrying anything. Verify collector restart,
the loaded new module, normal trusted HTTPS with `verify_c5_https.py`, and the
actual browser WebMCP/Prompt API flow before declaring deployment complete.
