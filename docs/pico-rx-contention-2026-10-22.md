# Pico receive-lock failure investigation — 22 October 2026

The `a0c1485cf5` Pico W two-hour Wi-Fi/BLE soak **failed**, rather than completing.
It started at 15:51:33 UTC and failed at 17:02:09 UTC after 140 completed cycles
and 4,236.05 seconds. The next raw-REPL command acknowledged with `OK` but never
returned its result or end markers. The final completed cycle took 5.729 seconds
and saw 44 Wi-Fi networks and 24 BLE advertisements. There was no USB disconnect
in the inspected failure window. A subsequent passive read and one Ctrl-C
produced no output. Logs and original evidence remain preserved; the unavailable
SWD probe prevented a live RAM/thread capture.

The independent reporter rejects this run as failed and shorter than its
configured 7,200 seconds. Its status SHA256 is
`bafaa2841a50cfc0be9f3acc904bd85cee64ce443925185633c0db1ad3d08434`, and its
cycles SHA256 is `30c2441ba4b17d9f23de10d18ee0023effdfe94b79a3c41f5ca09e6aeae3ee0d`.

## Reproduced source defect

The CYW43 polling thread held the shared Wi-Fi/BLE bus mutex across host receive
buffer allocation and delivery. Allocation may wait indefinitely, while a
consumer that releases a buffer may itself need the bus. The new regression
compiles the actual polling, ring-check and receive functions with a competing
consumer thread. A bounded lock attempt exposes the circular wait without
hanging the test runner.

Seven of twelve cases fail on Zephyr `353bcd30f7`. All twelve pass with
`7379648278ab49e391af00f1a62ec73387d4c519`: controller ring checks and reads stay
locked, while host allocation and delivery occur after unlocking. Error exits,
discardable advertising reports, ACL/ISO packets and the 32-packet drain bound
are covered. The existing 25 bus-wake checks pass; checkpatch reports no errors
or warnings. Both new ELFs independently show the corrected lock/unlock order.

Minimal reproduction, from the integration Zephyr checkout:

```sh
python3 tests/drivers/bluetooth/cyw43_rx_bus_contention.py --root . --baseline 353bcd30f76e1fa140291540dde20334e952e0e6
python3 tests/drivers/bluetooth/cyw43_rx_bus_contention.py --root .
```

The first invocation is expected to fail. This proves a driver lock-contract
defect; it does **not** establish that this exact path caused the physical stall.
The fix is in [Zephyr PR 11](https://github.com/tyeth/zephyr/pull/11), pinned by
[CircuitPython PR 32](https://github.com/tyeth/circuitpython/pull/32).

## Current integration validation

The exact `7d4ef1aac7` / `7379648278` integration was rebuilt and tested after
the receive-lock fix. All ten BLE scan cases pass across the nRF5340 and
nRF54LM20 simulators (39.54 seconds): beacon reception, reload, entry properties,
passive scanning, and preserving an active scan after an unsupported extended
request. All 85 build-tool tests pass (1.20 seconds). Actual checkout pins and
tracked cleanliness were checked before and after, with empty `CP_VERSION`.
See the [command, pins and log digest](pico-rx-integration-tests-2026-10-22.json).
These Nordic simulator checks cover integration behavior; they do not exercise
the CYW43 hardware driver or replace the running Pico W soak.

## New candidate and physical checks

CircuitPython `7d4ef1aac72bf322f1bcead966a8d3eac0acb2af` selects Zephyr
`7379648278ab49e391af00f1a62ec73387d4c519`, HAL Infineon `7f93dc6067` and HAL
RPi Pico `725e9e429e`. Actual clean build checkouts match all manifest pins.
Both boards build with empty `CP_VERSION`; the version falls back to Git.

| Board | BIN bytes | Static RAM bytes | BIN SHA256 |
|---|---:|---:|---|
| Pico W | 1,252,392 | 208,208 | `827d391a777aba31bb9d029d5d7ca6ec3e6b9379448a14dbbe3ebce864883ce2` |
| Pico 2 W | 1,208,788 | 275,756 | `f29892f2a02922090ecde2d4841907ef779ea0c7838590f90d2ea65ec7ad8f52` |

The failed Pico W was recovered using its supported 1200-baud USB bootloader
entry. Its immediate private 2 MiB backup matched the expected old firmware.
Programming, full readback and unchanged bytes beyond the programmed sectors
passed. No shared hub or other DUT was reset. The failed run remains failed.

Physical preflight passed at 17:25:43 UTC: exact new runtime identity, retained
BLE address, 223 advertisements on the original scan after extended-mode
rejection, 226 on a later ordinary scan, Wi-Fi connection, trusted TLS with 55
BLE advertisements, and wrong-hostname rejection. This is Pico W proof only;
Pico 2 W is built and staged, not physically qualified.

A **new two-hour soak** began at 17:26:05 UTC, due about 19:26 UTC. At 17:28 UTC
it had four successful cycles and remained running, not passed. Two hours was
chosen to exceed the prior failure at 71 minutes; it supersedes the earlier
one-hour plan for the uninstalled `1ca79521f3` candidate. Its run-record SHA256
is `a119c4a3b5d3114e5445c9d2213674bbdf9e3a801a846d31702613a74b645594`.

The three original eight-hour application, Feather and trusted-HTTPS runs remain
uninterrupted. At 17:28 UTC: 170 application deliveries/true wakes, 688 HTTP
successes plus the earlier startup error, 162 BLE successes without BLE errors;
686 Feather cycles; 172 HTTPS cycles without errors. None has completed yet.

The revised portal rollout gate requires those three full eight-hour passes and
the new Pico two-hour pass, plus the preserved failed predecessor. Nineteen gate
tests pass; the live check refused all four active runs before device access.
Portal revision `83526b0` remains staged, not installed. Physical failure/retry
injection, remaining board/USB/AP coverage and final upstream index remain open.
