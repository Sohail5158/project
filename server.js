"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");
const { DASHBOARD_CONTEXT, mockAssistantReply } = require("./lib/dashboard-context");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_MESSAGES = 24;
const MAX_CONTENT_LENGTH = 4000;

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return null;
  }

  const cleaned = [];
  for (const item of messages.slice(-MAX_MESSAGES)) {
    if (!item || (item.role !== "user" && item.role !== "assistant")) {
      continue;
    }
    const content = String(item.content || "").trim();
    if (!content) {
      continue;
    }
    cleaned.push({
      role: item.role,
      content: content.slice(0, MAX_CONTENT_LENGTH),
    });
  }

  return cleaned.length ? cleaned : null;
}

function openaiErrorMessage(status, payload) {
  const apiMessage = payload?.error?.message;
  if (status === 401) {
    return "ChatGPT rejected the API key. Check OPENAI_API_KEY or the key in Settings.";
  }
  if (status === 429) {
    return "ChatGPT rate limit reached. Wait a moment and try again.";
  }
  if (apiMessage) {
    return apiMessage;
  }
  return `ChatGPT request failed (${status}).`;
}

function createApp(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const env = options.env || process.env;
  const app = express();

  app.use(express.json({ limit: "32kb" }));
  app.use(express.static(path.join(__dirname, "cornercube")));

  app.get("/api/status", (_req, res) => {
    const mock = env.MOCK_OPENAI === "1";
    const configured = Boolean(env.OPENAI_API_KEY) || mock;
    res.json({
      configured,
      mock,
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
    });
  });

  app.post("/api/chat", async (req, res) => {
    const messages = sanitizeMessages(req.body && req.body.messages);
    if (!messages) {
      res.status(400).json({ error: "Send a messages array with user or assistant content." });
      return;
    }

    const headerKey = String(req.get("x-openai-key") || "").trim();
    const apiKey = env.OPENAI_API_KEY || headerKey;
    const mock = env.MOCK_OPENAI === "1" && !env.OPENAI_API_KEY;

    if (mock) {
      res.json({
        reply: mockAssistantReply(messages),
        model: "mock",
      });
      return;
    }

    if (!apiKey) {
      res.status(503).json({
        error: "Add an OpenAI API key in Settings, or set OPENAI_API_KEY on the server.",
      });
      return;
    }

    const model = env.OPENAI_MODEL || DEFAULT_MODEL;
    let response;
    try {
      response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.5,
          max_tokens: 700,
          messages: [
            { role: "system", content: DASHBOARD_CONTEXT },
            ...messages,
          ],
        }),
      });
    } catch (error) {
      res.status(502).json({ error: "Could not reach ChatGPT. Check your network and try again." });
      return;
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch (_error) {
      payload = {};
    }

    if (!response.ok) {
      res.status(response.status === 401 ? 401 : 502).json({
        error: openaiErrorMessage(response.status, payload),
      });
      return;
    }

    const reply = payload?.choices?.[0]?.message?.content;
    if (!reply) {
      res.status(502).json({ error: "ChatGPT returned an empty reply." });
      return;
    }

    res.json({
      reply,
      model: payload.model || model,
    });
  });

  return app;
}

if (require.main === module) {
  loadDotEnv(path.join(__dirname, ".env"));
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.listen(port, () => {
    console.log(`Corner Cube running at http://localhost:${port}`);
  });
}

module.exports = {
  createApp,
  sanitizeMessages,
};
