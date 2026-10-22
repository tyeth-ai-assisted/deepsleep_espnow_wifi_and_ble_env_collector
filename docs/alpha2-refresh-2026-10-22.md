# CircuitPython 11 refresh and farm soak â€” 22 October 2026

The newest published upstream release checked on 22 October is
**11.0.0-alpha.2**, released 21 October, including prereleases. An alpha.3
was not published at that check. This integration is based on that exact tag,
not the older 10.x release or an arbitrary main snapshot.

## Hardware and recovery

Pi 6 (`rpi-hil006`) hosts the ESP32-S31 bridge on its USB hub. The S31
exports the downstream hub tree over USB/IP. ROM identification found:

| Role | Board | Flash | RAM / initial Python free heap |
|---|---|---|---|
| Collector | ESP32-C5-DevKitC-1-N8R8, rev 1.0 | 8 MB | about 4 MB free |
| Node | ESP32-C61-DevKitC-1-N8R2, C61HR2 rev 1.0 | 8 MB | about 2 MB free |

These are C5/C61 devkits, not the C6/S3 pair described in the older bench
notes. The C5/C61 flashed builds use the UART bridge for the console;
normal builds retain their native USB console. Their common source commit
is `2a7f9987f3`, based on alpha.2. The version string includes `dirty`
because of the build checkout's submodule state; retain the artifacts and
their hashes rather than treating that version string as a clean release.

Both complete 8 MB original flash images were saved and verified against
the chip before writing. Private backups are on Pi 6 in
`/home/pi/envhub-bench-20261022/`:

| File | SHA-256 |
|---|---|
| `c5-before.bin` | `06ede177e60cb854c318080132882564d7c71e502f6f1e7c6d0601fb836ad666` |
| `c61-before.bin` | `2e8441c57e5facc41147b7ac582a1a56412a953e5928c1145a070cb7b0f2674a` |

Do not publish these images: they can contain previous configuration.
Both new firmware writes passed esptool's hash verification. Reliable
flash reads used 230400 baud; 921600 produced truncated packets through
this bridge.

The S31 initially exhausted DWC host channels while claiming composite
devices across three hubs. Its UART reported `No more HCD channels
available`. Disabling unused downstream ports and restarting the bridge
restored actual flash-tool access. This failure was in the USB transport,
not proof of a CircuitPython crash. Pi 6 also needed one reboot to recover
its stuck physical USB inventory.

Ports temporarily off for this run: `1-1.1`, `1-1.2`, `1-1.3.1`,
`1-1.3.2`, `1-1.3.4.2`, `1-1.3.4.4`. Restore them after collecting the
soak result. UARTs at `1-1.3.4.1` and `1-1.3.4.3` remain on. Opening
these UART bridges can reset a board even with DTR/RTS deasserted; do not
open another serial client during a soak.

## Patch disposition

