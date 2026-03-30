require("dotenv").config();
const express = require("express");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// Agent identity and system prompt (edit AGENT_NAME and SYSTEM_PROMPT in .env or here)
const AGENT_NAME = process.env.AGENT_NAME || "Abdullah's Copilot Agent";
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  `You are ${AGENT_NAME}, a helpful GitHub Copilot Extension agent. ` +
    "You assist developers with coding questions, project guidance, and best practices. " +
    "Always be concise, friendly, and helpful.";

app.use(express.json());

// Health-check / root route
app.get("/", (req, res) => {
  res.json({ status: `${AGENT_NAME} is running` });
});

// GitHub Copilot Extension agent endpoint
// Copilot sends a POST request with a JSON body containing a `messages` array
app.post("/", async (req, res) => {
  try {
    const messages = (req.body && req.body.messages) || [];

    // Determine the AI client to use:
    // 1. GitHub Copilot LLM proxy (uses the token Copilot sends in the request header)
    // 2. OpenAI API key from environment (fallback)
    const githubToken = req.headers["x-github-token"];
    let client;
    let model;

    if (githubToken) {
      // Use GitHub Copilot's built-in LLM proxy — no separate API key needed
      client = new OpenAI({
        baseURL: "https://api.githubcopilot.com",
        apiKey: githubToken,
      });
      model = process.env.COPILOT_MODEL || "gpt-4o";
    } else if (process.env.OPENAI_API_KEY) {
      // Fallback: use OpenAI directly (requires OPENAI_API_KEY in .env)
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    } else {
      // No AI backend available — return a static fallback response
      return sendStaticResponse(req, res, messages);
    }

    // Prepend the system prompt so the model knows who it is and what it knows
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.filter((m) => m.role !== "system"),
    ];

    // Set SSE headers before streaming starts
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream the response from the AI model
    const stream = await client.chat.completions.create({
      model,
      messages: fullMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
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

// Fallback when no AI backend is configured
function sendStaticResponse(req, res, messages) {
  let chunkCounter = 0;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  let prompt = "";
  if (lastUserMsg) {
    prompt =
      typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : JSON.stringify(lastUserMsg.content);
  }

  const responseText = prompt
    ? `You said: "${prompt}". I am ${AGENT_NAME} and I received your message! (AI model not configured — add OPENAI_API_KEY to .env to enable AI responses.)`
    : `Hello! I am ${AGENT_NAME}. Send me a message to get started. (AI model not configured — add OPENAI_API_KEY to .env to enable AI responses.)`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const created = Math.floor(Date.now() / 1000);
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
}

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
  });
}

module.exports = app;
