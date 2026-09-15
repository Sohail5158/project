"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApp, sanitizeMessages } = require("../server");

test("GET / serves the dashboard", async () => {
  const app = createApp({ env: {} });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Ask ChatGPT/);
    assert.match(html, /chat.js/);
  } finally {
    await close(server);
  }
});

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("sanitizeMessages keeps only user and assistant text", () => {
  const cleaned = sanitizeMessages([
    { role: "system", content: "ignore" },
    { role: "user", content: "  hello  " },
    { role: "assistant", content: "hi" },
    { role: "tool", content: "nope" },
    { role: "user", content: "" },
  ]);
  assert.deepEqual(cleaned, [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi" },
  ]);
});

test("GET /api/status reports when ChatGPT is not configured", async () => {
  const app = createApp({ env: {} });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/status`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.configured, false);
    assert.equal(body.mock, false);
  } finally {
    await close(server);
  }
});

test("POST /api/chat rejects empty payloads", async () => {
  const app = createApp({ env: { OPENAI_API_KEY: "sk-test" } });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    assert.equal(response.status, 400);
  } finally {
    await close(server);
  }
});

test("POST /api/chat returns 503 without an API key", async () => {
  const app = createApp({ env: {} });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.match(body.error, /API key/i);
  } finally {
    await close(server);
  }
});

test("POST /api/chat uses mock replies when MOCK_OPENAI=1", async () => {
  const app = createApp({ env: { MOCK_OPENAI: "1" } });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "summarize ratings" }],
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.match(body.reply, /5 star/i);
    assert.equal(body.model, "mock");
  } finally {
    await close(server);
  }
});

test("POST /api/chat proxies to OpenAI chat completions", async () => {
  let captured;
  const fakeFetch = async (openaiUrl, init) => {
    captured = { openaiUrl, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: "gpt-4o-mini",
        choices: [{ message: { content: "You have 19 five-star ratings." } }],
      }),
    };
  };

  const app = createApp({
    env: { OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o-mini" },
    fetchImpl: fakeFetch,
  });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "How many 5 star ratings?" }],
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.reply, "You have 19 five-star ratings.");
    assert.equal(captured.openaiUrl, "https://api.openai.com/v1/chat/completions");
    const payload = JSON.parse(captured.init.body);
    assert.equal(payload.model, "gpt-4o-mini");
    assert.equal(payload.messages[0].role, "system");
    assert.equal(payload.messages[1].content, "How many 5 star ratings?");
    assert.match(captured.init.headers.Authorization, /sk-test/);
  } finally {
    await close(server);
  }
});

test("POST /api/chat accepts a per-request key from Settings", async () => {
  let captured;
  const fakeFetch = async (_openaiUrl, init) => {
    captured = init;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
      }),
    };
  };

  const app = createApp({ env: {}, fetchImpl: fakeFetch });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenAI-Key": "sk-from-ui",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(captured.headers.Authorization, "Bearer sk-from-ui");
  } finally {
    await close(server);
  }
});

test("POST /api/chat maps OpenAI 401 to a clear error", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { message: "Incorrect API key provided" } }),
  });
  const app = createApp({
    env: { OPENAI_API_KEY: "sk-bad" },
    fetchImpl: fakeFetch,
  });
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
      }),
    });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.match(body.error, /API key/i);
  } finally {
    await close(server);
  }
});
