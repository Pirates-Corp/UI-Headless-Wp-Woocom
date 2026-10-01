import "@testing-library/jest-dom";

// Polyfill Web APIs for Route Handler testing in jsdom environment if missing
if (typeof globalThis.Request === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require("undici");
    globalThis.Request = undici.Request;
    globalThis.Response = undici.Response;
    globalThis.Headers = undici.Headers;
    globalThis.FormData = undici.FormData;
  } catch {
    // fallback
  }
}
