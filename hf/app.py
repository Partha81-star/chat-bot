import os
from groq import Groq
import gradio as gr

SYSTEM_PROMPT = (
    "You are Chater, a warm, sharp, and genuinely helpful chatbot. "
    "Keep answers clear and conversational. Use short paragraphs and bullet lists when they help. "
    "If you are unsure, say so. Do not invent facts. Match the user's language."
)
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


def reply(message, history):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        yield "Add a Space secret named GROQ_API_KEY in Settings, then restart the Space."
        return

    client = Groq(api_key=api_key)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in history or []:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    stream = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.7,
        stream=True,
    )
    text = ""
    for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        text += token
        yield text


demo = gr.ChatInterface(
    fn=reply,
    type="messages",
    title="Chater",
    description="Ask anything. Powered by Groq.",
    examples=[
        "Explain recursion like I’m 12",
        "Draft a polite follow-up email",
        "Give me a 7-day beginner workout",
    ],
)

if __name__ == "__main__":
    demo.queue().launch()