The starting audit is the
[escalation index on tyeth/circuitpython#15](https://github.com/tyeth/circuitpython/issues/15#issuecomment-5617383669),
linked from [collector issue #7](https://github.com/tyeth/deepsleep_espnow_wifi_and_ble_env_collector/issues/7).
Issue state and source presence were checked separately: an open tracking
issue alone does not establish that a patch is missing upstream.

| Work | Disposition on alpha.2 |
|---|---|
| DEBUG / EXTRA_CONF quoting, CP #24 | Already upstream in [adafruit #11423](https://github.com/adafruit/circuitpython/pull/11423); obsolete implementation dropped. RTT option adapted to the new upstream Makefile. |
| Second console RX wake | Already upstream in [adafruit #11448](https://github.com/adafruit/circuitpython/pull/11448); old patch dropped. |
| Global BT_MAX_CONN=4 | Dropped; upstream uses 5. Pico W's board-specific limit remains with its BLE work. |
| TCP errno conversion, part of CP #21 | Upstream already uses `mp_raise_OSError(errno)`; duplicate conversion dropped. Other accepted-socket/timeout and TCP/TLS settings retained. |
| [CP #26](https://github.com/tyeth/circuitpython/issues/26), server TLS client-certificate policy | Still needed; retained. |
| [CP #28](https://github.com/tyeth/circuitpython/issues/28), empty CP_VERSION | Still needed; retained. |
| [CP #30](https://github.com/tyeth/circuitpython/pull/30), frozen application libraries | Retained, extended to C5/C61. Old UART debug relocation omitted. |
| Radio heap reserve / TLS tickets | Retained. C5/C6/S3/C61 integration uses 4 KB TLS records where configured; 2 KB is too small for the certificate chain. |
| C5 and C6 devkit image size | Frozen images exceed 2 MB. Dedicated 3 MB OTA slots fit; this changes the filesystem location and requires backup before flashing. |
| [CP #25](https://github.com/tyeth/circuitpython/issues/25), alleged warm-reset failure | Earlier 45% failure claim was retracted after 45/45 successful resets. Do not revive that claim or close unrelated reset work on its basis. |
| [CP #29](https://github.com/tyeth/circuitpython/issues/29), Windows BLE cache | Host GATT-cache diagnosis; not evidence of a new upstream CircuitPython fix. |
| [ESP-IDF #19074](https://github.com/espressif/esp-idf/pull/19074) | Still open at audit; do not describe as merged. |

Zephyr CircuitPython work was separately rebased onto alpha.2, retaining
Pico W/Pico 2 W BLE, USB stack headroom, scan timeout, AP DHCP, socket/TLS,
and RTT work. The Zephyr dependency's four patches were rebased onto
alpha.2's `3ab36efea64edda80e45ece016753e3686bb763f` pin, yielding
`4b1c753a769b507077c7fd69732d15d7c326d0fe`. HAL upstream bases did not
move, so their fixes remain pinned at:

* `hal_rpi_pico`: `725e9e429eab65eda01762a1af9016426dee00ac`
* `hal_infineon`: `daae5ca73811dbee8ad01fb1aaeafa98896ef94b`

Review drafts: [ESP integration #31](https://github.com/tyeth/circuitpython/pull/31),
[Zephyr CircuitPython #32](https://github.com/tyeth/circuitpython/pull/32),
and [Zephyr dependency #11](https://github.com/tyeth/zephyr/pull/11).

The unresolved capability/extended scan, stale boot_out, absent-HCI CI,
BLE retry, CYW43 cache, and Zephyr logging reports remain open. No issue
was closed merely because this integration builds. The previously closed
upstreamed reports do not need another closure.

## Validation and overnight protocol

ESP builds succeeded for C5, C61, C6 devkit and S3 devkit. C5/C61 UART
variants also built and booted. C61's 2 MB app slot has only about 30 KB
headroom; adding more frozen libraries requires another size check.

Zephyr Pico 2 W and Pico W builds also pass (1,230,244 and 1,273,652 bytes
of firmware respectively), with 83 cptools tests passing. Pico W required
two BLE connections, IPv4 only and six network contexts to fit the new
stack in 264 KB RAM; Pico 2 W retains dual stack and the larger limits.
The Pico W has since been flashed and tested as detailed below; Pico 2 W
hardware validation remains outstanding. A custom firmware `BUILD` directory was leaking into the nested host mpy-cross
build; host preparation now explicitly selects its expected output path.

Application deployment caught and fixed the collector's assumption that
every bare devkit exposes IO19/IO20. C5 with PSRAM has neither pin alias;
it now runs with no local I2C sensor. Serial deployment also handles
external UART DTR correctly and reports raw-REPL stderr as an exception
instead of waiting for two adjacent end markers and timing out.

The node explicitly uses `sensor: "sim"`; every reading says `type: sim`.
This is a radio/application soak on real hardware, not sensor accuracy
validation. Preflight demonstrated CRC-confirmed ESP-NOW delivery and
`ResetReason.DEEP_SLEEP_ALARM` after real sleep. Opening the collector's
UART restarted its AP; Pi's stale Wi-Fi association required reconnecting.
The initial six-minute preflight therefore records an HTTP availability
failure. Keep that result; it is not an overnight pass.

`tools/overnight_soak.py` runs for a full eight monotonic hours under
systemd on Pi 6. It keeps both UARTs open, records serial output, polls
`/api/latest` every 30 seconds, and optionally performs BLE `mem`/`latest`
round trips every two minutes. It syncs UTC through `/api/time`, never
resets a stalled DUT, and atomically updates `status.json`.

A pass requires the whole duration, confirmed deliveries with no gap over
300 seconds, HTTP with no gap over 120 seconds, true deep-sleep wakes, no
collector restart, no serial disconnect or fatal device exception, and
(when enabled) no BLE gap over 300 seconds. A running test is not a pass.
Raw logs and manifests stay under `/home/pi/envhub-bench-20261022/`.

The actual eight-hour run is `overnight-01`, systemd unit
`envhub-overnight`, started **01:37:42 UTC / 02:37:42 BST** on 22 October,
due **09:37:42 UTC / 10:37:42 BST**. BLE probes are enabled. An hourly
follow-up checks meaningful failures/completion and restores temporary
bridge-port power, Pi Wi-Fi and Bluetooth settings after completion.
The initial HTTP poll during boot failed; subsequent polls, BLE commands,
confirmed delivery and real deep-sleep wakes are succeeding. No pass is
claimed until the full duration finishes.

Use a private JSON configuration with `boards` (name, role, by-id `port`,
`uart: true`), `url`, `hours: 8`, `sensor: "sim"` and optional `ble_name`.
The output directory must not already exist, so a new run cannot overwrite
an earlier failed run. The Pi's test Wi-Fi profile never supplies the
default route; SSH remains on Ethernet.

## Expanded Feather and Metro builds

Commit `2c096e11e7` extends the ESP integration after testing the remaining
board configurations. This does not replace the C5/C61 firmware during
the active soak.

| Target | Firmware bytes | Application slot | Build result |
|---|---:|---:|---|
| Feather C6 4 MB, no PSRAM | 2,207,760 | 2,883,584 | Pass |
| Feather S3 no PSRAM | 2,040,976 | 2,097,152 | Pass |
| Feather S3 4 MB flash / 2 MB PSRAM | 1,996,704 | 2,883,584 | Pass |
| Metro S3 16 MB flash / 8 MB PSRAM | 2,106,880 | 3,145,728 | Pass |

The original Metro build exceeded its 2 MB slot by 9,728 bytes. It now
uses two 3 MB slots, while keeping the existing TinyUF2 factory app at
`0x410000`. Its filesystem moves to `0x750000`, size 8,896 KiB. The
Feather C6 also exceeded its old 2 MB slot; it now uses the standard
2,816 KiB application layout, filesystem at `0x2d0000`, size 1,216 KiB.
Back up, reformat and restore files when upgrading either layout. An
application-only UF2 update cannot install a changed partition table.

All four builds explicitly allow 4,096-byte outbound TLS records for the
collector's certificate chain; inbound records retain the upstream size.
Artifact collection decoded and verified each built partition table,
checked application size against every slot, confirmed the actual TLS
configuration, and recorded SHA-256 hashes for the BIN/available UF2 files.
These are compilation/configuration results, not hardware passes. The
physical S31 Feather/Metro ports remain off until the C5/C61 soak ends.

The directly attached Pico W was independently identified at Pi 6 USB
`1-1.2.2`, flash ID `E663AC91D3444127`. It ran WipperSnapper rather than
CircuitPython. Before upgrading, its full 2 MiB flash was saved with
picotool verification as `picow-before.bin` (SHA-256
`4b86f3fa60e115d93396cfcc15bc38f33660bfe76863017a85f4e8374ad8c9ba`),
plus its 512 KiB WIPPER disk image. Backups remain private on Pi 6.
The controller's supported inline jobs provide a working route while
the desktop SSH agent cannot sign; no S31 binding or active soak console
was changed for Pico preparation.

## Pico W runtime validation

The original alpha.2 integration linked but exposed only USB mass storage:
the default WHD packet pool and thread stacks left too little runtime RAM
to allocate USB CDC. CircuitPython commit `168149058e` and Zephyr dependency
`62aa864927d3ae43ede3b2b557b6f410aae8899a` reduce only Pico W's shared WHD
pool from 20 to 10 full-sized buffers and its main stack to 16 KiB. The
six-buffer Bluetooth coexistence reserve remains; Pico 2 W keeps defaults.
Both builds pass, at 1,273,644 and 1,230,244 bytes respectively. The Pico W
link map now leaves 32,168 bytes below `0x20040000`, plus the remaining
upper SRAM. This is build headroom, not a runtime free-heap measurement.

The physical debug probe `E6654854576EB830` was matched to the Pico by
comparing its first 4 KiB of flash against the installed UF2 before recovery.
SWD flashing and verification of the revised image passed. USB CDC then
enumerated, Python ran, BLE enabled, and a two-second BLE scan returned
42 entries in 2.047 seconds. The firmware's cached version header still
reported `cef2fe5f7a`; artifact hashes and build inputs identify this build.

**Pico W is not yet a compatibility or soak pass.** Wi-Fi scanning returned
`OSError(11)` / EAGAIN, including bounded follow-up scans with BLE enabled
and disabled (about five seconds to failure). USB stalled afterwards and
the host attempted recovery. A separate RTT diagnostic image was installed;
its boot logs show WLAN firmware, Bluetooth firmware and USB initialization.
The remaining radio/USB behavior needs diagnosis before an overnight test.
The ESP observer was not interrupted by these Pico jobs.

Revised Pico W UF2 SHA-256:
`ae65271a434aa715d346cca9ce82401d05e36911ecad2176e6c9d3dfe4028863`.
Diagnostic RTT UF2 SHA-256:
`50c092757fa7959df9a8064ad68f048a8fb19cbf64c4c26295597c53e7678c81`.
Full original firmware/filesystem backups remain private on Pi 6.

At 03:12 UTC the ESP observer was still running after 94 minutes:
47 confirmed deliveries and true deep-sleep wakes, 188 HTTP successes
(one startup error), 45 BLE successes, one collector start, zero serial
errors and no recorded test failures. The full eight-hour result is pending.
The follow-up can use the controller API when desktop SSH signing fails;
credentials are obtained at execution time rather than saved in its prompt.

### Startup isolation and build provenance

CircuitPython commit `5afc122780` fixes stale incremental-build version
headers. Version generation now runs for each build and retains unchanged
output timestamps; Git commits, tags and dirty state are no longer hidden
by the command cache. All 85 cptools tests pass, including cache-bypass and
unchanged-output tests. A real incremental build reports the current
`11.0.0-alpha.2-19-g5afc122780-dirty` diagnostic source state.

Autonomous C diagnostics over SWD/RTT reproduce the Wi-Fi failure without
Python or USB: the scan command's `event_msgs` IOVAR times out after five
seconds (`0x060e0000`, then `-EAGAIN`). The WHD packet pool has zero buffers
in flight at failure, and the diagnostic thread remains alive. A full-chip
watchdog reset also reproduces it.

The same image accepts a scan before CircuitPython startup. With automatic
BLE workflow startup suppressed only for diagnosis, it accepts the later
scan too. With BLE startup restored, the later scan fails again. Request
acceptance is not a completed scan, association, TLS or soak pass. Disabling
BLE is not proposed as a compatibility fix. USB enumeration also remains an
unresolved problem, including in the no-BLE-startup control.

Two controlled candidates did not fix the failure: notifying WHD whenever
the shared IRQ pin is asserted on re-enable, and locking complete backplane
read/write transactions. Both experiments were reverted from source. Their
negative results are retained locally alongside exact firmware and ELF
hashes; neither is included in the published branches.

A further startup probe successfully read the Wi-Fi MAC immediately after
Bluetooth firmware loading. Subsequent HCI initialization in that
instrumented run produced repeated hardware errors and an opcode `0x0c03`
command timeout, halting before the later scan. In a separate control with
normal startup, suspending only the Bluetooth poll thread at 25 seconds
did not restore Wi-Fi: the scan at 33 seconds still timed out. These results
narrow the investigation but do not identify a validated repair. All
temporary driver and startup instrumentation was removed after testing.

At 03:52 UTC, the ESP observer process was verified active after 134 minutes:
66 confirmed deliveries and true deep-sleep wakes, 268 HTTP successes
(one startup error), 63 BLE successes, one collector start, zero serial
errors and no recorded failures. The eight-hour result remains pending.

### Validated CYW43 coexistence repair

The Pico SDK selects a different WLAN image when Bluetooth is enabled.
Using its `wb43439A0_7_95_49_00_combined.h` WLAN/CLM pair fixes the
post-Bluetooth Wi-Fi control timeout on Pico W. The generic Murata image
reported WLAN 7.95.88; the SDK combo image reports 7.95.61. The fix follows
the SDK's coexistence selection rather than choosing the higher version.
NVRAM is unchanged. Prior failed IRQ and transaction-lock candidates remain
reverted.

Zephyr commit `ea703e85b630897a5df75f4156f22f72edd5a81d` extracts the pair
from the already pinned hal_rpi_pico header during configuration, validates
the length metadata and retains explicit custom-resource overrides.
Eight extractor tests pass. The durable selector produces an image
byte-identical to the successful diagnostic build. Its preceding commit
`8d632a8238990c624a3e407f93bdf8694b775977` also fixes HCI TX length counting:
the H:4 type byte was counted twice, advertising an extra byte and allowing
an out-of-bounds read at maximum length. A sanitizer harness using the real
send function fails on the original and passes the corrected framing,
boundary, error and ownership cases.

Hardware job `0147637e-9a23-45cd-a786-018de6df887c` completed three Wi-Fi
scans while BLE scanning was active. They returned 3, 7 and 8 AP results;
BLE received eight advertisements. All scan request/completion statuses
and BLE start/stop returned zero. This is C-level radio validation through
RTT; it does not establish Python API, association, TLS or long-soak results.
Diagnostic UF2 SHA-256:
`fb9ec7660f5a86f6ff21f82ed1df4f0b95f6c709edb76545642a29122d35e51a`.

CircuitPython commit `a24d38f09fd11e0a20c599a8eeaead2b7e3ba9fa` pins the
fixed Zephyr revision. Normal builds with clean tracked source pass for
Pico W (1,251,876 bytes, 32,168 bytes SRAM0 headroom) and Pico 2 W
(1,208,484 bytes). Both report `11.0.0-alpha.2-20-ga24d38f09f`.
The Pico W incremental build initially stopped at a generated-file cache
check; rerunning without source changes completed successfully.
Normal UF2 hashes are Pico W
`dd0f032b54ac6e8e5beeb6f9f9a3a6188ba8aca0fa591928a17783440264e132`
and Pico 2 W
`e7a732980af901dd74fa996ded84561c2d1ad37cc6b90d415f3f36e31df1708c`.
The normal Pico W image passed SWD flash verification, but the host still
times out reading USB descriptors and no CDC console appears. Its CPU
remains active. Python API checks and extended Pico testing are therefore
still blocked by USB; the successful C-level radio scans do not resolve
this separate validation gap. Pico 2 W hardware testing remains pending.

The three firmware draft PRs now target comparison branches pinned exactly
to the CircuitPython alpha.2 tag and its upstream Zephyr revision, so their
diffs contain the carried integration changes rather than upstream history.
At 04:40 UTC the ESP observer was active after 182 minutes: 90 confirmed
deliveries and true deep-sleep wakes, 364 HTTP successes (one startup
error), 86 BLE successes, one collector start, zero serial errors and no
recorded failures. Its eight-hour result remains pending.

### USB recovery and Python radio validation

The USB investigation found a host-side contributor: Pico W also failed
enumeration while executing its built-in ROM USB boot loop (verified by
SWD). Resetting the Genesys hub's single transaction translator, followed
by toggling only Pico's USB pull-up, restored ROM enumeration. A picotool
reboot then exposed the unchanged normal CircuitPython image's CDC, MSC
and HID interfaces. No shared hub power was switched. The exact trigger
for the stuck translator is not established.

On clean-source firmware `a24d38f09f`, Python-level simultaneous scan job
`38523d67-198c-408a-9577-7cea6c4870b1` passed three cycles: Wi-Fi returned
87/103/96 scan results and BLE received 26/27/26 advertisements, each cycle
taking about 8.2 seconds. Association to the bench AP and an HTTP 200
response also passed while BLE received 128 advertisements. The console
remained responsive.

The reported `gc.mem_free()` near 71 KB is **not actual free physical RAM**.
This port adds a fixed 64 KB fallback estimate for a possible new split
heap. Treat it only as an estimate; linked RAM bounds and actual allocation
success remain the relevant constraints.

TLS preflight is still failing. The published image raises `MemoryError`
while wrapping the socket, both with and without active BLE scanning.
A local, unpublished Pico W-only candidate reduces WHD pools from 5+5 to
4+4, network packet counts from 14 to 8 per direction, and data-buffer
counts from 36 to 24. It frees 9,456 bytes and gets past wrapping, but an
RSA TLS handshake still raises `MemoryError`. HTTP/BLE continues to pass.
Full TLS records and the six-buffer Bluetooth reserve are retained.
Further checked-stack RAM testing is in progress; no TLS compatibility or
Pico overnight pass is claimed.

At 04:54 UTC the ESP observer remained active after 197 minutes: 97
confirmed deliveries and true deep-sleep wakes, 393 HTTP successes (one
startup error), 93 BLE successes, one collector start, zero serial errors
and no recorded failures. The eight-hour deadline remains 09:37 UTC.

### Pico TLS RAM validation and eight-hour radio soak

The published Pico W update is now CircuitPython
`3e8c1601cf8511ad691170906a98eeca412744ed`, with the same Zephyr
`ea703e85b630897a5df75f4156f22f72edd5a81d` pin. It keeps full TLS
records and full network MTU while reducing WHD packet pools to 4+4,
network packets to eight per direction and chained data buffers to 24.
An 8 KiB main stack, initialization pattern, stack sentinel and allocator
counters retain measurable stack/heap evidence. The six-buffer shared-radio
reserve remains intact. Pico 2 W configuration is unchanged.

The pool-only and 12 KiB-stack candidates still failed the RSA handshake
with `MemoryError`. The 8 KiB candidate passed local RSA-2048 TLS with a
trusted self-signed certificate, correct hostname verification and BLE
scanning; a wrong hostname was rejected (`OSError(-9984)`). Its post-TLS
stack sentinel was intact, with 4,652 untouched bytes and an upper bound
of 3,536 touched bytes. The allocator peak was 53,640 bytes. This is
controlled-endpoint evidence, not a guarantee for larger certificate
chains. The existing test RNG setting has not been changed.

The committed, clean-source build uses 1,252,124 bytes of firmware flash
and leaves 49,800 bytes in SRAM0 before runtime allocations (plus the
remaining SRAM region). Its BIN is 1,252,352 bytes, SHA-256
`0bc60f402d3cd3bc8bb073980090b770cf2c886882924ba5b418426923de9fa9`;
UF2 is 2,504,704 bytes, SHA-256
`d7957a79df767f1391bb7505479a6c0e289ccd810fbc8d9cd16f860aafc4f475`.
SWD programming/verification and normal USB enumeration passed in job
`efad2eb1-1a4b-4159-a17f-5dde3dba9560`.

**First association remains an open runtime issue.** Both the 8 KiB
candidate and the clean committed image failed the first association
after boot with `ConnectionError: Unknown failure 1`. One bounded retry
succeeded on each. The clean-image retry, job
`a449335a-3d1a-4323-a54a-c67b27bd09cd`, received HTTP 200 with 120 BLE
advertisements, then a verified TLS response with 63 BLE advertisements,
and rejected the wrong hostname. The failed first attempt is retained as
job `61a36b12-e3d1-4a43-9799-cc8064b821dc`. No first-connect reliability
claim or related issue closure is justified by the retry.

`tools/pico_radio_soak.py` records simultaneous Wi-Fi/BLE scan cycles,
atomic status and JSONL samples. It selects the exact USB serial and
checks the firmware revision, never reconnects/resets automatically, and
requires the full requested duration for a pass. It fails on bounded scan
or serial errors and three consecutive empty-radio cycles. Four evidence
parsing/validation tests pass. A separate 30-second recorder preflight
completed three cycles; it was not the overnight run.

The real eight-hour Pico radio soak started **2026-10-22 05:28:11 UTC**,
due **13:28:11 UTC (14:28 BST)**, controller job
`c39ae3ca-1470-4839-b90b-7b1c078ad31e`, on Pico serial
`E663AC91D3444127`. Status and samples live on Pi 6 under
`/home/pi/envhub-bench-20261022/pico-radio-overnight-01/`. The first cycle
returned 81 Wi-Fi results and 26 BLE advertisements in 5.71 seconds.
**Failed after 46 cycles; see the failure analysis below.** This is scan coexistence testing, not sustained
TLS, association reliability or the full ESP-NOW collector application.
The port's `gc.mem_free()` includes a fixed growth estimate; the recorder
labels it `gc_free_estimate` and does not claim physical RAM from it.

Reproduction uses pyserial plus the adjacent `serial_deploy.py`:

```sh
python tools/pico_radio_soak.py --serial-number E663AC91D3444127 \
  --revision 3e8c1601cf --hours 8 --interval 30 --output /new/run-directory
```

At 05:28 UTC the separate ESP observer remained active after 230 minutes:
114 confirmed deliveries and true deep-sleep wakes, 460 HTTP successes
(one startup error), 108 BLE successes, one collector start, zero serial
errors and no recorded failures. Its deadline remains 09:37 UTC. The
existing hourly monitor now tracks both runs; shared Wi-Fi/Bluetooth and
hub cleanup must wait until the Pico run also finishes. Remaining Pico
2 W, Feather and Metro hardware validation stays pending.

### Remaining firmware staged on Pi

The previously built Feather C6, Feather S3 (both RAM variants), Metro S3
and Pico 2 W BIN images are staged under
`/home/pi/envhub-bench-20261022/`, with their source revisions, lengths
and SHA-256 values in `remaining-firmware-manifest.json`. Job
`b63bcafd-16f8-4928-bd35-57e5f2fe5eea` independently verified all five
destination hashes. This copied host files only: no DUT console, flash or
USB port state was changed. Hardware identification, full private flash
backup and board-specific flashing still precede any runtime claim.
In particular, confirm the physical Feather's RAM/flash variant before
selecting its image, and preserve files across the changed C6/Metro
partition layouts described above.

### Post-soak portal release staging

The exact tested portal commit
`30e57d225c32e65ea212bba12a5acc24804748e9` is now staged on Pi 6 at
`/home/pi/envhub-bench-20261022/portal-release-30e57d2`. Its
`release.json` identifies only `index.html`, `sw.js`, `manifest.json`,
`icon.svg`, `ai_tools.js`, `webmcp.js` and `prompt_backend.js`, with byte
counts and SHA-256 hashes. The archive SHA-256 is
`3ddfdfdd67228ce7e5d0a303c30d9439fc220735f25ca177c0788cf215f1b8f5`.

Staging job `66619060-dc3a-496b-88fc-e079f377e924` verified all assets.
The read-only gate `/home/pi/envhub-bench-20261022/check_portal_release_ready_30e57d2.py`
also requires a terminal ESP observer with a full 28,800 seconds and no
active systemd PID. At 05:44 UTC it correctly returned deployment-not-ready
while PID 5493 remained active. No console was opened and no DUT files
were changed. The hourly monitor knows this release path and gate.
Actual C5 deployment and served-asset hash verification remain pending;
preserve its vendor assets, configuration and logged measurements.

This release supersedes the earlier `1b79d14` staged bundle. Review found
that the native model loop omitted the Stop signal when placing work in
the shared SQL queue. A behavioral regression using the actual portal
loop and queue reproduced a stopped query reaching the engine. The
one-line correction forwards that signal: stopped queued work now skips
the engine, normal work still executes, and temporary sessions are
released. Both new regressions, the ten existing browser-AI integration
tests and all thirteen SQL validation groups pass. The mobile fallback
already forwarded its signal and is unchanged.

The separate first-association investigation narrowed the Python error
to `WIFI_RADIO_ERROR_UNSPECIFIED` (1), rather than the event-result
`WIFI_RADIO_ERROR_CONNECTION_FAIL` (205). AIROC performs WHD join
synchronously and collapses its failures to `-EAGAIN`; current logging
does not retain the underlying WHD result. The cause is not established.
After the Pico soak, capture that result and compare a clean disconnect
before reset with an abrupt restart against the same AP. Do not add an
automatic retry or close the issue based solely on the successful retry.

### Pico overnight failure and independent Feather V2 build

The Pico W eight-hour scan soak FAILED at 2026-10-22 05:51:47 UTC after 1,416.05 seconds and 46 good cycles, job `c39ae3ca-1470-4839-b90b-7b1c078ad31e`. Cycle 47 accepted the raw-REPL command but produced no terminator before the 35-second deadline. This is not an overnight pass. The preserved main thread is blocked in `common_hal_wifi_scannednetworks_next()` / `k_poll(K_FOREVER)`, on channel index 3 with no queued results or completion signal; the driver still has its scan callback registered. Root cause remains under investigation. The stack sentinel is intact, touched stack is at most 3,536 bytes, and libc reports 42,116 bytes free. UART samples do not establish a stuck FIFO. No USB resets or disconnects were reported around the failure. The failed run is retained; Pico 2 W validation remains pending.

Failure occurred during the independent Feather V2 backup read/verify, but
timing alone does not establish causation. No shared hub reset occurred.
The private RAM snapshot remains on Pi in `pico-radio-failure-01/ram.bin`
(270,336 bytes, SHA-256
`c6056b860d69700dd8f37fd4ac45833b139606457533a666df77f3ddee42f9c6`).
Do not publish this RAM or full-flash backup: either can contain credentials.
Snapshot job: `9b815563-f0e9-4ad7-8fa8-a27f5bd3d6dc`; decoded scan/thread
state job: `3398f984-7fe1-4e6f-9101-2b2018250408`.
The AIROC 12-second timeout protects association-related scans, not this
asynchronous `airoc_mgmt_scan` path. A recovery or bounded timeout alone
will not establish reliable scan coexistence; a new full-duration run is needed.

At 06:03 UTC the independent ESP soak was still active: 131 confirmed
deliveries and true sleep wakes, 529 HTTP successes (one startup error),
125 BLE successes, one collector start, zero serial errors, no recorded
failures. Its eight-hour deadline remains 09:37:42 UTC. The hourly monitor
now records the Pico failure and preserves its evidence instead of waiting
for its obsolete deadline. Shared cleanup remains deferred while diagnostics
or additional tests are active.

The directly attached Feather ESP32 V2 has USB serial `564E053407`, ROM MAC
`E8:9F:6D:32:50:04`, and 8 MiB flash. Backup/verification job
`e59059c9-ca53-494c-a7a6-e186924af8e6` passed before any write. Its private
8,388,608-byte backup SHA-256 is
`c2d4abdd4554c680555729669ceb5a0a91eef4dbf23db8d93b883757669e150e`.

The first Feather V2 integration build exceeded its 2 MiB slot by 12,736
bytes. ESP integration `4730c980cafabb18ed889d680db26ff4ffafeb28`
adds two 3 MiB OTA slots and a 1,984 KiB filesystem at 0x610000, with
16 KiB inbound / 4 KiB outbound TLS records. A fresh build uses 2,109,904
application bytes, leaving 1,035,824 bytes. An incremental build retained
the old generated sdkconfig and failed; the fresh output directory is the
verified artifact source. The combined BIN is 2,175,440 bytes, SHA-256
`146ca9a4b13f88a11a78dc4570f25c4c2886347b72c667301411dca33d3362dc`.
Bootloader, partition table and app offsets were checked against the build.
Staging job `e4a01886-c56e-4083-b1fb-c4042b8e2adb` verified the Pi copy.
Flash job `5609ec7b-f3ca-4890-b024-1ed61301ce86` was submitted after preserving
Pico diagnostics; runtime validation is still pending.

## Portal browser validation

WebMCP uses the current `document.modelContext.registerTool` API with
page-lifetime cancellation. Actual Chrome 155 with WebMCP enabled listed
both tools. On the 2,377-row demo dataset, `envhub_query` returned bedroom
2,261 ppm and local 2,573 ppm for `MAX(co2)` grouped by zone. A DELETE
request was refused with `SELECT only`. Concurrent SQL requests share a
queue around Pyodide's globals. No device-write tool is exposed.

The separate opt-in Prompt API polyfill is pinned to 1.22.2 with
Transformers.js 4.3.0 and Qwen2.5-0.5B-Instruct q4. Native Prompt API remains
preferred. Both fresh WASM-worker and WebGPU sessions correctly answered
an arithmetic smoke check. q4f16 produced incorrect inference on this AMD
GPU despite advertised shader-f16 support, so the integration uses q4
weights with full-precision arithmetic (about 786 MB to download).

The final saved query/summary code was loaded into the warmed Chrome page
to avoid another model download, then exercised through the actual Ask
controls. It generated a grouped MAX(co2) SELECT, executed it against
SQLite, and correctly answered bedroom 2,261 ppm and local 2,573 ppm in
4.2 seconds. Earlier attempts with the longer schema and a shared summary
brief generated wrong queries or extra examples; those failures informed
the shorter SQL brief, two examples, first-fence extraction and separate
summary session. Read-only validation is enforced regardless of model output.

Ten browser integration unit tests, 13 SQL test groups, 20 certificate
test groups and inline/helper syntax checks pass. The controls fit a
390-pixel viewport. This is desktop browser validation, not a physical
phone performance claim. Browser cache writes were sometimes refused;
offline model availability is not guaranteed. Small-model answers can
still be wrong, and executed SQL/results remain visible for inspection.

The C5 copy was deployed before these final browser fixes. Update only its
`/www` assets after the eight-hour observer finishes, then verify the
served files. Do not interrupt the soak to update the portal.
