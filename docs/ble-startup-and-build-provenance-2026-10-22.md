# BLE startup retry and build provenance, 22 October 2026

The synchronized candidate builds and source regressions pass. It is staged on Pi, not flashed. Physical failed-start recovery, a fresh full eight-hour soak and Pico 2 W runtime validation remain outstanding. CircuitPython issue #27 stays open.

## Correction to earlier Pico build attribution

Earlier reports named Zephyr `560a6a2f4` because the CircuitPython manifest requested it. The actual west checkout used for compilation remained at `ea703e85b6`. The manifest update had not synchronized that checkout. HAL Infineon was correctly at `7f93dc6067`.

This affects the `9f2ff6968d` bus-power artifacts and `1609ec9b0b` single-MSC artifacts, including the current Pico radio run 03. The published JSON metadata is corrected without changing any binary hashes; the originally requested pin is retained in a separate field. Both variants' preserved Pico W and Pico 2 W ELFs call `bt_whd_driver` then `whd_bus_transfer_backplane_bytes` directly from `cyw43_ll_read_backplane_mem`. They do not call the new `bt_backplane_begin` guard. The local checkout reflog and compiler source paths independently confirm the stale checkout.

The running Pico W BIN SHA-256 remains `17f2ce1fc5084c6290f4021a23bb569cfd7accb7a88d2da8b31d3a748917f1ff`; its preserved ELF is `57d6ba0c0711ab9fc67b5e38085e4180a657e7ec7ad676cef8604630bbaa5256`. Earlier Wi-Fi/TLS/BLE/USB results remain observations of those binaries, but do not establish hardware validation of the complete Zephyr bus-wake fix. The live run is preserved as baseline evidence. No device or running observer was interrupted for this correction.

## Failed-start behavior

If `bt_hci_open()` fails, the old Zephyr host leaves `BT_DEV_ENABLE` set. A later CircuitPython retry accepts `-EALREADY` and loads settings before host initialization, potentially scheduling an uninitialized GATT work item. The correction:

- Releases failed settings-initialization state. On controller-open failure it stops the dedicated receive thread, clears the callback, then releases ENABLE so a retry actually opens and initializes the controller.
- Avoids `bt_disable()` at that point: its cleanup assumes initialized host state and can attempt controller commands despite the failed open.
- Accepts `-EALREADY` in CircuitPython only if the host is ready. Settings errors propagate, and successful settings loading must establish readiness.
- Checks readiness before direct adapter address reads, preventing identity access/creation after a failed startup.

Later failures inside `bt_init()` remain errors; the patch does not promise recovery of every partially initialized host. Logical disable still keeps the controller running. Native transport recovery needs board testing.

`tools/check_zephyr_ble_startup.py` compiles the actual production functions with deterministic kernel/controller/settings stubs. The original sources fail 18/30 checks with the system receive workqueue and 19/30 with a dedicated receive workqueue. The corrected build-local sources pass all 60 under UBSan, including repeated asynchronous open errors, real retries, ready-state races, settings errors and direct address reads. The synchronized bus-wake harness separately passes 25 cases. These are source-level tests, not physical fault injection or concurrency/soak proof.

## Synchronized candidate

- CircuitPython: `5bb1d640043691aa16a00137e710b19e0fc23fbc` ([PR 32](https://github.com/tyeth/circuitpython/pull/32)).
- Zephyr: `0589940bee3386b144961901717b2bce3576a2d6` ([PR 11](https://github.com/tyeth/zephyr/pull/11)).
- HAL Infineon: `7f93dc60675126a63358ffa0780648d94fd2d634`; HAL RPi Pico: `725e9e429eab65eda01762a1af9016426dee00ac`.

Both builds use separate `build-envhub-ble-retry-*` directories. The build preflight verifies actual checkout revisions against the manifest and rejects tracked edits or stale pins. Artifact collection repeats the check, verifies compiler input paths and the CircuitPython version embedded in the binary, and checks both ELFs for bus wake/access/unlock calls. It records actual Git revisions rather than copying requested pins into metadata.

| Board | BIN bytes | Linked RAM bytes | BIN SHA-256 |
|---|---:|---:|---|
| Pico W | 1,252,352 | 208,208 | `2913c0ec93aa988b29a8e33183ea90410f4c18cb065f7a987de29515573ecafb` |
| Pico 2 W | 1,208,764 | 275,756 | `9a4ba07fb55f4eee10b9ccc5842e6a1bd25fb333636a856c4cfe96864563bd85` |

Full artifact metadata is in `firmware-pico-ble-retry-2026-10-22.json`. Staging job `d797c582-dbf4-4bc7-ba3d-c23326934658` passed at 13:29:39 UTC, verifying both BIN hashes on Pi and saving the provenance correction alongside the older manifest. Staging did not access a DUT.

The latest release check still returned 11.0.0-alpha.2, published 21 October; no alpha.3 was listed. At 13:14 UTC the four existing observers remained active with no recorded test failures. Their current deadlines are unchanged, but a passing baseline Pico run cannot substitute for the new candidate's full-duration test.

## Guarded Pico W rollout preparation, 13:49 UTC

`update_picow_ble_retry.py` is staged on Pi, SHA-256 `e904936f03859e4dbae9bacf591b1ccb7bb5c63bc3e462cc99d7b35d865a864f`. It has not programmed a board. The helper reuses the hash-pinned independent four-run readiness gate: all current observers must be inactive with PID zero and have consistent, complete eight-hour evidence before it checks devices or accesses SWD.

The transaction requires the expected Pico and probe USB identities, an unused console, unmounted Pico storage, no other OpenOCD process, and the exact old/new firmware hashes. It saves an immediate private 2 MiB snapshot and confirms the installed firmware before programming. It verifies the new image and every byte beyond the final programmed erase sector, including Zephyr settings at `0x17e000`, NVM at `0x180000` and the FAT filesystem at `0x181000`. A failed write or readback attempts restoration from that immediate snapshot; failed recovery prevents resume. Runtime validation remains a separate required step after a verified install.

Nine offline transaction tests pass. They cover success, incomplete or unexpected backups, a changed candidate, lost programming acknowledgement, readback failure, protected-data corruption, failed recovery, and a newly started observer preventing every board operation including reset. These exercise a simulated flash backend; they do not prove the physical programming path.

Staging job `7bc0bbb8-7c33-47dd-ac3b-e2253fa5ebd8` passed at 13:45:24 UTC. Both image hashes validated, and `--check` returned refusal for all four active observers before device identity, SWD, reset or flash access.

The 13:37 USB inventory found the running Pico W, Feather and S31 UART on Pi, plus the two imported C5/C61 UARTs. Other S31 board ports remain off. The previously used SWD probe was absent from enumeration. Its cause is not established: read-only port-status attempts could not run because `uhubctl` and PyUSB are absent on the selected Pi environments. No hub power or reset was attempted. Revalidate topology before the eventual update; the helper refuses a missing probe. Latest confirmed Pico baseline progress at 13:36 UTC was 322 cycles/9,635.84 seconds with no recorded failure, exceeding the prior attempt's stopping point but still short of eight hours.
