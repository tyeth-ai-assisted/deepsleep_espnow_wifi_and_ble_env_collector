# BLE startup retry and build provenance, 22 October 2026

## Extended-scan guard and replacement Pico builds, 15:17 UTC

[CP #9](https://github.com/tyeth/circuitpython/issues/9) now has a source fix in
`a0c1485cf53a1f333a28cd3bb9dd307fd2470f36`: Zephyr `_bleio.start_scan(extended=True)`
raises `NotImplementedError` before replacing an existing scan or allocating
results. This explicitly reports the port limitation; it does not implement
extended-advertising support. Ordinary active/passive scanning is preserved.
The historical audit row saying the argument is still discarded is superseded.
The issue remains open pending review and hardware validation.

The actual C entry-point regression reproduces 11 failures out of 26 checks
before the fix, then passes all 26 with the guard. The 85 build-tool tests,
Ruff and whitespace checks pass. A BabbleSim integration case checks that an
existing scan survives rejection and a later ordinary scan still sees a beacon.
The focused integration case now passes on **both** `native_nrf5340bsim`
and `native_nrf54lm20bsim` (2 passed, 8 unrelated cases deselected, 28.51 s),
through `make test` after building both simulator boards. Each receives the
beacon with the original scan after the rejected request, then receives it
again with a subsequent ordinary scan. The same invocation passes all 85
build-tool tests. This is simulated radio evidence, not Pico hardware evidence.

Both Pico boards build from this exact commit with empty `CP_VERSION`, clean
tracked inputs, Zephyr `0589940bee`, HAL Infineon `7f93dc6067` and HAL RPi Pico
`725e9e429e`. Pico W BIN/RAM: 1,252,368/208,208 bytes. Pico 2 W BIN/RAM:
1,208,772/275,756 bytes. Both compiled wake/transfer/unlock checks pass, with
the older baseline rejected by the same check. Full hashes and pins are in
[the new manifest](firmware-pico-scan-a0c-2026-10-22.json).

The new `*-scan-a0c` binaries are staged and hash-verified on the Pi, not flashed.
The separate `update_picow_scan_a0c.py` retains the immediate full backup,
protected-region checks, readback and rollback safeguards; its nine Linux
transaction tests pass. Its live check refuses all four active soaks before
identity checks, SWD access, reset or flash. Prior d86 images/updaters remain
historical artifacts rather than being relabelled.

The physical failed-start test boundary was rechecked offline against the new
Pico W BIN and ELF. No debug attachment or injected failure has been performed.
The running Pico soak still covers the older baseline, not this candidate.

Perfetto 0.58.2 is installed in the existing WSL test environment, with protobuf
6.33.5 retained to match the port's CI pin. The missing protobuf compiler was
supplied by grpcio-tools 1.81.1; `pip check` reports no broken requirements.
All twelve BabbleSim project revisions match the pinned manifest and its tools
build successfully. Initial missing-Perfetto/missing-protoc failures and the
pre-setup simulator skips are environment results, not successful test runs.

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

## Current branch rebuilt and staged, 14:28 UTC

Both boards now also build from CircuitPython `d86cb7ae956e953afb076cbb896a5a2934deb732`,
including the restored empty-version fallback. The build deliberately exported
`CP_VERSION=""`, used new `build-envhub-version-d86-*` directories, and verified
the exact CircuitPython/Zephyr/HAL checkouts before and after compilation.
Zephyr `0589940bee`, HAL Infineon `7f93dc6067` and HAL RPi Pico `725e9e429e`
are unchanged. Both embedded version strings identify the clean d86 commit.

| Board | BIN bytes | Linked RAM bytes | BIN SHA-256 |
|---|---:|---:|---|
| Pico W | 1,252,352 | 208,208 | `9b94e04baee6941bb8d064bbacb0f9489cb51cf305dda654d9308a349e7c0399` |
| Pico 2 W | 1,208,764 | 275,756 | `f5b980f2307b3a4edca731b277c30e6b913c81c0dc84d555d7efde252b226255` |

Artifact collection checks the actual compiler input paths and TLS/USB
configuration. The disassembly check now parses call instructions in each
function: the read path must call `bt_backplane_begin`, then the transfer,
then unlock; the begin function must lock before its WLAN wake call and
contain failure-path unlock. Both new ELFs pass. The preserved single-MSC
Pico W ELF fails the same check, confirming it distinguishes the baseline
that lacks the wake guard. This proves compiled call structure, not runtime
concurrency or full-duration stability.

Full BIN/UF2/ELF/MAP metadata is in
`firmware-pico-version-d86-2026-10-22.json`. Pi staging job
`f422c552-2174-490b-9b66-b94a0679a1ea` passed at 14:27:33 UTC and verified both
BIN hashes under distinct `*-zephyr-alpha2-version-d86.bin` names. Previous
5bb candidate artifacts and baseline evidence are preserved.

The preferred Pico W updater is now `update_picow_version_d86.py`, SHA-256
`0e7960168466008641029b2baa6ec3aa7128252f2a95df3805a30be3529bf836`.
It retains the earlier identity, private-backup, protected-region readback,
rollback and active-observer guards, with the new image hash and separate
`pico-version-d86-update` evidence names. Nine transaction tests pass under
Linux/WSL. The Windows attempt could not exercise the Linux `fcntl` paths;
it is not counted as a pass.

Updater staging job `b55da51a-394c-4a28-a095-c153d91a9a74` passed at 14:27:54
UTC: exact old/new inputs validated, and the readiness check refused all
four active observers before identity, SWD, reset or flash access. Neither
new image is installed or physically validated. The missing probe, physical
startup-failure/retry test, Pico 2 W validation and a fresh full eight-hour
candidate soak remain outstanding.
