import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STORAGE_KEY = "chater-chats-v1";
const PROMPTS = [
  "Explain recursion like I’m 12",
  "Draft a polite follow-up email",
  "Give me a 7-day beginner workout",
  "Help me debug this idea for a mini project",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function titleFrom(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.slice(0, 42) || "New chat";
}

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // ignore
  }
  return [{ id: uid(), title: "New chat", messages: [] }];
}

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(chats[0].id);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState({ configured: false, provider: null });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const active = useMemo(
    () => chats.find((c) => c.id === activeId) || chats[0],
    [chats, activeId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ configured: false, provider: null }));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, busy]);

  function updateActive(updater) {
    setChats((prev) =>
      prev.map((chat) => (chat.id === active.id ? updater(chat) : chat))
    );
  }

  function newChat() {
    const chat = { id: uid(), title: "New chat", messages: [] };
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    setDraft("");
    setSidebarOpen(false);
  }

  function deleteChat(id) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.length) {
        const chat = { id: uid(), title: "New chat", messages: [] };
        setActiveId(chat.id);
        return [chat];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  async function send(text = draft) {
    const content = text.trim();
    if (!content || busy) return;

    const history = [...active.messages, { role: "user", content }];
    updateActive((chat) => ({
      ...chat,
      title: chat.messages.length ? chat.title : titleFrom(content),
      messages: history,
    }));
    setDraft("");
    setBusy(true);
    setSidebarOpen(false);

    let assistant = "";
    updateActive((chat) => ({
      ...chat,
      messages: [...history, { role: "assistant", content: "", pending: true }],
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content: c }) => ({ role, content: c })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Could not reach Chater’s server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = JSON.parse(line.slice(5).trim());
          if (payload.error) throw new Error(payload.error);
          if (payload.token) {
            assistant += payload.token;
            const snapshot = assistant;
            updateActive((chat) => ({
              ...chat,
              messages: [
                ...history,
                { role: "assistant", content: snapshot, pending: true },
              ],
            }));
          }
        }
      }

      updateActive((chat) => ({
        ...chat,
        messages: [...history, { role: "assistant", content: assistant || "…" }],
      }));
    } catch (error) {
      updateActive((chat) => ({
        ...chat,
        messages: [
          ...history,
          {
            role: "assistant",
            content: error.message || "Something went wrong.",
            error: true,
          },
        ],
      }));
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="mark">C</div>
          <div>
            <h1>Chater</h1>
            <p>talk, think, make</p>
          </div>
        </div>
        <button className="new-chat" onClick={newChat}>
          + New chat
        </button>
        <div className="chat-list">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === active.id ? "active" : ""}`}
            >
              <button
                onClick={() => {
                  setActiveId(chat.id);
                  setSidebarOpen(false);
                }}
              >
                {chat.title}
              </button>
              <button className="ghost" onClick={() => deleteChat(chat.id)} aria-label="Delete chat">
                ×
              </button>
            </div>
          ))}
        </div>
        <div className={`status ${health.configured ? "" : "demo"}`}>
          {health.configured ? (
            <>
              Live AI · <strong>{health.provider}</strong>
            </>
          ) : (
            <>
              Demo mode · add <strong>GROQ_API_KEY</strong>
            </>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button className="ghost" onClick={() => setSidebarOpen((v) => !v)}>
            Menu
          </button>
          <strong>{active.title}</strong>
          <span />
        </div>

        <div className="messages">
          {!active.messages.length ? (
            <div className="empty">
              <h2>What’s on your mind?</h2>
              <p>Ask a question, paste some code, or pick a prompt to start.</p>
              <div className="prompts">
                {PROMPTS.map((prompt) => (
                  <button key={prompt} onClick={() => send(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="thread">
              {active.messages.map((message, index) => (
                <div key={index} className={`row ${message.role === "user" ? "user" : "bot"}`}>
                  <div className="avatar">{message.role === "user" ? "You" : "C"}</div>
                  <div className={`bubble ${message.error ? "error" : ""}`}>
                    {message.role === "assistant" ? (
                      <>
                        <Markdown remarkPlugins={[remarkGfm]}>{message.content || " "}</Markdown>
                        {message.pending ? <span className="cursor" /> : null}
                      </>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Message Chater…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="send" disabled={busy || !draft.trim()} onClick={() => send()}>
              ↑
            </button>
          </div>
          <p className="hint">Enter to send · Shift+Enter for a new line</p>
        </div>
      </main>
    </div>
  );
}
