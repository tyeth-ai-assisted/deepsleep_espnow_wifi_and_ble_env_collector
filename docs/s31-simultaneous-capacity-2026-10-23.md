# S31 simultaneous composite-device investigation — 23 October 2026

**The second imported console fails in either order; the first remains usable.**
This is a completed diagnostic, not a successful simultaneous-device qualification.
No firmware was written. Original port states and imports were restored, and
the bridge uptime increased throughout: no bridge reboot occurred.

| Import order | First console | Second console | First console recheck |
|---|---|---|---|
| Feather S3 alone | Pass | — | Pass |
| Pico 2 W, then Feather S3 | Pass | Raw-REPL timeout, twice | Pass |
| Feather S3, then Pico 2 W | Pass | Raw-REPL timeout, twice | Pass |

Bridge: `74975412c1b04c0738dcf57ab03bae82bc8ac71f` (claim-cleanup PR #24).
Pico 2 W: `6b117bdce5`. Feather S3: `cb5301b6fb-dirty`.
Both devices remained physically connected during all three controls. Each
captured configuration contains four interfaces: CDC control (one endpoint),
CDC data (two), MSC (two), HID (two), for **seven non-control endpoints each**.
Both have alternate setting zero only. Linux MSC/HID drivers were unbound after
enumeration, as in the earlier failure; this does not release bridge-side claims.

## Source and resource accounting

The installed backend calls `ensure_interfaces_claimed_locked()` on the first
non-control transfer, claiming every interface. The actual bundled host-library
path is `usb_host_interface_claim` → `interface_claim` → `ep_wrapper_alloc` →
`usbh_ep_alloc` → `hcd_pipe_alloc` → `usb_dwc_hal_chan_alloc`. Each interface's
endpoints get dedicated channels. Exhaustion returns an error, mapped to generic
`-EIO` by the bridge. Software URB slot availability does not remove this limit.

Using the 16-channel S31 budget documented in existing bridge issue #20, these
two complete configurations need 14 data channels plus two leaf EP0 channels.
Even a single external hub adds its EP0 and interrupt endpoint, taking the
minimum to 18. Extra hubs only increase that requirement. This accounting and
the reversed-order physical control strongly support channel exhaustion. We did
not capture a live channel counter or an exhaustion message in this run.

A native test compiled the actual installed claim/release functions with a
16-channel host model, four baseline channels, and the captured 1/2/2/2 interface
costs. Both orders reproduced second-device exhaustion; three retries preserved
the first device, rolled back all partial claims, and succeeded after releasing
the first device. No invalid release/reclaim occurred. This is modeled host
allocation, not hardware instrumentation. Backend source SHA-256:
`8c8ab8055ad45f67cefc024517d712070b90386f1a9d10b60a6ff28826eaa1ac`.
The installed cleanup fix therefore addresses leaks, while the simultaneous
capacity limitation remains open.

## Minimal reproduction and next fix

1. Use the above bridge revision and two composite CDC/MSC/HID boards with the
   same endpoint counts. Keep both physically enumerated behind a hub.
2. Import the first board via USB/IP and request its board ID and firmware version.
3. Import the second, unbind unwanted Linux class drivers, and request its identity.
4. Confirm the second times out while the first still responds. Detach both,
   reverse the order, and repeat. Restore the original imports and port states.

The next candidate should claim only the interface owning the requested endpoint,
retain correct partial-claim cleanup, and reset toggles only on claimed endpoints.
Linux class-driver probing can itself trigger unwanted traffic, so per-interface
claiming alone must not be assumed sufficient: test selective interface admission
before probing as well. Controller scheduling needs endpoint budget/headroom and
an actionable resource-exhausted result. Neither candidate is deployed by this report.

## Separate diagnostic-UART failure

The bridge's USB-to-UART adapter failed before these controls: Linux reported
enable-UART control-request timeouts and opening it returned EIO. A bounded,
adapter-only USB reset also timed out; a later check found no leftover reset
process and the bridge network API remained healthy with increasing uptime.
This prevented passive bridge-log capture. The successful diagnostic above
avoided that adapter. Its recovery remains open; it is not evidence that the
bridge reset or that these two failures have the same cause. Failed attempts and
private recovery records remain preserved.

Structured evidence: [sanitized results](s31-simultaneous-capacity-2026-10-23.json).
Existing trackers: [bridge capacity #20](https://github.com/tyeth-ai-assisted/esp-usbip-bridge/issues/20),
[claim cleanup #23](https://github.com/tyeth-ai-assisted/esp-usbip-bridge/issues/23),
[controller #1](https://github.com/tyeth-ai-assisted/sbc-mcu-dut-controller/issues/1).
