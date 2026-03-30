# GitHub Copilot Agent — Setup Guide

This guide walks you through every step needed to turn this Express server into a fully working **GitHub Copilot Extension** that responds inside VS Code with real AI answers.

---

## Step 1 — Create a GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Fill in the form as follows:

   | Field | Value |
   |---|---|
   | **GitHub App name** | `abdullah-copilot-agent` *(must be globally unique; add numbers if taken)* |
   | **Description** | `My custom GitHub Copilot AI agent` |
   | **Homepage URL** | `https://github.com/Abdullahsaeed1-1/Agent` |
   | **Callback URL** | *(leave blank)* |
   | **Webhook → Active** | **Uncheck** this box (we don't need webhooks) |
   | **Permissions** | Leave all as default |
   | **Where can this app be installed?** | **Only on this account** |

3. Click **Create GitHub App**.

---

## Step 2 — Enable Copilot Extension

1. After creating the app, click **Edit** on your new app.
2. In the left sidebar, click **Copilot**.
3. Set **App Type** to **Agent**.
4. Set **Agent Definition → URL** to your server's public URL (see Step 4 below).
5. Click **Save**.

---

## Step 3 — Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and customise:
   - **`AGENT_NAME`** — The name your agent uses in its replies.
   - **`SYSTEM_PROMPT`** — Instructions that tell the AI who it is and what it knows.  
     You can add any custom knowledge here, for example:
     ```
     SYSTEM_PROMPT="You are Abdullah's Agent. You always answer in Urdu. You specialise in React and Node.js. Abdullah's favourite colour is green."
     ```
   - **`OPENAI_API_KEY`** *(optional)* — Required only when testing locally without a Copilot token. Get one at <https://platform.openai.com/api-keys>.

> **Note:** When your agent runs inside GitHub Copilot (VS Code), Copilot automatically sends an `X-GitHub-Token` header. The server uses this token to call the Copilot LLM proxy — **no OpenAI API key is needed** in that case.

---

## Step 4 — Expose Your Server to the Internet (for local testing)

GitHub needs a public HTTPS URL to reach your local server. Use **ngrok** (free):

1. Install ngrok: <https://ngrok.com/download>
2. Start your server:
   ```bash
   node index.js
   ```
3. In a second terminal, expose port 3000:
   ```bash
   ngrok http 3000
   ```
4. Copy the `https://....ngrok-free.app` URL shown by ngrok.
5. Paste it as the **Agent Definition URL** in your GitHub App's Copilot settings (Step 2).

---

## Step 5 — Install the App on Your Account

1. In your GitHub App's settings, click **Install App** in the left sidebar.
2. Click **Install** next to your account.
3. Select **All repositories** or choose specific ones.
4. Click **Install**.

---

## Step 6 — Use Your Agent in VS Code

1. Open VS Code and open the **GitHub Copilot Chat** panel.
2. Type `@` — your agent's name should appear in the list.
3. Select it and start chatting!

---

## Adding Custom Memory / Knowledge

Edit `SYSTEM_PROMPT` in your `.env` file to give the agent permanent knowledge:

```
SYSTEM_PROMPT="You are Abdullah's Agent. You must always reply in Urdu. \
You know that Abdullah is building a React + Node.js e-commerce project called Luxara. \
The backend API is at https://api.luxara.pk. Always suggest best practices for Node.js."
```

For large datasets (PDFs, whole codebases), look into **RAG (Retrieval-Augmented Generation)** using a vector database like [Pinecone](https://www.pinecone.io/) or [ChromaDB](https://www.trychroma.com/).

---

## Project Structure

```
Agent/
├── index.js          # Express server — the agent's brain
├── .env.example      # Template for environment variables (safe to commit)
├── .env              # Your actual secrets (DO NOT commit this!)
├── SETUP.md          # This guide
├── package.json
└── node_modules/
```
