# Android model retention test, 2026-10-22

Result: **FAIL** for retention of the local Prompt API polyfill model on the tested Android emulator. Successful inference does not establish that the weights were saved for later visits. No retention fix is included in this report.

## Environment

- Official Android 36 Google APIs x86_64 system image, revision 7; Pixel 6 hardware profile, 4 GiB RAM, four cores, 8 GiB data partition.
- Preinstalled Chrome 133.0.6943.137. This is an emulator result, not physical-phone validation or a claim about all Chrome versions.
- Collector assets from `eff562bd0d46a0491156c26e064c7058a2083b98`, served over secure-context localhost with the v19 service worker.
- Prompt API polyfill 1.22.2, Transformers.js 4.3.0, `onnx-community/Qwen2.5-0.5B-Instruct`, WASM worker / q8. Native LanguageModel was absent and WebGPU returned no adapter.
- Model file: `onnx/model_quantized.onnx`, response Content-Length **512,096,557 bytes** (512 MB decimal / 488 MiB). Resolved model revision observed on the initial load: `22942cb7d7ba4cc81bb4673549ca4d4614469b5e`.

## Observations

1. Initial online load reached `local phone model ready`. A complete natural-language query over all 2,377 demo rows returned the correct maxima: bedroom 2,261 ppm and local 2,573 ppm. The portal reported 99.9 seconds and one SQL query. Renderer RSS was observed at 1,760,512 KiB; that is a snapshot, not peak memory or a phone performance estimate.
2. The initial load logged: `Unable to add response to browser cache: UnknownError: Failed to execute 'put' on 'Cache': Unexpected internal error.`
3. After inference, the origin used 109,203,971 bytes. Cache Storage retained scripts, tokenizer/configuration files and the WASM runtime, but no ONNX weight entry. OPFS was empty; only the application's IndexedDB database existed. Persistent storage was not granted. Android had 6.3 GiB free and the reported origin quota was 4,981,238,169 bytes. The exact cause of the cache-write error remains unresolved.
4. A page reload with Playwright's browser-context network set offline loaded the portal and demo data from storage. An uncached Hugging Face fetch failed, verifying the network restriction. After explicitly enabling the local model again, initialization failed with `TypeError: Failed to fetch`; the model-weight request reported `ERR_INTERNET_DISCONNECTED`.
5. Chrome was fully force-stopped and restarted without clearing browser data. The existing portal storage survived. Enabling the model again requested the weight URL, followed a 302 redirect, and received an HTTP 200 response with Content-Length 512,096,557. The separate metadata range probe returned 206. The model eventually became ready, but logged the same cache-write error. No ONNX weight entry existed afterwards; origin usage was only 112,659,992 bytes.
6. Repeating the offline reload after that second successful initialization again failed to initialize the model. Thus the observed retention failure reproduced across two successful online initializations and offline revisits, including a full browser restart between them.

The local-model opt-in is reset on page reload; this test explicitly re-enabled it each time. That is separate from retaining downloaded weights. The label remained at `downloading model: 0%` through initialization and does not distinguish transfer, cache write, and runtime initialization.

## Separate cache-lifecycle finding

The current service worker's activation handler deletes every cache except its own versioned `envhub-v19` cache. That also includes `transformers-cache` on a service-worker update. This is a separate code-inspection finding and is not an explanation for the initial Cache.put failure, which occurred during the first successful model initialization.

Do not claim that this fallback is a reliable one-time download or works offline after first use until model persistence is repaired and the same reload/restart/offline checks pass. The staged DUT assets remain unchanged; the active hardware soaks were not interrupted for this test.
