# Abdullah's GitHub Copilot Agent

A custom GitHub Copilot Extension agent built with Node.js and Express. This server receives chat messages from GitHub Copilot and streams responses back using Server-Sent Events (SSE).

## Features

- Receives messages from GitHub Copilot Extensions via HTTP POST
- Streams responses token-by-token using the OpenAI-compatible SSE format
- Health-check endpoint to verify server status
- Environment-based configuration via `.env`

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- A [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) configured as a Copilot Extension

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Abdullahsaeed1-1/Agent.git
   cd Agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your desired `PORT` (default: `3000`).

## Running the Server

**Development:**
```bash
npm start
```

You should see:
```
GitHub Copilot Agent server is running on port 3000
```

**Verify it's running:**
```bash
curl http://localhost:3000
```
Expected response:
```json
{ "status": "GitHub Copilot Agent is running" }
```

## How It Works

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/`  | Health check – confirms the agent is running |
| `POST` | `/`  | Copilot agent endpoint – receives chat messages and streams a response |

### Request Format (POST /)

GitHub Copilot sends a JSON body with a `messages` array (OpenAI chat format):

```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user",   "content": "Hello, agent!" }
  ]
}
```

### Response Format

The server responds with `text/event-stream` (SSE), streaming the reply word-by-word in the OpenAI-compatible chunk format, and ends with `data: [DONE]`.

## Exposing to the Internet (for GitHub App)

GitHub needs to reach your local server. Use [ngrok](https://ngrok.com/) to create a public tunnel:

```bash
npx ngrok http 3000
```

Copy the generated `https://…ngrok.io` URL and set it as the **Callback URL** in your GitHub App settings.

## Connecting to GitHub Copilot

1. Create a [GitHub App](https://github.com/settings/apps/new) with **Copilot Extension** enabled.
2. Set the **Callback URL** to your server's public URL (e.g., from ngrok).
3. Install the GitHub App on your account or organisation.
4. In VS Code (or GitHub.com chat), type `@<your-agent-name>` to start chatting with your agent.

## Project Structure

```
Agent/
├── index.js        # Main Express server (Copilot agent logic)
├── package.json    # Node.js project metadata and scripts
├── .env.example    # Sample environment variable file
├── .gitignore      # Files excluded from version control
└── README.md       # This file
```

## License

ISC
