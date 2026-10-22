# Issue investigation coverage — 22 October 2026, 23:35 UTC

**No: the work is not fully investigated or physically verified.** This ledger
reconciles the original `bugs_issues_and_todos.md` with the CP #15 escalation
index. More soak time is now lower priority than these specific gaps. A source
fix, a native fault-injection test and a physical-board test are separate kinds
of evidence. Historical notes below are not new reproductions.

## New targeted evidence

- Feather ESP32-S3, 4 MB flash / 2 MB PSRAM, actual banner
  `CircuitPython 11.0.0-alpha.2-15-gcb5301b6fb-dirty on 2026-10-22`:
  five BLE disable/re-enable cycles passed; each subsequent two-second scan
  received advertisements (111, 111, 106, 118, 112). Five absent-card SD
  constructors raised `OSError: no SD card`; SPI was immediately lockable after
  every failure. No firmware/file writes or resets were performed. Original
  port-off state and detached imports were restored. This does **not** recreate
  the original post-connected-NUS-session teardown with ESP-NOW running, nor
  the C6 shared display/SD configuration.
- HAL Pico #6: compiling the actual `cyw43_btbus_init` function and injecting
  allocation, download, ready, buffer-init and awake failures gives six passing
  candidate cases including success. The preceding revision aborts on the
  ready, buffer-init and awake cases. Cleanup and the absence of later startup
  stages are checked. This is native execution with mocked hardware hooks.
- HAL Pico #3: four actual-function controls demonstrate normal cached access,
  a dropped write with divergent cache/hardware, a noncached hardware read,
  and an out-of-band hardware change. A HOST_CTRL read does not verify hardware
  and the write wrapper reports success in the injected lost-write case. This
  is a diagnostic limitation; no physical lost write or stall cause is proved.
- Historical ESP BLE notification changes `8042913c2e` (PacketBuffer) and
  `f3926284f8` (Characteristic.value) are ancestors of both official alpha.2
  (`d53b2277cf`) and deployed ESP integration `cb5301b6fb`. They are upstream
  changes, not missing fork patches. Fresh burst/disconnect regression remains.
- Existing host regressions for RTC logic, UTC/timezone rules, ESP-NOW message
  confirmation, and datastore/history relabel/recovery pass. The datastore
  suite used an isolated scratch directory; the first attempt was stopped by
  filesystem permission before assertions. These tests do not measure flash
  latency, actual RTC battery retention or physical power-cut recovery.

Run the new native reproduction with a configured C compiler:

```sh
python3 tools/check_pico_btbus_reports.py /path/to/hal_rpi_pico \
  --baseline cc2ea478cd42c70f17562f983e6cb0e5f520bdee \
  --output /tmp/pico-btbus-results.json
```

Use HAL revision `725e9e429eab65eda01762a1af9016426dee00ac` for the recorded
candidate. The script extracts exact functions rather than reimplementing
their control flow. See [native evidence](pico-btbus-reproduction-2026-10-22.json)
and [hardware evidence](s3-targeted-issue-checks-2026-10-22.json).

## Original firmware reports

Numbers refer to headings in the original bug document, not GitHub IDs.

