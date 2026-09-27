export default function handler(_req, res) {
  const provider = process.env.GROQ_API_KEY
    ? "groq"
    : process.env.OPENAI_API_KEY
      ? "openai"
      : null;
  res.status(200).json({
    ok: true,
    configured: Boolean(provider),
    provider,
  });
}
