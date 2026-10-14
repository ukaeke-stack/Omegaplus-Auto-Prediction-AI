import test from "node:test";
import assert from "node:assert/strict";
import {validateOfflineRecord} from "../offline-sync.js";

test("offline sync allows only settings and supported sport slips",()=>{
  assert.equal(validateOfflineRecord({key:"settings",payload:{riskProfile:"Balanced"},clientUpdatedAt:"2026-10-14T18:00:00.000Z"}).key,"settings");
  assert.equal(validateOfflineRecord({key:"slip:football",payload:[],clientUpdatedAt:"2026-10-14T18:00:00.000Z"}).key,"slip:football");
  assert.throws(()=>validateOfflineRecord({key:"admin",payload:{role:"admin"},clientUpdatedAt:"2026-10-14T18:00:00.000Z"}),/Unsupported offline record key/);
  assert.throws(()=>validateOfflineRecord({key:"slip:tennis",payload:[],clientUpdatedAt:"2026-10-14T18:00:00.000Z"}),/Unsupported offline record key/);
});

test("offline sync rejects invalid timestamps and oversized payloads",()=>{
  assert.throws(()=>validateOfflineRecord({key:"settings",payload:{},clientUpdatedAt:"not-a-date"}),/timestamp is invalid/);
  assert.throws(()=>validateOfflineRecord({key:"settings",payload:{text:"x".repeat(70000)},clientUpdatedAt:"2026-10-14T18:00:00.000Z"}),/too large/);
});

test("browser offline module uses IndexedDB and limits stale API cache to seven days",async()=>{
  const {readFile}=await import("node:fs/promises");
  const source=await readFile(new URL("../public/offline-first.js",import.meta.url),"utf8");
  assert.match(source,/indexedDB\.open/);
  assert.match(source,/7\*24\*60\*60\*1000/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^,]*(token|password|session)/i);
});