| Report | Current evidence / disposition | Remaining targeted check |
|---|---|---|
| 0, 1, 5, 6, 10: C6 AP/DHCP/import/BLE/ESP-NOW memory failures | Later August notes identify IDF heap starvation and the reserve workaround, correcting earlier coexistence-only diagnoses. Reserve and frozen libraries are carried. C5 application/HTTPS overnight results are useful but are not a C6 reproduction. | Current C6, heavy imports and controlled heap pressure; both radio initialization orders; actual station DHCP and ESP-NOW sends. Capture error/backtrace if allocation fails. |
| 2: Wi-Fi/socket creation leaves shared SPI locked | Historical staged observation; no fresh proof of corruption. | Probe lock ownership around AP, UDP/socket and display setup on the original shared-bus wiring. Distinguish bus ownership from a corrupted flag. |
| 3: failed SD init leaves SPI locked | Current constructor unlocks after normal `init_card` error returns. Five physical S3 absent-card cases now pass. | C6/shared display setup and exceptional SPI/configure failures. Do not close the broader report from S3 alone. |
| 4: e-paper splash refresh / misleading errors | Workaround assigns a real root group; display behaviour has not been freshly measured. | Instrument timer, busy and bus ownership separately; reproduce splash versus explicit group on the actual panel. |
| 7: BLE-mode memory starvation | Historical application fix gates HTTP imports; recorded resolved on the earlier bench. | Current constrained C6 boot and GATT connection with the intended display configuration. Silent low-memory GATT failure remains a separate diagnostic concern. |
| 8: dropped BLE notifications | Upstream alpha.2 contains notification/PacketBuffer retry fixes. | Count a long unpaced transfer at low MTU under radio/display load, including its final packet. |
| 9: PacketBuffer blocks after disconnect | Upstream code now checks disconnect inside its wait loop and retains/retries ENOMEM data. | Disconnect a real central mid-burst, bound return time, reconnect and verify no stale bytes. |
| 11: S3 adapter disable hard-fault / cannot re-enable | Five physical disable/re-enable/scan cycles pass on current Feather S3. | Repeat after a connected Nordic UART session with Wi-Fi and ESP-NOW resident, the historical trigger. |
| Large code.py prevents Wi-Fi initialization | Historical MPY shim and current frozen libraries address memory placement. Eleven variants build; current app has completed deep-sleep/report cycles. | Board-specific cold-boot qualification, especially C6 with the real sensor/display load; no claim that compilation removes all memory limits. |
| Raw-REPL write then hard-reset filesystem corruption; S3 MSC write crashes | Historical evidence and safe deployment workarounds retained. | Disposable backed-up filesystem with explicit flush/soft reload controls and concurrent-radio variants. Avoid corrupting the live application store to obtain evidence. |
| sleep_memory after soft reload | Original document distinguishes reload from deep sleep. True deep-sleep confirmations passed in the application run. | Inspect the intended lifetime contract before treating reload clearing as a firmware defect; targeted sentinel check if needed. |
| Windows empty GATT table / Service Changed | Still a report; cache mechanism unconfirmed. | Same device address, deliberate service-table change, cached versus uncached Windows discovery and Service Changed observation. |
| jd79667 logging/defaults; mpremote new-file ENOENT | Historical library/tool reports, not investigated in this refresh. | Pin installed/upstream versions and produce minimal library/tool reproductions before filing duplicates. |

## Application TODOs and known limits

| Item | Coverage and next step |
|---|---|
| Node MPY shim, wake/report/deep sleep | Real sleep and confirmation cycles passed; sensor data in that run was simulated. Real SCD41 sampling is not qualified. |
| RTC detection, sync, battery retention, drift | Host register/detection/sync cases pass. Inventory the real RTC first; coin-cell retention, cell changes, drift and ambiguous chip identification remain physical tests. |
| UTC/NTP/browser time and calibration offset | Host timezone tests pass. Physical NTP/display observation and real scheduled calibration are separate. |
| Missing SD/day files, low-memory sensor startup | Historical root cause documented: unmounted directory/unsynced rows and uncaught MemoryError. Current real SD/sensor startup not requalified. |
| History RAM rows, relabel, interrupted job, read-only drive | Existing host suite freshly passes. Large-file flash timing plus simultaneous HTTP/ESP-NOW and real interruption remain. |
| Node autoconnect; collector in station mode; channel agility | Historical AP-channel 6/11 bench success. Autoconnect and router-channel variants still need targeted tests. |
| Outage stash, hub time correction, real sensor discovery | Confirmation protocol host tests and simulated-sensor overnight delivery pass. Fresh collector-outage replay and real-sensor test remain. Unsynced duplicates remain a documented design limit. |
| ESP-NOW buffer corruption / peer limits / broadcast / channel mismatch | Historical guards documented for upstream #9816/#7903/#9380 and peer limits. Fault-injected current guard tests and current upstream status reconciliation remain; unused PHY-rate feature is not an application blocker. |
| Battery watermark | Requires a controlled battery/unplug event; not verified by USB port commands alone. |
| Calibration | Historical hub dry-run only; node window/result end-to-end still unverified. Do not perform an actual sensor FRC just to test transport. |
| AI model download progress and revisit cache | Implemented/tested portal paths. Android emulator retained model through page, Chrome and emulator restarts; offline inference did not download weights. Physical phone memory/performance remains unknown. Emulator lacks supported AICore; JS fallback is separate. |
| QT Py / tri-colour display rig and BUSY wiring | Physical rig work outstanding; not established by builds. |
| GitHub Pages and Adafruit IO | Deployment/future feature TODOs, not firmware defects; outside the present targeted regression pass. |

