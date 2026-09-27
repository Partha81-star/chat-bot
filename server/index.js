import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const SYSTEM_PROMPT = `You are Chater, a warm, sharp, and genuinely helpful chatbot.
Keep answers clear and conversational. Use short paragraphs and bullet lists when they help.
If you are unsure, say so. Do not invent facts. Match the user's language.`;

function getProvider() {
  if (process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      style: "openai",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      name: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      key: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
      style: "openai",
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      name: "gemini",
      key: process.env.GEMINI_API_KEY,
      model: "gemini-2.0-flash",
      style: "gemini",
    };
  }
  return null;
}

function localReply(messages) {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const text = last.toLowerCase();

  if (!text.trim()) {
    return "Say something and I’ll jump in.";
  }
  if (/\b(hi|hello|hey|yo)\b/.test(text)) {
    return "Hey — I’m Chater. Ask me anything, from code to everyday questions. Add a Groq API key in `.env` to unlock the full AI brain.";
  }
  if (/\b(who are you|what are you)\b/.test(text)) {
    return "I’m Chater, your local chat companion. Right now I’m running in demo mode because no API key is configured yet.";
  }
  if (/\bhelp\b/.test(text)) {
    return "Try asking me to explain a concept, draft a message, debug an idea, or plan a mini project. Once you add `GROQ_API_KEY`, replies get much smarter.";
  }

  return `I heard: “${last.slice(0, 280)}”\n\nI’m in demo mode until an API key is added. Drop a Groq, OpenAI, or Gemini key into \`.env\`, restart the server, and I’ll answer for real.`;
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamOpenAI({ url, key, model }, messages, res) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.7,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Provider error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content;
        if (token) writeSse(res, { token });
      } catch {
        // ignore partial JSON frames
      }
    }
  }
}

async function streamGemini({ key, model }, messages, res) {
  const contents = messages
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Gemini error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      try {
        const json = JSON.parse(data);
        const token = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (token) writeSse(res, { token });
      } catch {
        // ignore partial JSON frames
      }
    }
  }
}

app.get("/api/health", (_req, res) => {
  const provider = getProvider();
  res.json({
    ok: true,
    configured: Boolean(provider),
    provider: provider?.name || null,
  });
});

app.post("/api/chat", async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const provider = getProvider();

  try {
    if (!provider) {
      const reply = localReply(clean);
      for (const chunk of reply.split(/(\s+)/)) {
        writeSse(res, { token: chunk });
      }
      writeSse(res, { done: true, demo: true });
      return res.end();
    }

    if (provider.style === "gemini") {
      await streamGemini(provider, clean, res);
    } else {
      await streamOpenAI(provider, clean, res);
    }
    writeSse(res, { done: true, provider: provider.name });
    res.end();
  } catch (error) {
    writeSse(res, { error: error.message || "Chat failed" });
    res.end();
  }
});

const dist = path.join(__dirname, "../client/dist");
app.use(express.static(dist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(dist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, "0.0.0.0", () => {
  const provider = getProvider();
  console.log(`Chater running on http://localhost:${PORT}`);
  console.log(provider ? `Provider: ${provider.name}` : "Demo mode — add GROQ_API_KEY to .env for live AI");
});
