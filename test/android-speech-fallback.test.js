import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [native, voice, chat, html] = await Promise.all([
  readFile(new URL("../android/app/src/main/java/com/omegaplus/proai/MainActivity.java", import.meta.url), "utf8"),
  readFile(new URL("../public/voice-assistant.js", import.meta.url), "utf8"),
  readFile(new URL("../public/ai-chat.js", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8")
]);

test("Android bridge exposes speech readiness and source-specific speech", () => {
  assert.match(native, /getSpeechStatus\(\)/);
  assert.match(native, /speakTextFor\(String text,String source\)/);
  assert.match(native, /ttsInitializationComplete/);
});

test("native TTS initialization and utterance errors dispatch a browser fallback", () => {
  assert.match(native, /dispatchSpeechFallback\(queued,source\)/);
  assert.match(native, /dispatchSpeechFallback\(currentSpeechText,currentSpeechSource\)/);
  assert.match(native, /omega-native-speech-fallback/);
});

test("voice assistant fallback is isolated to voice-assistant replies", () => {
  assert.match(voice, /speakTextFor\(value,"voice-assistant"\)/);
  assert.match(voice, /detail\?\.source==="voice-assistant"/);
  assert.match(voice, /state!=="unavailable"/);
});

test("AI chat fallback is isolated to AI chat replies", () => {
  assert.match(chat, /speakTextFor\(value,"ai-chat"\)/);
  assert.match(chat, /detail\?\.source==="ai-chat"/);
  assert.match(chat, /state!=="unavailable"/);
});

test("HTML cache-busts the updated voice and chat scripts", () => {
  assert.match(html, /voice-assistant\.js\?v=1\.0\.7/);
  assert.match(html, /ai-chat\.js\?v=1\.1\.3/);
});