## CP #15 / Zephyr / HAL index

The [source audit](upstream-disposition-2026-10-22.md) contains exact upstream
revisions, closure reasoning and minimal reproductions. Its earlier timed
status sections are historical; completed hardware results are in the later
rollout and follow-up reports.

| Group | Status |
|---|---|
| Zephyr #5/#7, HAL Pico #7; CP #24 and console-wake portion of #20 | Upstream resolution checked; duplicate patches omitted or older-release compatibility patches retained as appropriate. |
| CP #26 TLS policy, #27 startup retry, #28 empty version, #9 extended-scan contract, #10 version refresh | Executed source/native/simulator regression evidence; physical failure injection is not implied. |
| Zephyr #3 settings geometry, #10 p256-m; shared-bus window/power/wake/RX locks | Reproduced and fixed/worked around with exact-source controls; earlier physical stall cause remains unproved. |
| HAL Pico #6 startup assertions | Newly executed native failure injection now passes candidate / fails old source. Hardware injection still unrun. |
| HAL Pico #3 HOST_CTRL cache | Newly reproduced cache/hardware divergence under injected lost write. Production cache policy and physical incidence unresolved. |
| Zephyr #6 USB stack | 2048-byte configuration built; instrumented Pico 2 W 512/2048 comparison outstanding. |
| Zephyr #8 softAP | Source fix carried; actual station association, DHCP and deauthentication on current Pico 2 W outstanding. |
| Zephyr #9 legacy timeout | Source still omits timeout in legacy HCI path; CircuitPython host deadline works around it. Direct low-level timed-radio reproduction outstanding. |
| HAL Infineon #2 coexistence assets | Asset selection audited; current Pico W two-hour and Pico 2 W thirty-minute concurrent-radio runs passed. This does not prove every traffic pattern. |
| CP #25 warm reset | Earlier 45% failure claim retracted after 45/45 successes; original trigger unresolved. |
| CP #29 Windows GATT cache | Unconfirmed mechanism; see targeted test above. |
| CP #8/#12/#16/#30, flash layouts, connection/memory choices | Project integration/configuration; do not label every choice an upstream defect. |
| ESP-IDF DHCP debug-format PR #19074 | Previously checked open/unmerged; final state must be refreshed before the concluding CP #15 comment. |

## Bench transport and board coverage

- Bridge interface-claim cleanup is implemented and installed; 24 source cases
  and five sequential Pico composite imports passed. Simultaneous endpoint
  capacity and injected hardware failure recovery remain unverified.
- Controller power/disappearance checks have 61 passing tests and a draft fix,
  but are not deployed. Capacity scheduling and stale imports remain open.
- Metro S3 full backup failed twice with a 4095-byte frame where 4096 was
  expected, at two baud settings. A strict 512-byte/window-one reader verified
  a 64 KiB prefix. Root cause and full backup remain unresolved; no Metro
  firmware writes occurred. Do not attribute this to S31 definitively.
- Feather S3 is updated and has the targeted tests above. Metro S3, other
  build-only variants, connected-session BLE, physical displays/RTC/sensors
  and the instrumented Pico tests remain explicit gaps. Three completed
  overnight runs and later targeted follow-ups retain their actual revisions;
  a newer image is not retrospectively covered by an older soak.

The goal remains active. The final CP #15 comment has not been posted; it must
carry the remaining limitations rather than claim every issue is resolved.
