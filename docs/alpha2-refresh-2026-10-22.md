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
