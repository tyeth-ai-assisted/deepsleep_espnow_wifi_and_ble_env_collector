# Pico 2 hub scan: argument fix and remaining full-application failure

The actual Pico 2 W hub boot exposed an application API-contract bug:
`net_blescan.AdvReceiver.poll()` passed the advertisement prefix positionally,
but `_bleio.Adapter.start_scan` accepts keyword arguments only. It now passes
`prefixes=envadv.PREFIX`. The regression fixture uses a keyword-only adapter,
tests decoding/deduplication, throttle and generator cleanup, and injected
errors. The previous source fails all three tests (two failures, one error);
the fix passes all three. The existing 50 protocol checks also pass.

```sh
python tools/test_net_blescan.py
python tools/test_net_blescan.py /path/to/baseline/net_blescan.py
python tools/test_envadv.py
```

The physical rerun gets past the TypeError but exposes another failure:
`BLE scan failed: OSError: [Errno 22] Invalid argument`. This is **not a passing
hub qualification**. Its precise failing source stage and cause remain open.

## Actual hub startup

The application base is `415710c80b3c` with the one-line scanner patch above.
CircuitPython is `5f73172d46cd`, Zephyr `c6200e80ea69`, HAL Infineon
`7f93dc606751`, and HAL Pico `de12fc2a0f75`. Forty-four files are uploaded
and compared byte-for-byte after readback, including compiled application,
Adafruit BLE 10.1.3, and SEN6x 1.1.0 modules. A real MCU reset and changed USB
device number are checked before capturing the application boot.

Both unpatched and patched boots reach AP active, HTTP listener on port 80,
HTTPS listener using the retained certificate, BLE UART advertising, and
the collector loop. Free heap after scanner creation is 85,424 bytes.
The unpatched scanner reports the positional-argument TypeError; the patched
scanner reports errno 22. Missing I2C sensors and a read-only boot-status
write are recorded separately. These bare-board jobs do not qualify a sensor
rig, persistence, TLS client access, browser assets or API responses. The
boot guard stopped before any HTTP requests in both runs.

The first two attempts failed in the harness before application boot:
`bytes(nvm)` was not iterable (use a slice), then `hashlib.sha256` was absent.
The third attempt also missed an early boot marker during USB reattachment;
its independent scan TypeError is retained. All four jobs remain failed.
Each restores the exact complete pretest 4 MiB image, verifies original
`9e153ad624`, original files and BLE identity, and passes a radio check.
Imports are detached, the original off state is restored, and the bridge
does not reset. This full-image policy intentionally discards temporary
application, NVM and filesystem changes. Private backups remain private.

## Smaller radio controls pass on both images

The same board passes 24 raw scan controls on original `9e153ad624` and 24 on
candidate `5f73172d46cd`. The original control changes no firmware or files;
the candidate uses a temporary verified image and exact full original restore.
The candidate's post-restore Wi-Fi/BLE counts are 68/56.

Each image exercises no advertising, nonconnectable advertising, connectable
advertising, AP plus connectable advertising, AP without advertising, and
after stopping the AP. Each state uses both 100 ms and 50 ms windows, with
an empty prefix or the exact Env Hub manufacturer prefix. All use a 100 ms
interval, one-second timeout, 512-byte buffer, RSSI floor -100, and passive scan.

```python
results = _bleio.adapter.start_scan(
    prefixes=bytes([4, 255, 255, 255, 231]), buffer_size=512,
    timeout=1.0, interval=0.1, window=0.1, minimum_rssi=-100,
    active=False)
try:
    count = sum(1 for entry in results)
finally:
    _bleio.adapter.stop_scan()
```

Original scans finish in 1.018–1.041 seconds; candidate scans in
1.022–1.041 seconds. Unfiltered scans receive 10–31 and 7–34 advertisements
respectively. Every filtered control receives zero matching node packets:
these controls qualify scan startup and deadline behavior, not Env Hub delivery.
The original and candidate CircuitPython adapter sources are identical;
this statement does not equate their complete dependency/build histories.

These passes rule out a universal inability to scan with advertising and an
AP under this small workload. They do not explain the full application's
errno 22. The inspected Zephyr parameter checks accept the stated passive
settings, and lower address/HCI errors can propagate through the same Python
exception. Neither a firmware regression nor a controller limitation is proven.
Further diagnosis must capture the full application's actual input and failing
stage. The JSON companion retains every raw matrix case, job status, restore
checks and hashes of the complete private records.
