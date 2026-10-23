# Issue investigation coverage — updated 23 October 2026, 10:42 UTC

**No: the work is not fully investigated or physically verified.** This ledger
reconciles the original `bugs_issues_and_todos.md` with the CP #15 escalation
index. More soak time is now lower priority than these specific gaps. A source
fix, a native fault-injection test and a physical-board test are separate kinds
of evidence. Historical notes below are not new reproductions.

## Update on 23 October: DHCP scheduling failure reproduced and candidate passes

The earlier DHCP failure is now narrowed to socket-service starvation. On the
same binary, Pico-side sleeps let a lease arrive; changing only the service
priority from 15 to the interpreter's 0 also passes with no sleeps. A 15-second
busy-loop control acquires a lease in 4.467 seconds while Python continues
computing. The shared configuration fix is committed as `6b117bdce5`.
The production Pico 2 image now passes channel 1/6/11, DHCP, ping, matching station MAC/IP, departure and AP stop/restart. Cleanup passed. Pico W production rollout and the same AP checks now also pass, including BLE scans with a station associated. See the [controlled reproduction, provenance and limits](pico2-dhcp-scheduling-2026-10-23.md) and [production hardware evidence](pico2-production-ap-qualification-2026-10-23.json).

Both current Pico 2 512/2048-byte USB-worker diagnostics pass the same short concurrent CDC, read-only MSC, Wi-Fi/BLE workload. The maximum measured use is 260 bytes; this does not reproduce a 512-byte shortage. Production firmware was restored exactly. MSC writes, idle re-enumeration and broader stress remain open. See [the comparison](pico2-usb-stack-comparison-2026-10-23.md). The separately measured DHCP socket-service stack
reached 2184 of 2400 bytes with debug logging.

