# Feather V2 controlled-advertiser follow-up — 22 October 2026

The newly installed `cb5301b6fb9ede7442d84e8aba72baad87430a80` ESP integration completed its
full 30-minute Wi-Fi/BLE scan follow-up: 60 cycles in
1800.0 seconds, Wi-Fi 1–2
and BLE 9–31 reports per cycle.
Every cycle received both kinds of result. The terminal service, complete
cycle log, exact board/version and recorded image provenance passed independent
verification. [Machine-readable evidence](feather-controlled-followup-2026-10-22.json)
contains the timestamps and source/image/log hashes.

A separately qualified Pico W continuously advertised `EnvHubTest` during this
run. Its observer confirmed advertising throughout the receiver's interval,
with its last successful check at 21:59:35 UTC, after the receiver finished at
21:58:41 UTC. The fixture subsequently lost its USB console and failed cleanup
at 22:00:20 UTC; stopping advertising was not confirmed. This is a separate
failed fixture run, preserved in the JSON record. Linux recorded descriptor
timeouts and disconnection. An S31 reboot during a preceding diagnostic capture
is also recorded; a causal link or firmware root cause is not established.
The radio recorder
counts all BLE reports; it does not identify the source of every report. A
preceding controlled probe separately confirmed that the Feather received this
advertiser before any radio toggling.

The first short follow-up failed after 65.03
seconds because three consecutive scans received no BLE results. That failure,
including its two stored cycles, remains preserved. The controlled run is a new
result and does not relabel it or establish a firmware regression's cause.

The [earlier eight-hour Feather result](completed-soaks-2026-10-22.md) used an
older image. This new result is a thirty-minute follow-up to the verified
[firmware and trusted-TLS rollout](post-soak-firmware-rollout-2026-10-22.md).
