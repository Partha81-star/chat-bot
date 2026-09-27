import os
import spaces
from groq import Groq
import gradio as gr

SYSTEM_PROMPT = (
    "You are Chater, a warm, sharp, and genuinely helpful chatbot. "
    "Keep answers clear and conversational. Use short paragraphs and bullet lists when they help. "
    "If you are unsure, say so. Do not invent facts. Match the user's language."
)
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(block.get("text") or block.get("content") or "")
        return "".join(parts)
    return str(content or "")


@spaces.GPU(duration=30)
def reply(message, history):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "Add a Space secret named GROQ_API_KEY in Settings, then restart the Space."

    user_text = text_of(message)
    client = Groq(api_key=api_key)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in history or []:
        role = turn.get("role") if isinstance(turn, dict) else None
        content = text_of(turn.get("content") if isinstance(turn, dict) else "")
        if role in ("user", "assistant") and content.strip():
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_text})

    completion = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.7,
    )
    return completion.choices[0].message.content or ""


demo = gr.ChatInterface(
    fn=reply,
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
