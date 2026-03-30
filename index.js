require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;
const AGENT_NAME = process.env.AGENT_NAME || "Abdullah-Agent";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

let chunkCounter = 0;

// In-memory key-value store for custom agent data
const memoryStore = {};

// OpenAI client — only initialised when an API key is provided
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json());

// Health-check / root route
app.get("/", (req, res) => {
  res.json({
    status: "GitHub Copilot Agent is running",
    agent: AGENT_NAME,
    model: openai ? OPENAI_MODEL : "echo (no API key)",
  });
});

// ── Memory endpoints ────────────────────────────────────────────────────────

// GET /memory          – return the whole store
app.get("/memory", (req, res) => {
  res.json(memoryStore);
});

// GET /memory/:key     – return a single value
app.get("/memory/:key", (req, res) => {
  const value = memoryStore[req.params.key];
  if (value === undefined) {
    return res.status(404).json({ error: "Key not found" });
  }
  res.json({ key: req.params.key, value });
});

// POST /memory  { "key": "...", "value": "..." }  – store a value
app.post("/memory", (req, res) => {
  const { key, value } = req.body || {};
  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: '"key" must be a non-empty string' });
  }
  if (
    value !== null &&
    !["string", "number", "boolean"].includes(typeof value)
  ) {
    return res
      .status(400)
      .json({ error: '"value" must be a string, number, boolean, or null' });
  }
  if (Object.keys(memoryStore).length >= 100 && !(key in memoryStore)) {
    return res
      .status(400)
      .json({ error: "Memory store limit of 100 entries reached" });
  }
  memoryStore[key] = value;
  res.status(201).json({ key, value });
});

// DELETE /memory/:key  – remove a value
app.delete("/memory/:key", (req, res) => {
  if (!(req.params.key in memoryStore)) {
    return res.status(404).json({ error: "Key not found" });
  }
  delete memoryStore[req.params.key];
  res.json({ deleted: req.params.key });
});

// ── Copilot agent endpoint ──────────────────────────────────────────────────

// GitHub Copilot sends a POST request with a JSON body containing a `messages`
// array. We forward it to OpenAI (when a key is set) or fall back to a simple
// echo reply, then stream the response back as SSE chunks.
app.post("/", async (req, res) => {
  try {
    const messages = req.body && req.body.messages;

    // Build the conversation history to send to the model
    const chatMessages = [];

    // Inject memory into the system prompt so the model is aware of stored data
    const memoryEntries = Object.entries(memoryStore);
    const memoryText =
      memoryEntries.length > 0
        ? "\n\nStored memory:\n" +
          memoryEntries.map(([k, v]) => `${k}: ${v}`).join("\n")
        : "";

    chatMessages.push({
      role: "system",
      content:
        `You are ${AGENT_NAME}, a helpful GitHub Copilot Agent assistant.` +
        memoryText,
    });

    if (Array.isArray(messages) && messages.length > 0) {
      messages.forEach((m) => {
        // Only allow "user" and "assistant" roles to prevent role injection
        if (m.role === "user" || m.role === "assistant") {
          chatMessages.push({ role: m.role, content: m.content });
        }
      });
    }

    // Set up SSE headers before any writing
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (openai) {
      // ── Real AI response via OpenAI streaming ──────────────────────────
      let stream;
      try {
        stream = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: chatMessages,
          stream: true,
        });
      } catch (openaiErr) {
        console.error("OpenAI API error:", openaiErr.message || openaiErr);
        if (!res.headersSent) {
          return res
            .status(502)
            .json({ error: "AI model request failed", detail: openaiErr.message });
        }
        return res.end();
      }

      for await (const part of stream) {
        const chunk = {
          id: part.id || `chatcmpl-agent-${++chunkCounter}`,
          object: "chat.completion.chunk",
          created: part.created || Math.floor(Date.now() / 1000),
          model: part.model || OPENAI_MODEL,
          choices: part.choices,
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } else {
      // ── Fallback echo reply (no API key configured) ────────────────────
      const lastUserMsg = [...chatMessages]
        .reverse()
        .find((m) => m.role === "user");
      const prompt = lastUserMsg
        ? typeof lastUserMsg.content === "string"
          ? lastUserMsg.content
          : JSON.stringify(lastUserMsg.content)
        : "";

      const responseText = prompt
        ? `You said: "${prompt}". I am ${AGENT_NAME} and I received your message!`
        : `Hello! I am ${AGENT_NAME}. Send me a message to get started.`;

      const created = Math.floor(Date.now() / 1000);
      const tokens = responseText.split(" ");
      tokens.forEach((token, index) => {
        const chunk = {
          id: `chatcmpl-agent-${++chunkCounter}`,
          object: "chat.completion.chunk",
          created,
          model: "echo",
          choices: [
            {
              index: 0,
              delta: { content: index === 0 ? token : ` ${token}` },
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });

      const doneChunk = {
        id: `chatcmpl-agent-${++chunkCounter}`,
        object: "chat.completion.chunk",
        created,
        model: "echo",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Error handling Copilot request:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.end();
    }
  }
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`${AGENT_NAME} server is running on port ${PORT}`);
    if (!openai) {
      console.log(
        "Tip: Set OPENAI_API_KEY in .env to enable real AI responses."
      );
    }
  });
}

module.exports = app;
