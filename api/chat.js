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
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      name: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      key: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
    };
  }
  return null;
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
    } catch {
      body = {};
    }
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const provider = getProvider();
  if (!provider) {
    writeSse(res, {
      token: "Add GROQ_API_KEY in the Vercel project Environment Variables, then redeploy.",
    });
    writeSse(res, { done: true, demo: true });
    res.end();
    return;
  }

  try {
    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        temperature: 0.7,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...clean],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      writeSse(res, { error: errText || `Provider error ${response.status}` });
      res.end();
      return;
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
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content;
          if (token) writeSse(res, { token });
        } catch {
          // ignore partial frames
        }
      }
    }

    writeSse(res, { done: true, provider: provider.name });
    res.end();
  } catch (error) {
    writeSse(res, { error: error.message || "Chat failed" });
    res.end();
  }
}