The historical ESP sleep-memory reload defect is already fixed upstream by
[CP #11274](https://github.com/adafruit/circuitpython/pull/11274), merge
`2a15ee1978b9c2fe10a77dcc26433cf1c658c766`. Ancestry was verified in both
official alpha.2 and deployed `cb5301b6fb`; no duplicate patch is needed.
This is source reconciliation, not a new physical sentinel test.

## Pico W production follow-up and newly verified API gap

Pico W production `6b117` now passes actual channel 1/6/11, DHCP, ping, matching
station MAC/IP, departure and AP stop/restart. Concurrent BLE scan and extended
request rejection controls also pass. Fresh full backup/readback and preserved
BLE identity passed. See [the report](picow-production-qualification-2026-10-23.md).

Separately, the earlier image remained connected after `stop_station()`: the
function was a no-op in the preceding integration and audited upstream source.
[CP fork #40](https://github.com/tyeth/circuitpython/issues/40) tracks the minimal
reproduction. The fix at `9e153ad624` now passes 46 native checks and physical Pico W connect/stop/reconnect, disabled-start and AP-preservation tests, including cleanup. Pico 2 now also passes these lifecycle checks at the same revision after full-flash/runtime verification; bounded trusted TLS with BLE and three certificate-rejection controls pass. Certificate date validity is deliberately unchecked. See [Pico 2 evidence and preserved fixture failures](pico2-station-tls-2026-10-23.md). See [the station lifecycle evidence](picow-station-lifecycle-2026-10-23.md).

## Earlier finding, superseded for DHCP by the production result above

On Pico 2 W at `7d4ef1aac7`, a direct-UART Feather ESP32 V2 station at
`cb5301b6fb-dirty` sees channel 1 and associates. Six AP station-table samples
show the station but no lease. The station's `connect(timeout=10)` still waits
at the 25-second host deadline; after interruption it reports associated with
address `0.0.0.0`. A static-address reconnect succeeds and pings the AP in
15 ms. Explicitly stopping/restarting the station DHCP client also fails to
complete the combined connect/ping command within 30 seconds. Thus the
association and basic IP path worked; this baseline had a faulty DHCP exchange.

The ESP timeout symptom matches existing upstream [CircuitPython #7557](https://github.com/adafruit/circuitpython/issues/7557).
It is separate from the DHCP scheduling failure subsequently fixed above. Do not close the
softAP tracker or call the diagnostic job's successful completion an AP pass.
The first combined test also failed station cleanup; a subsequent bounded
Ctrl-C recovery restored it. Both later tests confirmed station/AP cleanup.

A separate attempt using two S31 composite-device imports failed before AP
start: Pico console worked, but the S3 console did not respond. Both imports
were detached and original port states restored. The installed bridge still
claims every interface on first data traffic; unbinding host-side unused
drivers does not release those bridge claims. This supports investigating
channel pressure, but does not establish the failure's root cause.

The diagnostic image was subsequently flashed and measured, then replaced by the production fix. Channels 6/11 and station departure now pass. The later current-revision 512/2048 comparison is reported above. See [sanitized evidence](pico2-ap-dhcp-investigation-2026-10-22.json).

Minimal paired reproduction (use disposable bench credentials): start a Pico
AP on channel 1; on an ESP station call `start_station()`, `stop_dhcp()`,
`start_dhcp()`, then `connect(ssid, password, timeout=10)`. Independently sample
the AP station table and enforce a host deadline with Ctrl-C recovery. Compare
with a static station address in the same subnet and ping the AP. Stop the AP
and station, then restore the station DHCP client. This does not require a soak.

## Update at 23:41 UTC: connected-session BLE passes on Feather S3

A real BlueZ central received all 10,240 bytes from an unpaced Nordic UART
transfer, with the expected SHA-256. It then disconnected during an active
PacketBuffer burst. The write loop returned zero, reported disconnected and
returned to the host in 2.20 seconds after the disconnect request. Bytes queued
at disconnect were intentionally not expected to arrive. Reconnection produced
no unsolicited stale bytes, then delivered an exact fresh 1,024-byte payload.

After these connections, BLE disabled, re-enabled and scanned successfully
(59 advertisements) with Wi-Fi enabled and an ESP-NOW object still resident.
This addresses the connected-session part of original report 11 on this S3.
It also supplies physical regression evidence for reports 8/9 on S3, beyond
the upstream-source ancestry check. The original C6 and sustained radio/display
load variants remain unverified; do not close those reports from this result.
Bleak warned that its reported MTU was a default: negotiated MTU was not measured.
No flash writes or resets were requested, and the original USB/port state was
restored. See [sanitized evidence](s3-connected-ble-2026-10-22.json).

## Earlier targeted evidence

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
  changes, not missing fork patches. The later S3 connected-session regression above passes; C6/load variants remain.
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

## Update: ESP-NOW corruption reproduced with exact source

The three linked upstream ESP-NOW trackers (#9816, #7903, #9380) remain open.
Actual callback/read/ring-buffer source deterministically reproduces an invalid
buffer when the reader runs after header publication but before the packet is
complete. The source blobs match current upstream main. Exact-capacity controls
pass: the packet size already includes the MAC. Eight application fault-injection
checks pass for AP-safe reset, non-AP rebuild/failure handling, peer rotation,
unconfirmed node delivery, explicit broadcast peer and channel-switch ordering.
The follow-up `ea06dcb44e` packet synchronization fix passes ten native groups, including 20,000 concurrent packets with exact delivery/drop accounting, and fresh ESP32/C6 builds. It is now installed on Feather ESP32 V2: physical baseline fails on channels 1/6/11, candidate passes the identical traffic/integrity test with an S3 sender; see [the physical comparison](espnow-physical-comparison-2026-10-23.md). C6 remains build-only. See [the candidate evidence](espnow-rx-synchronization-2026-10-23.md). See [the reproduction and limits](espnow-targeted-investigation-2026-10-23.md).

## Original firmware reports

Numbers refer to headings in the original bug document, not GitHub IDs.

| Report | Current evidence / disposition | Remaining targeted check |
|---|---|---|
| 0, 1, 5, 6, 10: C6 AP/DHCP/import/BLE/ESP-NOW memory failures | Later August notes identify IDF heap starvation and the reserve workaround, correcting earlier coexistence-only diagnoses. Reserve and frozen libraries are carried. C5 application/HTTPS overnight results are useful but are not a C6 reproduction. | Current C6, heavy imports and controlled heap pressure; both radio initialization orders; actual station DHCP and ESP-NOW sends. Capture error/backtrace if allocation fails. |
| 2: Wi-Fi/socket creation leaves shared SPI locked | Historical staged observation; no fresh proof of corruption. | Probe lock ownership around AP, UDP/socket and display setup on the original shared-bus wiring. Distinguish bus ownership from a corrupted flag. |
| 3: failed SD init leaves SPI locked | Current constructor unlocks after normal `init_card` error returns. Five physical S3 absent-card cases now pass. | C6/shared display setup and exceptional SPI/configure failures. Do not close the broader report from S3 alone. |
| 4: e-paper splash refresh / misleading errors | Workaround assigns a real root group; display behaviour has not been freshly measured. | Instrument timer, busy and bus ownership separately; reproduce splash versus explicit group on the actual panel. |
| 7: BLE-mode memory starvation | Historical application fix gates HTTP imports; recorded resolved on the earlier bench. | Current constrained C6 boot and GATT connection with the intended display configuration. Silent low-memory GATT failure remains a separate diagnostic concern. |
| 8: dropped BLE notifications | Upstream alpha.2 contains retry fixes; S3 unpaced 10,240-byte transfer passes exactly. | C6, verified low negotiated MTU and sustained radio/display load. |
| 9: PacketBuffer blocks after disconnect | Actual S3 mid-burst disconnect returns in 2.20 seconds; reconnect has no stale bytes and transfers 1,024 fresh bytes exactly. | C6 and sustained radio/display load; broader timing/race coverage. |
| 11: S3 adapter disable hard-fault / cannot re-enable | Five basic cycles plus post-connected-NUS teardown with Wi-Fi/ESP-NOW resident pass on current Feather S3. | Sustained concurrent traffic and the original application/sensor configuration; no crash reproduced in this targeted check. |
| Large code.py prevents Wi-Fi initialization | Historical MPY shim and current frozen libraries address memory placement. Eleven variants build; current app has completed deep-sleep/report cycles. | Board-specific cold-boot qualification, especially C6 with the real sensor/display load; no claim that compilation removes all memory limits. |
| Raw-REPL write then hard-reset filesystem corruption; S3 MSC write crashes | Historical evidence and safe deployment workarounds retained. | Disposable backed-up filesystem with explicit flush/soft reload controls and concurrent-radio variants. Avoid corrupting the live application store to obtain evidence. |
| sleep_memory after soft reload | Upstream #11274 fixes reload clearing; merge ancestry verified in alpha.2 and deployed cb530. True deep-sleep confirmations also passed in the app run. | Optional fresh physical sentinel regression; no duplicate source patch needed. |
| Windows empty GATT table / Service Changed | Still a report; cache mechanism unconfirmed. | Same device address, deliberate service-table change, cached versus uncached Windows discovery and Service Changed observation. |
| JD79667 logging/defaults | Exact upstream/frozen driver constructor reproduces hex output in four host controls; print-removal controls are silent. Inherited 40/180 defaults and explicit timing pass-through verified in source/host execution. | Actual panel timing and stray AttributeError still unverified; minimal patch retained, not deployed. See [library/tool evidence](library-tool-investigation-2026-10-23.md). |
| mpremote new-file ENOENT | Actual-board baseline reproduces existing MicroPython #17752: error conversion aborts existence check, while direct create/overwrite work. Parser fix passes new-file/overwrite/readback/cleanup; first candidate's line-ending failure retained. Full stock CLI/SerialTransport baseline reproduces the failure; candidate passes both copies, exact readbacks and cleanup. Fork draft PR #1 carries host regressions. | Stock CLI path is now verified on Feather ESP32 V2; matching MicroPython hardware suite and other host/serial-reset variants remain unrun. Human review/upstream submission pending. See [comparison](library-tool-investigation-2026-10-23.md). |

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
| ESP-NOW buffer corruption / peer limits / broadcast / channel mismatch | All three upstream trackers remain open. Actual-source packet interleaving reproduces #9816; eight current application guard checks pass, including AP-safe recovery, peer limits, explicit broadcast and channel order. Packet synchronization candidate ea06 passes native checks and ESP32/C6 builds; physical ESP32/S3 baseline/candidate comparison now passes (old image reproduces invalid-buffer); short BLE scan coexistence also passes integrity (996/1000 received, 13 ads); broadcast gaps persist with 2 ms pacing; multi-sender/C6/sustained-load remain open; unused PHY-rate feature is not an application blocker. |
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
| Zephyr #6 USB stack | Both current Pico 2 512/2048-byte USB-worker diagnostics pass the same short concurrent CDC, read-only MSC, Wi-Fi/BLE workload. The maximum measured use is 260 bytes; this does not reproduce a 512-byte shortage. Production firmware was restored exactly. MSC writes, idle re-enumeration and broader stress remain open. See [the comparison](pico2-usb-stack-comparison-2026-10-23.md). |
| Zephyr #8 softAP | Channel 1 association/static ping pass. DHCP starvation reproduced; equal-priority candidate passes idle and busy Python controls. Production Pico 2 channel 1/6/11, DHCP/ping and station departure now pass. Pico W production follow-up also passes, including concurrent BLE scan with an associated station. Station lifecycle #40 is now fixed and verified on both Pico W and Pico 2 at 9e153. Pico 2 bounded TLS/BLE and hostname/default-bundle/unrelated-CA controls also pass; certificate dates remain unchecked. |
| Zephyr #9 legacy timeout | Source still omits timeout in legacy HCI path; CircuitPython host deadline works around it. Direct low-level timed-radio reproduction outstanding. |
| HAL Infineon #2 coexistence assets | Asset selection audited; current Pico W two-hour and Pico 2 W thirty-minute concurrent-radio runs passed. This does not prove every traffic pattern. |
| CP #25 warm reset | Earlier 45% failure claim retracted after 45/45 successes; original trigger unresolved. |
| CP #29 Windows GATT cache | Unconfirmed mechanism; see targeted test above. |
| CP #8/#12/#16/#30, flash layouts, connection/memory choices | Project integration/configuration; do not label every choice an upstream defect. |
| ESP-IDF DHCP debug-format PR #19074 | Previously checked open/unmerged; final state must be refreshed before the concluding CP #15 comment. |

## Bench transport and board coverage

- Fresh sequential inspection of all eight previously off S31 leaf ports
  found no C6 identity and restored original power states with no bridge reset.
  The user will connect the C6/JD79667/RTC/SCD41 rig; its targeted regressions
  await that hardware. The configured sensor strand names SCD30, not SCD41,
  and the mux returned no usable live status/topology response. Configuration
  alone does not establish physical peripheral presence. Matched current
  Pico 2 512/2048-byte USB-stack diagnostics subsequently passed the bounded
  concurrent comparison; production firmware was restored. See
  [the stack comparison](pico2-usb-stack-comparison-2026-10-23.md).
  See [availability evidence and precise limits](farm-hardware-availability-2026-10-23.md).

- New direct Pico W USB recurrence: the final inventory failed with the Pico
  absent after descriptor/address timeouts and failed re-enumeration. Guarded
  hub recovery restored USB, and Pico W 9e153 / Feather ea06 runtime checks
  passed; S31 bec1d71 stayed healthy. Cause and CDC-versus-MSC behavior remain
  unresolved. A short CDC-only / CDC-plus-MSC-read / CDC-only control now
  passes 270 serial checks and 90 uncached reads, with original bindings
  restored and no USB errors captured. A later power snapshot has the Pico
  and external hubs forced active, with zero runtime suspend time. Neither
  result establishes the cause of the earlier failure. See [the class comparison](picow-usb-class-comparison-2026-10-23.md).
  Preserve this failure independently of the successful S31
  two-console comparison. See [the failure and recovery evidence](picow-idle-usb-recurrence-2026-10-23.md).

- Bridge interface-claim cleanup is implemented and installed; 24 source cases
  and five sequential Pico composite imports passed. A fresh reversed-order control
  now shows either board works first and fails second; the first stays responsive.
  Both expose seven non-control endpoints. Source allocation and the minimum
  channel budget strongly support exhaustion, but no live counter/log was captured.
  A new physical control prevents MSC/HID probing before attachment and still
  reproduces the second-console failure in both orders: client admission alone
  is insufficient. Per-interface candidate bec1d71 in draft bridge PR #25 now
  passes 17 actual-source native groups and a fresh full S31 build. It is now
  installed after fresh full backup, app-only update and whole-flash verification.
  The identical selective-interface comparison passes both consoles in both
  orders; descriptors and admission states match the failed baseline. Defaults,
  ports and imports were restored with no reset during the comparison. Broader
  MSC/HID/throughput and capacity scheduling remain open.
  The independent diagnostic UART recovered from USB control timeouts after hub
  recovery, but a subsequent open/read check coincided with an unexpected bridge
  reboot. Final network inspection found original inventory, no imports or active
  soaks. Reset cause remains unverified; the failed no-reset check is retained.
  See [the capacity investigation](s31-simultaneous-capacity-2026-10-23.md).
- Controller power/disappearance checks have 61 passing tests and a draft fix,
  but are not deployed. Capacity scheduling and stale imports remain open.
- Metro S3 now runs ea06 after private file recovery, fresh full backup,
  bounded partition/firmware migration and whole-chip verification. Runtime
  identity and three overlapping Wi-Fi/BLE scan cycles pass. Extended storage
  explains its 12,255,232-byte logical volume; offline `mdir` passes and the
  read-only checker reports only a volume-label mismatch. Original malformed
  Wipper FAT cause, boundary writes, TLS/connected-GATT and a current Metro soak
  remain unverified. Earlier transport/boot-transition failures are preserved.
  See [migration and runtime evidence](metro-ea06-migration-2026-10-23.md).
- Feather S3 and Metro S3 are updated with the targeted tests above. Other
  build-only variants, C6/load variants of BLE, physical displays/RTC/sensors
  and full Pico USB stress remain explicit gaps. Three completed
  overnight runs and later targeted follow-ups retain their actual revisions;
  a newer image is not retrospectively covered by an older soak.

The goal remains active. The final CP #15 comment has not been posted; it must
carry the remaining limitations rather than claim every issue is resolved.
