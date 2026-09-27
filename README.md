---
title: Chater
emoji: 💬
colorFrom: yellow
colorTo: orange
sdk: docker
app_port: 7860
pinned: false
---

# Chater

A small, good-looking chatbot you can run locally. It streams replies, keeps multiple chats in the browser, and talks to Groq, OpenAI, or Gemini when you add a key.

## Run it

```bash
npm run install:all
copy .env.example .env
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

Without an API key it still runs in **demo mode** so you can try the UI. Add a key for real answers.

## API key (one is enough)

1. **Groq (recommended, free):** [console.groq.com/keys](https://console.groq.com/keys)
2. Or OpenAI: `OPENAI_API_KEY`
3. Or Google Gemini: `GEMINI_API_KEY`

Put the key in `.env` next to `package.json`, then restart `npm run dev`.

## Deploy (Vercel, free)

This is the easiest public host for this repo. Hobby usually does **not** need a card.

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import **`Partha81-star/chat-bot`**.
3. Leave the detected settings (or set **Root Directory** to empty / repo root).
4. **Environment Variables:** `GROQ_API_KEY` = your Groq key.
5. Click **Deploy**.

You get a URL like `https://chat-bot-....vercel.app`.

## Deploy (Hugging Face, free)

1. Create a Docker Space at [huggingface.co/new-space](https://huggingface.co/new-space).
2. In the Space, **Settings → Variables and secrets**, add secret `GROQ_API_KEY`.
3. Push this GitHub repo to that Space.

## Deploy (Render)

The live site is one Node process: it serves the built UI and `/api/chat`.

1. Push this repo (already at [github.com/Partha81-star/chat-bot](https://github.com/Partha81-star/chat-bot)).
2. Go to [render.com](https://render.com) → **New** → **Blueprint** (or Web Service) → connect `Partha81-star/chat-bot`.
3. Add environment variable `GROQ_API_KEY` (same key as local `.env`). Do not put it in GitHub.
4. Deploy. Open the `*.onrender.com` URL.

If you create the service manually:

- **Build:** `npm install && npm run build`
- **Start:** `npm start`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API on `:3001` + UI on `:5173` |
| `npm run build` | Build the UI |
| `npm start` | Serve the built app from the API |
