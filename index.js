require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// Conversation memory: stores the last MEMORY_SIZE user+assistant message pairs per session.
// Each "turn" counts as two messages (one user, one assistant), so total stored messages
// equals MEMORY_SIZE * 2.
const MEMORY_SIZE = parseInt(process.env.MEMORY_SIZE || "10", 10);
const conversationMemory = new Map();

app.use(express.json());

// Health-check / root route
app.get("/", (req, res) => {
  res.json({ status: "GitHub Copilot Agent is running" });
});

// GitHub Copilot Extension agent endpoint
// Copilot sends a POST request with a JSON body containing a `messages` array
app.post("/", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
      return;
    }

    const openai = new OpenAI({ apiKey });

    const incomingMessages = (req.body && req.body.messages) || [];

    // Use x-session-id for session tracking (non-sensitive, purpose-built header)
    const sessionId = req.headers["x-session-id"] || "default";

    // Retrieve stored memory (previous user+assistant turns) for this session
    const memory = conversationMemory.get(sessionId) || [];

    // Build message list: stored history + incoming messages from this request
    const contextMessages = [...memory, ...incomingMessages];

    // Build the full message list for OpenAI, prepending a system prompt
    const systemPrompt = {
      role: "system",
      content:
        process.env.SYSTEM_PROMPT ||
        "You are a helpful AI assistant integrated into GitHub Copilot. Answer clearly and concisely.",
    };
    const openaiMessages = [systemPrompt, ...contextMessages];

    // Set SSE headers before streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: openaiMessages,
      stream: true,
    });

    let assistantReply = "";

    for await (const chunk of stream) {
      // Forward each SSE chunk directly to the client
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      // Accumulate the assistant's reply for memory storage
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        assistantReply += delta;
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

    // Only persist to memory after a successful full stream so that incomplete
    // exchanges do not cause context drift on the next turn.
    if (assistantReply) {
      const updatedMemory = [
        ...memory,
        ...incomingMessages,
        { role: "assistant", content: assistantReply },
      ].slice(-(MEMORY_SIZE * 2));
      conversationMemory.set(sessionId, updatedMemory);
    }
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
    console.log(`GitHub Copilot Agent server is running on port ${PORT}`);
  });
}

module.exports = app;
