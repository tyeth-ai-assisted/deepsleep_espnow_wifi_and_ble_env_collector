# CircuitPython 11 refresh and farm soak — 22 October 2026

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
These Zephyr images have not been flashed in this refresh. A custom
firmware `BUILD` directory was leaking into the nested host mpy-cross
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
