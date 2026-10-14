const PROVIDER_ORDER = ["groq", "gemini", "ollama"];

const DEFAULT_MODELS = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-flash",
  ollama: "gpt-oss:120b"
};

function timeoutSignal(ms) {
  return AbortSignal.timeout(ms);
}

async function readJson(response) {
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error("AI provider returned invalid JSON."); }
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || ("HTTP " + response.status);
    throw new Error(detail.slice(0, 300));
  }
  return data;
}

function normalizeMessages(messages) {
  return messages
    .filter(m => ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
}

async function callGroq(messages, env, fetchImpl) {
  const key = env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  const response = await fetchImpl(env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.GROQ_MODEL || DEFAULT_MODELS.groq,
      messages,
      temperature: 0.4,
      max_tokens: 900
    }),
    signal: timeoutSignal(Number(env.AI_PROVIDER_TIMEOUT_MS) || 18000)
  });
  const data = await readJson(response);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Groq returned an empty reply.");
  return content.trim();
}

async function callGemini(messages, env, fetchImpl) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  const model = env.GEMINI_MODEL || DEFAULT_MODELS.gemini;
  const system = messages.find(m => m.role === "system")?.content || "";
  const contents = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const url = (env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta")
    + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 900 }
    }),
    signal: timeoutSignal(Number(env.AI_PROVIDER_TIMEOUT_MS) || 18000)
  });
  const data = await readJson(response);
  const content = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
  if (!content) throw new Error(data?.promptFeedback?.blockReason || "Gemini returned an empty reply.");
  return content;
}

async function callOllama(messages, env, fetchImpl) {
  const key = env.OLLAMA_API_KEY;
  if (!key) throw new Error("OLLAMA_API_KEY is not configured.");
  const response = await fetchImpl(env.OLLAMA_API_URL || "https://ollama.com/api/chat", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL || DEFAULT_MODELS.ollama,
      messages,
      stream: false,
      options: { temperature: 0.4, num_predict: 900 }
    }),
    signal: timeoutSignal(Number(env.AI_PROVIDER_TIMEOUT_MS) || 18000)
  });
  const data = await readJson(response);
  const content = data?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Ollama Cloud returned an empty reply.");
  return content.trim();
}

const CALLERS = { groq: callGroq, gemini: callGemini, ollama: callOllama };

/**
 * Tries configured providers in the order Groq -> Gemini -> Ollama Cloud.
 * Inject fetchImpl/env in tests; API keys are read only on the server.
 */
export async function generateWithFallback({ messages, env = process.env, fetchImpl = fetch } = {}) {
  const safeMessages = normalizeMessages(messages || []);
  if (!safeMessages.some(m => m.role === "user")) throw new Error("A user message is required.");
  const errors = [];
  for (const provider of PROVIDER_ORDER) {
    if (!env[{ groq: "GROQ_API_KEY", gemini: "GEMINI_API_KEY", ollama: "OLLAMA_API_KEY" }[provider]]) {
      errors.push({ provider, error: "not configured" });
      continue;
    }
    try {
      const reply = await CALLERS[provider](safeMessages, env, fetchImpl);
      return { reply, provider, fallbackUsed: errors.some(e => e.error !== "not configured"), attempted: [...errors.map(e => e.provider), provider] };
    } catch (error) {
      errors.push({ provider, error: String(error?.message || "provider failed").slice(0, 240) });
    }
  }
  const error = new Error("All configured AI providers failed. Check the provider keys, model settings and service logs.");
  error.code = "AI_PROVIDERS_UNAVAILABLE";
  error.providerErrors = errors;
  throw error;
}

export const AI_PROVIDER_ORDER = [...PROVIDER_ORDER];
