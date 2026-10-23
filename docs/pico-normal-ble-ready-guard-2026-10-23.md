# Production Bluetooth ready guard: normal Pico startup qualification

[HAL Pico #8](https://github.com/tyeth/hal_rpi_pico/pull/8) carries the firmware-ready
download guard as commit `de12fc2a0f75`, stacked on the earlier startup error-return
fix. [CircuitPython #32](https://github.com/tyeth/circuitpython/pull/32) pins it at
`0d545efdcf74`, with Zephyr `c6200e80ea69` and HAL Infineon `7f93dc606751`.

Both normal Pico variants build with clean actual dependency checkouts matching
the manifest. Their exact ELFs contain the Bluetooth startup, file-transfer and
serial workflow functions and no `envhub_bt_fault` diagnostic hooks. These are
normal builds, unlike the earlier workflow-disabled fault-injection images.

On physical Pico W, the candidate starts with the adapter enabled and
retains its original Bluetooth identity. Three disable/enable cycles then each
complete Wi-Fi and BLE scans. Counts below are Wi-Fi/BLE observations, not
throughput measurements or estimates of reliability.

| Board | Candidate scan counts | After restoring original code |
|---|---|---|
| Pico W | 70/70, 59/72, 78/75 | 67/74, 71/73, 55/67 |
| Pico 2 W | Candidate not installed; original-firmware preflight stalled | Original code untouched; imports/port state restored |

The exact production startup function passes 17/17 native UBSan controls; the
preceding source passes 8/17. The controls cover initial and already-ready states,
allocation/download/later startup errors, retries, and a controller reset clearing
readiness so that firmware downloads again. Run
`python3 tests/test_cybt_startup_retry.py` in the HAL PR checkout. This harness
does not model every physical controller failure.

## Reproduction and scope

Build the pinned CP branch with its matching west checkouts using
`make BOARD=raspberrypi_rpi_pico_w_zephyr` or
`make BOARD=raspberrypi_rpi_pico2_w_zephyr`. Preserve the current flash and use
the correct board image and layout. Run [the small normal-startup probe](../tools/repro_picow_bt_startup/probe_normal.py)
on either target. Its board and revision checks intentionally reject other builds.
The [earlier matched error-injection comparison](picow-bt-retry-ready-guard-2026-10-23.md)
remains the Pico W evidence for avoiding a repeated download after a failed open.
Normal disable/enable cycles are not equivalent to injected startup failures.

The first Pico 2 attempt failed before backup or any firmware write: a combined
initialization command on original `9e153ad624` returned raw-REPL `OK` without
completion. That failure is preserved. A separate no-flash control passed
interpreter, Wi-Fi and BLE initialization separately. The next qualification
attempt split and logged the preflight by stage: interpreter identification
passed, then the Wi-Fi command stalled before the BLE stage. Again no backup
or firmware write occurred. Both attempts restored imports and the off port
state without a bridge restart. The cause remains unresolved; the candidate
has not been tested on Pico 2, and the passing control is not a timing fix.
A further no-flash control printed markers before/after Wi-Fi import and each
property read, then checked BLE; all passed. The control uses a raw-response
recorder while qualification uses the existing Repl helper. Framing/timing and
firmware behavior still need a matched comparison; these two passes do not
erase either failed preflight.

A fresh full backup preceded the Pico W candidate installation. The transaction
restored original `9e153ad624` code and padding, verified the complete expected
flash image, and passed three subsequent Wi-Fi/BLE cycles. Restoration preserves
runtime data; the complete image is not claimed bit-identical to its pretest
backup. Pico W bindings were restored and the bridge was untouched. Sixteen
flash-transaction controls (eight per board) passed; Pico 2's tested transaction
has not reached its flash stage.

These results qualify bounded Pico W normal startup with automatic workflows
compiled in. They do not qualify Pico 2's candidate, end-to-end workflow
file/serial client transfers, forced-error retries on Pico 2, or natural
hardware-fault recovery. The separate
[console-close USB blocker](https://github.com/tyeth/circuitpython/issues/42)
remains open; both production boards retain their original firmware. No new
overnight soak is attributed to this candidate.

[Sanitized measurements, native case results and exact build hashes](pico-normal-ble-ready-guard-2026-10-23.json)
retain these limits. Raw recovery images and device identifiers remain private.
