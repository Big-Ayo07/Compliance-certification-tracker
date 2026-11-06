// WatchUp browser error and request tracing for the Compliance Certificate Tracker.
(() => {
  "use strict";

  const endpoint = "https://api.watchup.site/api/v1/ingest/batch";
  const projectId = "p1";
  const maxQueueSize = 50;
  const batchSize = 10;
  const queue = [];
  let flushTimer = null;

  function safePageUrl(value) {
    try {
      const parsed = new URL(value || window.location.href, window.location.href);
      // Deliberately omit query parameters and fragments to avoid reporting secrets.
      return parsed.origin + parsed.pathname;
    } catch (_) {
      return window.location.origin + window.location.pathname;
    }
  }

  function enqueue(event) {
    queue.push(event);
    if (queue.length > maxQueueSize) queue.shift();
    if (!flushTimer) flushTimer = window.setTimeout(flush, 1500);
  }

  function flush() {
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!queue.length) return;

    const events = queue.splice(0, batchSize);
    // Use native fetch so reporting cannot recursively instrument itself.
    window.fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${projectId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {
      // Never let an unavailable telemetry service interrupt the tracker.
    }).finally(() => {
      if (queue.length && !flushTimer) flushTimer = window.setTimeout(flush, 1500);
    });
  }

  function errorEvent(error, details = {}) {
    const err = error instanceof Error ? error : new Error(String(error || "Unknown error"));
    enqueue({
      type: "error",
      message: String(err.message || "Unknown error").slice(0, 1000),
      error_type: String(err.name || details.type || "Error").slice(0, 120),
      level: "error",
      url: safePageUrl(window.location.href),
      stack: String(err.stack || "").slice(0, 4000),
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  window.addEventListener("error", (event) => {
    const err = event.error || new Error(event.message || "Unhandled browser error");
    errorEvent(err, {
      source: event.filename ? safePageUrl(event.filename) : undefined,
      line: event.lineno || undefined,
      column: event.colno || undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    errorEvent(event.reason || "Unhandled promise rejection", { error_type: "UnhandledRejection" });
  });

  // Trace fetch requests without recording request/response bodies or query strings.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const requestUrl = typeof input === "string" ? input : input && input.url;
    if (!requestUrl || new URL(requestUrl, window.location.href).origin === new URL(endpoint).origin) {
      return nativeFetch(input, init);
    }

    const method = String(init.method || (input && input.method) || "GET").toUpperCase();
    const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
    try {
      const response = await nativeFetch(input, init);
      const endedAt = (window.performance && performance.now) ? performance.now() : Date.now();
      const route = new URL(requestUrl, window.location.href);
      enqueue({
        type: "trace",
        name: `${method} ${route.pathname}`.slice(0, 300),
        duration_ms: Math.round((endedAt - startedAt) * 10) / 10,
        status_code: response.status,
        url: safePageUrl(route.href),
        timestamp: new Date().toISOString(),
      });
      if (!response.ok) {
        errorEvent(new Error(`${method} ${route.pathname} returned HTTP ${response.status}`), {
          error_type: "HttpError",
          status_code: response.status,
        });
      }
      return response;
    } catch (error) {
      const endedAt = (window.performance && performance.now) ? performance.now() : Date.now();
      const route = new URL(requestUrl, window.location.href);
      enqueue({
        type: "trace",
        name: `${method} ${route.pathname}`.slice(0, 300),
        duration_ms: Math.round((endedAt - startedAt) * 10) / 10,
        status_code: 0,
        url: safePageUrl(route.href),
        timestamp: new Date().toISOString(),
      });
      errorEvent(error, { error_type: "FetchError", request_method: method, request_url: safePageUrl(route.href) });
      throw error;
    }
  };

  window.addEventListener("pagehide", flush);
  window.addEventListener("online", flush);
})();
