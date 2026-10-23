# Pico W Bluetooth startup error-return reproduction

This is diagnostic instrumentation, not a proposed production patch. It reproduces
the [physical failed retry](../../docs/picow-bt-startup-failure-2026-10-23.md).

Use CircuitPython `6839890534556b06b8b3d7c491e36fd2005b2483`, Zephyr
`c6200e80ea6973b092da3c30c672901cc1951fc2`, HAL Infineon
`7f93dc60675126a63358ffa0780648d94fd2d634`, and HAL Pico
`725e9e429eab65eda01762a1af9016426dee00ac`. These are the fork integration
revisions in CP #32 / Zephyr #11, not stock upstream firmware.

1. In a clean disposable checkout with these exact dependencies, apply
   `patch -p1 < /path/to/diagnostic.patch` from the CircuitPython root. The patch
   also changes the nested HAL checkout. Build the Pico W Zephyr board using
   the checkout's configured toolchain and dependencies; retain the ELF.
2. Back up the device and have an independent SWD/ROM recovery path ready.
   Install the raw `zephyr.bin` through the board's supported flasher, preserving
   its storage layout. Do not confuse the compressed update package with a raw
   flash image. This test has halted a real board and required SWD restoration.
3. From a fresh boot, execute `probe.py` in one REPL session with no soft reset
   between sections. The recorded run submitted each of the five top-level
   sections separately, preserving output after each; the final import halted.
   Do not import `_bleio` before the initial assertion. The patch disables
   automatic BLE file/serial workflows so application imports initiate startup.
4. Stages 3/4/5 replace a successful ready/buffer-init/awake return with
   `CYBT_ERR_TIMEOUT`, once per arm. This forces software error returns after
   real hardware work; it does not create electrical faults or actual timeouts
   in those three operations. Expected Python errno values come from the target.
5. Require the fourth unarmed import to succeed, retain the expected identity,
   and complete three BLE scans. The recorded candidate fails this requirement.
   Preserve evidence and restore the original firmware independently of the
   failed test result.

Counter fields: attempts, consumed faults, armed stage, last forced stage,
last actual return, forced return, download-finish count, completed-init count,
then the live `bt_is_ready()` value added by the Python binding. RAM contains
only the first eight counters. Do not infer the ninth from the saved counter block.

The diagnostic patch was reapplied to copies of all three exact original files;
all resulting source hashes match the physically tested build. An unfaulted
control with the same workflow-disabled configuration and separate single-fault
retries remain necessary before attributing the timeout to retry cleanup.
