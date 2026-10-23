# Pico W console-close storage stall — 23 October 2026

Tracked in [CircuitPython fork #42](https://github.com/tyeth/circuitpython/issues/42).

Closing Pico W's USB serial console can stall a read-only MSC command until the console is reopened. This is physically reproduced on the older CircuitPython `9e153ad624` integration and is also observed during attempted rollout of `6839890534` / Zephyr `c6200e80ea`. It is not established as a regression introduced by the two new USB reconfiguration fixes.

Both builds are based on official 11.0.0-alpha.2. Device: `raspberrypi_rpi_pico_w_zephyr`, RP2040, direct Linux xHCI USB connection. This reproduction does not use the S31/USB-IP bridge. Pico 2 and other UDC implementations have not been qualified for this trigger.

## Matched physical controls on 9e153ad624

All reads are the same uncached 4 KiB range, with identical hashes and no device filesystem writes or firmware changes.

| Host console state | Read time |
|---|---:|
| Open | about 31 ms |
| Handle open, DTR deasserted | about 31 ms; also 60 ms in the repeat |
| Closed, reopen scheduled after 2 s | 2.068 s |
| Closed, reopen scheduled after 4 s | 4.066 s |
| Open after reconnect | about 30–53 ms |
| Closed, reopen scheduled after 1 s | 30 ms; this attempt did **not** stall |

The trigger is intermittent; do not claim every close stalls. A separate sleep / CPU-busy / sleep control completed the same reads in 31 / 32 / 60 ms while Python executed an eight-second workload. That control does not support changing thread priority as a fix.

## Candidate rollout and USB trace

Two actual `6839890534` attempts answered CDC but timed out after 10 seconds in `blockdev --getsize64` before any repeated SET_CONFIGURATION test. The second attempt captured 15,762 USBmon events with zero reported drops or packet truncation. The candidate runtime's delayed TEST UNIT READY command completed successfully after 10.126 seconds, as recovery opened the console. All captured MSC command wrappers have matching status wrappers; this is host-request evidence, not an electrical bus trace.

The first automatic restore was blocked before writing by a timed-out `usb-storage` unbind. A separate guarded recovery requested ROM through CDC without waiting for that unbind and restored the original code with whole-image verification and three radio checks. The traced attempt used that recovery path and also restored successfully. Both production Picos remain on `9e153ad624`; the new USB build is not retained in production.

## Minimal reproduction

1. On a Pico W running the revision above, use a verified, unmounted CIRCUITPY block device and its matching serial device. Keep HID/USB configuration unchanged.
2. Open the console, enter/leave raw REPL and confirm the firmware banner. With the serial handle open, time `dd if=/dev/<DUT-disk> bs=4096 count=1 iflag=direct status=none` and retain the hash.
3. Keep the handle open but deassert DTR. Repeat the same read, then restore DTR. This is the negative control.
4. Close the serial handle. Schedule a fresh open at the same baud (115200, not the 1200-baud bootloader trigger) after two or four seconds. Immediately issue the identical uncached read with a bounded host timeout. Compare its completion time with the scheduled reopen.
5. Repeat open-console controls and compare exact read hashes. Preserve the non-stalling close attempts too. Restore the original host bindings.

Do not infer a flash/storage data-corruption defect from this delay. Root cause and whether the owner is CircuitPython, Zephyr UDC/class code, or host interaction remain open. The existing Zephyr SET_CONFIGURATION and cancelled-OUT reports (#121843 and #122768) and CircuitPython #11531 are related USB work, but equivalence to this trigger is not established. See [fork integration PR #32](https://github.com/tyeth/circuitpython/pull/32) for the existing USB fixes; this report is an additional rollout blocker.

Raw flash backups, kernel logs and the 25,864,944-byte USBmon capture remain private. The adjacent JSON retains sanitized timing and hash evidence. Four native decoder controls cover command/status pairing, missing status, negative USB completion and failed SCSI status. The unchanged flash transaction modules pass eight fault controls per Pico variant. No priority or USB source change is made in response to this finding.
