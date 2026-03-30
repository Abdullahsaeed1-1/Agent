require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
let chunkCounter = 0;

app.use(express.json());

// Health-check / root route
app.get("/", (req, res) => {
  res.json({ status: "GitHub Copilot Agent is running" });
});

// GitHub Copilot Extension agent endpoint
// Copilot sends a POST request with a JSON body containing a `messages` array
app.post("/", (req, res) => {
  try {
    const messages = req.body && req.body.messages;

    // Extract the last user message as the prompt
    let prompt = "";
    if (Array.isArray(messages) && messages.length > 0) {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        prompt =
          typeof lastUserMsg.content === "string"
            ? lastUserMsg.content
            : JSON.stringify(lastUserMsg.content);
      }
    }

    const responseText = prompt
      ? `You said: "${prompt}". I am your GitHub Copilot Agent and I received your message!`
      : "Hello! I am your GitHub Copilot Agent. Send me a message to get started.";

    // Respond using Server-Sent Events (SSE) in the OpenAI-compatible streaming format
    // that GitHub Copilot Extensions expect
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const created = Math.floor(Date.now() / 1000);

    // Stream the response token by token
    const tokens = responseText.split(" ");
    tokens.forEach((token, index) => {
      const chunk = {
        id: `chatcmpl-agent-${++chunkCounter}`,
        object: "chat.completion.chunk",
        created,
        model: "copilot-agent",
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

    // Send the final [DONE] event
    const doneChunk = {
      id: `chatcmpl-agent-${++chunkCounter}`,
      object: "chat.completion.chunk",
      created,
      model: "copilot-agent",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
    res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
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
    console.log(`GitHub Copilot Agent server is running on port ${PORT}`);
  });
}

module.exports = app;
