# Abdullah Agent — AI-Powered GitHub Copilot Extension

A Node.js/Express server that acts as a **GitHub Copilot Extension (Agent)** backed by the **OpenAI API**. It streams real AI responses to GitHub Copilot chat and maintains short-term conversation memory per session.

## Features

- 🤖 Real AI responses via OpenAI (GPT-4o-mini by default)
- 🔄 Streaming responses using Server-Sent Events (SSE)
- 🧠 Per-session conversation memory (configurable window size)
- ⚙️ Fully configurable via environment variables

## Quick Start

### 1. Clone & install dependencies

```bash
git clone https://github.com/Abdullahsaeed1-1/Agent.git
cd Agent
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set your **OpenAI API key**:

```
OPENAI_API_KEY=sk-...
```

### 3. Run the server

```bash
node index.js
```

The server starts on **port 3000** by default (change with `PORT` env var).

### 4. Expose the server to the internet

Use **ngrok** or **localtunnel** so GitHub can reach your local server:

```bash
# ngrok
ngrok http 3000

# localtunnel
lt --port 3000
```

Copy the public HTTPS URL (e.g. `https://abc123.ngrok.io`).

### 5. Configure your GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → Edit your app**.
2. In **General**, set the **Callback URL** to your public URL.
3. In **Permissions & events → Account permissions**, set **Copilot Chat** to **Read-only**.
4. Click **Save changes**, then accept the updated permissions under **Install App**.
5. In the **Copilot** tab, set **App Type** to **Agent** and paste your public URL.
6. Click **Save**.

### 6. Test in VS Code

Open GitHub Copilot Chat and type:

```
@abdullah-agent Hello!
```

You should receive a real AI-generated response. 🎉

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required.** Your OpenAI API key. |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model to use. |
| `SYSTEM_PROMPT` | *(see .env.example)* | System prompt for the assistant. |
| `MEMORY_SIZE` | `10` | Number of messages to keep in memory per session. |
| `PORT` | `3000` | Port the server listens on. |

## License

ISC
