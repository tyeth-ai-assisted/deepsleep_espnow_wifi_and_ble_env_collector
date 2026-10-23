# Pico 2 full-disk read delays on both firmware revisions

The Pico 2 W independently fails a bounded full-disk MSC read through the S31
USB/IP bridge on both original `9e153ad624` and latest normal `0d545efdcf74`.
The latest image includes Zephyr `c6200e80` (paired USB reconfiguration and CDC
rearming fixes) and HAL Pico `de12fc2a` (Bluetooth ready-state retry guard).
Those changes do not resolve this workload. This does not establish that the
failure shares a cause with [direct Pico W issue #42](https://github.com/tyeth/circuitpython/issues/42).

The host disk is unmounted and has no userspace owner after enumeration settles.
CircuitPython is paused in raw REPL with its root read-only. The serial handle
remains open throughout the reads, unlike the closed-console trigger in #42.
CDC, MSC and HID stay bound. The bridge has three hubs, the tested Pico and one
other enumerated leaf; there are no unrelated imports or active soaks.

| Firmware / capture | First 4 KiB | First 64 KiB | Full 2,617,856-byte disk |
|---|---:|---:|---|
| Original, UART/kernel capture | 0.065 s | 0.165 s | 120 s timeout; 576 KiB retained, process returned after 122.535 s |
| Original, USBmon capture | 0.065 s | 0.165 s | 45 s timeout plus 5 s kill grace; 256 KiB retained |
| Latest candidate, USBmon capture | 0.065 s | 0.166 s | 45 s timeout plus 5 s kill grace; 256 KiB retained |

CDC arithmetic-free print checks pass after both small reads in each test.
The original untraced read had only 192 KiB after about 47 seconds but eventually
retained 576 KiB. It therefore made intermittent progress; no fixed failing LBA
is established. The full-disk failures remain failed jobs.

## Request timing

Original and candidate traces each show 20 MSC commands, 19 successful status
wrappers, and one read still lacking its status when capture ends. Three slow
READ(10) commands each request 65,536 bytes and finish with success and zero
residue. Their durations are respectively 10.051/14.037/14.037 seconds on the
original and 10.050/14.037/14.037 seconds on the candidate. The delay is in the
bulk-IN completion on endpoint 0x83. This rules out treating the full-disk timeout
as a complete lack of progress or as an observed SCSI error response.

The original final capture has 161 packets; the candidate has 115. Both report
zero kernel drops and zero truncated packets. Original capture includes detach;
candidate capture stops before restoration, so pending/cancelled requests at
their ends are not directly comparable. USBmon does not expose the bridge's
individual 4 KiB segments or electrical ACK/NAK timing.

Original bridge UART contains four endpoint-zero STALL messages during
enumeration, before successful small reads, and zero HCD-channel-exhaustion
messages. Neither comparison restarts the bridge. These observations do not
identify which device, bridge, host or interaction owns the defect.

## Firmware and recovery boundaries

The candidate transaction takes a fresh 4 MiB ROM backup, updates only the
1,212,416-byte aligned code span, and verifies the entire expected flash image.
Normal startup retains BLE identity and passes three Wi-Fi/BLE cycles before
the storage workload. Original code is restored afterward with another entire
expected-image verification and three successful radio cycles. Runtime data is
retained; the restored image is **not** byte-identical to the pretest backup.
The initial 64 KiB data also differs between firmware runs; no cross-firmware
filesystem equality or corruption conclusion is claimed.

Imports are detached, the original off state is restored, and bridge uptime
continues. No raw-sector patterns or mounted-file writes were attempted.
The existing write helper assumes different FAT geometry and must not be used
unchanged: this disk has 512-byte sectors, two-sector clusters and one FAT.

An earlier instrumentation attempt reset S31 by explicitly changing DTR/RTS
while opening its log UART. It stopped before Pico access; a separate recovery
restored the recorded topology. That fixture failure is retained separately.
The original USBmon run also failed to stop its capture because its PID file
was root-owned. A separate identity-checked cleanup stopped that process; the
final hash and zero-drop totals above come from the closed capture. Candidate
capture cleanup uses the corrected privileged PID read and completes normally.

## Minimal reproduction

1. Import the identity-verified Pico 2 over USB/IP. Confirm the current firmware
   and matching serial/block devices. Keep all normal interfaces bound.
2. Stop the application in raw REPL and keep the serial handle open. Confirm
   the disk and its partitions are unmounted and unused. Record its capacity.
3. Run `dd if=/dev/<verified-disk> bs=4096 count=1 iflag=direct status=none`,
   saving output privately; check CDC. Repeat with `bs=65536 count=1` and check
   CDC again. Compare the overlapping bytes.
4. Capture that virtual bus with USBmon, then run
   `sudo timeout --signal=TERM --kill-after=5 45 dd if=/dev/<verified-disk> bs=65536 iflag=direct status=none`,
   redirecting stdout to a private file and retaining stderr, exit code, elapsed
   time and partial-file length/hash. This reads the whole disk; do not add
   `count=1` and call that full-disk qualification.
5. Stop only the owned capture process, retain its drop counters, detach the
   owned import and restore the recorded port state. Decode READ(10) submission,
   bulk-IN completion and status-wrapper timestamps.

There is no storage fix, permanent candidate rollout, direct-Pico-2-USB test,
or common-cause claim for Pico W #42. A useful next discriminator is simultaneous
USB/IP network and USBmon capture, or a controlled transfer-size/CDC-activity
comparison, to locate the repeated delays without changing firmware speculatively.
See [structured evidence](pico2-msc-long-read-comparison-2026-10-23.json).
