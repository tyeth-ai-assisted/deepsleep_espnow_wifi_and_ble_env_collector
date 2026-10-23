# Remaining ESP receive-fix rollout — 23 October 2026

The rollout audit found C5, C61 and Feather S3 still recorded on `cb5301b6fb`,
before the ESP-NOW receive-publication fix. Fresh builds use ESP integration
`e46718f34b321ae8021a19b99d80b45bdcd2a3a7` and ESP-IDF
`29d36039e564db6df505d0582b94b230a17e63f3`. The later ESP commit is documentation
only relative to the receive fix. TLS output buffers remain 8 KiB.

C5 and C61 require `CIRCUITPY_ESP_USB_SERIAL_JTAG=0` to retain the installed
UART console. Initial default-console builds succeeded but were not deployed;
separate fresh UART builds succeeded and are the selected rollout artifacts.
The version banner includes `-dirty`: pre-existing submodule differences were
preserved, and their status plus the actual MPU6050 revision are recorded in
the [artifact manifest](remaining-esp-rx-rollout-2026-10-23.json). No claim of a
fully clean checkout is made. The initial export failed because it used the
wrong sdkconfig path; corrected export read the completed builds without
rebuilding them.

## C61: installed and bounded radio checks passed

Live UART runtime identity confirmed the board and preceding `cb530` revision.
ROM identity and flash size matched before taking and verifying a fresh 8 MiB
recovery backup. The transaction required the exact old application, unchanged
partition sector and a validated active OTA slot. It replaced only application
bytes, preserving even the final erase-sector tail. Verification of the whole
expected flash image passed before watchdog reset. NVS, OTA metadata, bootloader,
partition table and all filesystem regions were preserved in that verification.

The updater's immediate raw REPL check timed out after the watchdog command
returned successfully. That job remains failed; it restored port/import state.
A separate power-on runtime check then reported `e46718f34b`, and a further
no-flash check passed three Wi-Fi/BLE scan cycles:
2/89, 2/108, 2/98. The USB/IP import and original port-off state were restored,
the other device inventory remained intact, and the S31 was not restarted.
Why the immediate watchdog-resume console was silent is unresolved; the
successful later boot does not erase that failure. Eleven actual-image
transaction controls passed, including interrupted writes,
verification failure, failed rollback and refusal of wrong OTA/partition inputs.
Private recovery images and full logs remain retained.

These checks establish installation and bounded radio operation. They do not
transfer the older eight-hour soak result to this image, qualify sustained
multi-sender ESP-NOW traffic, or repeat the complete application/TLS workload.

## C5 and Feather S3: remaining physical work

C5's UART adapter and native USB identities enumerate, but the no-reset runtime
probe received no raw REPL response. That failed probe restored port/import
state and made no firmware writes. Sleep, reset state or another cause remains
unresolved; a faulty firmware image is not established. Its selected UART
build and eleven application-only transaction controls pass; deployment is pending.

Feather S3's old port reported power on but no connected USB device, including
with force enabled. The user confirms the board was moved or removed. Stop
retrying the old location: the new S3 build is available, while installation
and physical qualification await reconnection. Its last recorded image remains
`cb530`; it must not be listed as already running the receive fix.
