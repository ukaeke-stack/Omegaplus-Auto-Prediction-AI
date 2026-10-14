import test from "node:test";
import assert from "node:assert/strict";
import { generateWithFallback } from "../ai-providers.js";

const ok = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const fail = (status, message) => new Response(JSON.stringify({ error: { message } }), { status, headers: { "Content-Type": "application/json" } });

test("uses Groq first when it succeeds", async () => {
  let calls = 0;
  const result = await generateWithFallback({
    env: { GROQ_API_KEY: "test-groq", GEMINI_API_KEY: "test-gemini", OLLAMA_API_KEY: "test-ollama" },
    messages: [{ role: "user", content: "Hello" }],
    fetchImpl: async () => { calls++; return ok({ choices: [{ message: { content: "Hello from Groq" } }] }); }
  });
  assert.equal(result.provider, "groq");
  assert.equal(result.reply, "Hello from Groq");
  assert.equal(result.fallbackUsed, false);
  assert.equal(calls, 1);
});

test("falls back to Gemini after a Groq failure", async () => {
  let calls = 0;
  const result = await generateWithFallback({
    env: { GROQ_API_KEY: "test-groq", GEMINI_API_KEY: "test-gemini", OLLAMA_API_KEY: "test-ollama" },
    messages: [{ role: "user", content: "Hello" }],
    fetchImpl: async url => {
      calls++;
      if (String(url).includes("groq")) return fail(429, "rate limited");
      return ok({ candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] } }] });
    }
  });
  assert.equal(result.provider, "gemini");
  assert.equal(result.fallbackUsed, true);
  assert.equal(calls, 2);
});

test("falls back to Ollama Cloud after Groq and Gemini fail", async () => {
  const result = await generateWithFallback({
    env: { GROQ_API_KEY: "test-groq", GEMINI_API_KEY: "test-gemini", OLLAMA_API_KEY: "test-ollama" },
    messages: [{ role: "user", content: "Hello" }],
    fetchImpl: async url => {
      if (String(url).includes("groq")) return fail(503, "unavailable");
      if (String(url).includes("generativelanguage")) return fail(429, "quota");
      return ok({ message: { content: "Hello from Ollama" } });
    }
  });
  assert.equal(result.provider, "ollama");
  assert.equal(result.fallbackUsed, true);
});

test("reports unavailable when no provider is configured", async () => {
  await assert.rejects(
    generateWithFallback({ env: {}, messages: [{ role: "user", content: "Hello" }], fetchImpl: async () => { throw new Error("must not run"); } }),
    error => error.code === "AI_PROVIDERS_UNAVAILABLE"
  );
});
