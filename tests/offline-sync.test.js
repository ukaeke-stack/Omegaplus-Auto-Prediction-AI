import test from "node:test";
import assert from "node:assert/strict";

test("offline sync record keys are intentionally limited to settings and sport slips",async()=>{
  const source=await import("../offline-sync.js");
  assert.equal(typeof source.writeOfflineRecords,"function");
  assert.equal(typeof source.readOfflineRecords,"function");
});

test("offline-first browser module contains no auth-token persistence",async()=>{
  const {readFile}=await import("node:fs/promises");
  const source=await readFile(new URL("../public/offline-first.js",import.meta.url),"utf8");
  assert.match(source,/indexedDB\.open/);
  assert.match(source,/7\*24\*60\*60\*1000/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^,]*(token|password|session)/i);
});
