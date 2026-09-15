(() => {
  const KEY_STORAGE = "cornercube.openaiKey";
  const SUGGESTIONS = [
    "Summarize my ratings",
    "What's on my to-do list?",
    "Who left recent feedback?",
  ];

  const state = {
    open: false,
    sending: false,
    messages: [],
    configured: false,
    mock: false,
  };

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (name === "className") {
        node.className = value;
      } else if (name === "text") {
        node.textContent = value;
      } else if (name.startsWith("on") && typeof value === "function") {
        node.addEventListener(name.slice(2).toLowerCase(), value);
      } else {
        node.setAttribute(name, value);
      }
    }
    for (const child of children) {
      node.append(child);
    }
    return node;
  }

  function storedKey() {
    try {
      return sessionStorage.getItem(KEY_STORAGE) || "";
    } catch (_error) {
      return "";
    }
  }

  function saveKey(value) {
    try {
      if (value) {
        sessionStorage.setItem(KEY_STORAGE, value);
      } else {
        sessionStorage.removeItem(KEY_STORAGE);
      }
    } catch (_error) {
      // Ignore private-mode storage failures; the in-memory input still works for this page load.
    }
  }

  function appendMessage(role, text, extraClass) {
    const bubble = el("div", { className: `cc-msg ${role}${extraClass ? ` ${extraClass}` : ""}`, text });
    ui.log.append(bubble);
    ui.log.scrollTop = ui.log.scrollHeight;
    return bubble;
  }

  function setStatus(text, isError) {
    ui.status.textContent = text;
    ui.status.classList.toggle("error", Boolean(isError));
  }

  async function loadStatus() {
    try {
      const response = await fetch("/api/status");
      const body = await response.json();
      state.configured = Boolean(body.configured);
      state.mock = Boolean(body.mock);
      if (state.mock) {
        setStatus("Demo mode is on. Replies are local until you add an OpenAI API key.");
      } else if (state.configured || storedKey()) {
        setStatus("Connected to ChatGPT. Ask about ratings, clients, or your to-do list.");
      } else {
        setStatus("Add an OpenAI API key in Settings to talk to ChatGPT.");
      }
    } catch (_error) {
      setStatus("Could not reach the assistant server. Start it with npm start.", true);
    }
  }

  async function sendMessage(text) {
    const content = String(text || "").trim();
    if (!content || state.sending) {
      return;
    }

    state.sending = true;
    ui.send.disabled = true;
    ui.suggestions.style.display = "none";
    appendMessage("user", content);
    state.messages.push({ role: "user", content });

    const pending = appendMessage("assistant", "Thinking…");
    const headers = { "Content-Type": "application/json" };
    const key = storedKey() || ui.keyInput.value.trim();
    if (key) {
      headers["X-OpenAI-Key"] = key;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: state.messages }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        pending.classList.add("error");
        pending.textContent = body.error || "ChatGPT request failed.";
        state.messages.pop();
        return;
      }
      pending.textContent = body.reply;
      state.messages.push({ role: "assistant", content: body.reply });
    } catch (_error) {
      pending.classList.add("error");
      pending.textContent = "Could not reach the assistant server.";
      state.messages.pop();
    } finally {
      state.sending = false;
      ui.send.disabled = false;
      ui.log.scrollTop = ui.log.scrollHeight;
      ui.input.focus();
    }
  }

  function togglePanel(force) {
    state.open = typeof force === "boolean" ? force : !state.open;
    ui.panel.classList.toggle("open", state.open);
    ui.toggle.setAttribute("aria-expanded", String(state.open));
    if (state.open) {
      ui.input.focus();
    }
  }

  function toggleSettings() {
    ui.settings.classList.toggle("open");
    if (ui.settings.classList.contains("open")) {
      ui.keyInput.focus();
    }
  }

  const ui = {};

  function mount() {
    ui.toggle = el("button", {
      id: "cc-chat-toggle",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": "cc-chat-panel",
      text: "Ask ChatGPT",
      onClick: () => togglePanel(),
    });

    ui.title = el("h2", { text: "Corner Cube assistant" });
    ui.subtitle = el("p", { text: "Powered by ChatGPT" });
    ui.settingsBtn = el("button", { type: "button", text: "Settings", onClick: toggleSettings });
    ui.closeBtn = el("button", { type: "button", text: "Close", onClick: () => togglePanel(false) });

    ui.status = el("div", { id: "cc-chat-status", text: "Checking ChatGPT connection…" });

    ui.keyInput = el("input", {
      type: "password",
      id: "cc-openai-key",
      autocomplete: "off",
      placeholder: "sk-...",
    });
    ui.keyInput.value = storedKey();
    ui.settings = el("div", { id: "cc-chat-settings" }, [
      el("label", { for: "cc-openai-key", text: "OpenAI API key (kept in this browser tab only)" }),
      ui.keyInput,
      el("button", {
        type: "button",
        text: "Save key",
        onClick: () => {
          const value = ui.keyInput.value.trim();
          saveKey(value);
          setStatus(value ? "API key saved for this tab. You can chat with ChatGPT now." : "API key cleared.");
        },
      }),
    ]);

    ui.log = el("div", { id: "cc-chat-log" });
    appendMessage(
      "assistant",
      "Hi — I can explain ratings, to-dos, clients, and recent feedback on this dashboard."
    );

    ui.suggestions = el("div", { id: "cc-chat-suggestions" });
    for (const prompt of SUGGESTIONS) {
      ui.suggestions.append(
        el("button", {
          type: "button",
          text: prompt,
          onClick: () => sendMessage(prompt),
        })
      );
    }

    ui.input = el("textarea", {
      rows: "1",
      placeholder: "Ask about this dashboard…",
      "aria-label": "Message ChatGPT",
    });
    ui.send = el("button", { type: "submit", text: "Send" });
    ui.form = el("form", { id: "cc-chat-form" }, [ui.input, ui.send]);
    ui.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = ui.input.value;
      ui.input.value = "";
      sendMessage(value);
    });
    ui.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        ui.form.requestSubmit();
      }
    });

    ui.panel = el("section", {
      id: "cc-chat-panel",
      role: "dialog",
      "aria-label": "ChatGPT assistant",
    }, [
      el("div", { id: "cc-chat-header" }, [
        el("div", {}, [ui.title, ui.subtitle]),
        el("div", { id: "cc-chat-header-actions" }, [ui.settingsBtn, ui.closeBtn]),
      ]),
      ui.status,
      ui.settings,
      ui.log,
      ui.suggestions,
      ui.form,
    ]);

    const root = el("div", { id: "cc-chat-root" }, [ui.panel, ui.toggle]);
    document.body.append(root);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open) {
        togglePanel(false);
      }
    });

    const openers = document.querySelectorAll("#nav-help, #nav-assistant");
    for (const opener of openers) {
      opener.addEventListener("click", () => togglePanel(true));
    }

    loadStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
