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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API on `:3001` + UI on `:5173` |
| `npm run build` | Build the UI |
| `npm start` | Serve the built app from the API |
