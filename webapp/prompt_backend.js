/* Native Prompt API first; explicitly enabled local polyfill for phones. */
(function (root) {
  "use strict";
  const POLYFILL_URL = "https://cdn.jsdelivr.net/npm/prompt-api-polyfill@1.22.2/dist/prompt-api-polyfill.js";
  function createResolver(host = root, load = url => import(url)) {
    let pending = null;
    let local = false;
    const native = host.LanguageModel;
    return {
      get local() { return local; },
      async resolve({allowLocal = false, nativeUnavailable = false, signal} = {}) {
        signal?.throwIfAborted();
        if (!nativeUnavailable && typeof native?.create === "function") { local = false; return native; }
        if (!allowLocal) { local = false; return null; }
        if (!host.isSecureContext) throw new Error("Local AI needs HTTPS or localhost.");
        // Configure only a local backend; never send readings to a cloud provider.
        if (["FIREBASE_CONFIG", "GEMINI_CONFIG", "OPENAI_CONFIG", "WEBLLM_CONFIG"].some(k => host[k])) {
          throw new Error("Another AI backend is configured. Reload the page before enabling local AI.");
        }
        if (!pending) {
          pending = (async () => {
            // Prefer acceleration where the browser supplies an adapter.
            // WASM in a worker remains available on phones without WebGPU.
            // q4f16 produced incorrect inference on the tested AMD GPU despite
            // shader-f16 support. Keep full-precision arithmetic with q4 weights.
            let device = "wasm", dtype = "q4";
            try {
              const adapter = await host.navigator?.gpu?.requestAdapter();
              if (adapter) device = "webgpu";
            } catch (_) {}
            host.TRANSFORMERS_CONFIG = {
              apiKey: "dummy",
              modelName: "onnx-community/Qwen2.5-0.5B-Instruct",
              device,
              dtype,
              // Keep WASM inference off the UI thread so Stop remains usable.
              env: {backends: {onnx: {wasm: {proxy: device === "wasm", numThreads: 1}}}},
            };
            const module = await load(POLYFILL_URL);
            const model = module?.LanguageModel || host.LanguageModel;
            if (typeof model?.create !== "function" || model === native) throw new Error("Prompt API polyfill did not load.");
            return model;
          })().catch(error => { pending = null; throw error; });
        }
        const model = await pending;
        signal?.throwIfAborted();
        local = true;
        return model;
      },
    };
  }
  function progress(event) {
    const loaded = Number(event.loaded);
    if (!Number.isFinite(loaded)) return null;
    const total = Number(event.total);
    return Math.max(0, Math.min(1, total > 0 ? loaded / total : loaded));
  }
  function systemPrompt(schema) {
    const context = String(schema).split("\n").filter(line => /^(zones present:|data range:)/.test(line)).join("\n");
    return `Translate the question into a SQLite SELECT. Output only SQL.
Table readings(src TEXT, ts INTEGER, co2 REAL, tc REAL, rh REAL, pm1 REAL, pm25 REAL, pm4 REAL, pm10 REAL, voc REAL, nox REAL, vb REAL).
src means zone. ts is Unix time in seconds. co2 means CO2 ppm. tc means Celsius temperature. rh means humidity percent. pm columns are particulates in ug/m3. voc and nox are indices. vb is battery volts.
Each zone means GROUP BY src. Highest means MAX. Lowest means MIN. Average means AVG.
Use readings only. Do not invent another question or include explanations.
${context}`;
  }
  function queryPrompts(question) {
    return [
      {role: "user", content: "Highest humidity in each zone?"},
      {role: "assistant", content: "SELECT src, MAX(rh) AS peak_humidity FROM readings GROUP BY src"},
      {role: "user", content: "Lowest temperature in each zone?"},
      {role: "assistant", content: "SELECT src, MIN(tc) AS low_temperature FROM readings GROUP BY src"},
      {role: "user", content: question},
    ];
  }
  function queryText(reply) {
    const text = String(reply).trim();
    // A small model can continue with another example after its answer. Take
    // only the first explicitly fenced SQL block; validate that whole block.
    const fenced = /^```(?:sql)?[ \t]*\n([\s\S]*?)\n```/i.exec(text);
    return (fenced ? fenced[1] : text).trim();
  }
  const api = {createResolver, progress, systemPrompt, queryPrompts, queryText, POLYFILL_URL};
  if (typeof module !== "undefined") module.exports = api;
  else root.EnvPromptBackend = api;
})(globalThis);
