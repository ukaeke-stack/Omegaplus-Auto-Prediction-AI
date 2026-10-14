import test from "node:test";
import assert from "node:assert/strict";
import {parseBookingAssistantPrompt} from "../booking-assistant.js";

test("parses the requested 35-game SportyBet Over 2.5 three-day request",()=>{
  const request=parseBookingAssistantPrompt("Give me SportyBet booking code for 35 football games of Over 2.5 goals from today, tomorrow and next tomorrow","2026-10-14");
  assert.equal(request.requestedGames,35);
  assert.equal(request.sport,"football");
  assert.equal(request.bookmaker,"SportyBet");
  assert.equal(request.direction,"over");
  assert.equal(request.line,2.5);
  assert.deepEqual(request.dates.map(x=>x.date),["2026-10-14","2026-10-15","2026-10-16"]);
});

test("defaults to today when no date phrase is supplied",()=>{
  const request=parseBookingAssistantPrompt("SportyBet 4 football matches Under 1.5 goals","2026-10-14");
  assert.deepEqual(request.dates.map(x=>x.date),["2026-10-14"]);
  assert.equal(request.direction,"under");
  assert.equal(request.line,1.5);
});

test("rejects unsupported markets, bookmakers, sports and counts",()=>{
  assert.throws(()=>parseBookingAssistantPrompt("SportyBet 4 basketball games Over 2.5","2026-10-14"),/football fixtures/);
  assert.throws(()=>parseBookingAssistantPrompt("Bet9ja 4 football games Over 2.5","2026-10-14"),/specify SportyBet/);
  assert.throws(()=>parseBookingAssistantPrompt("SportyBet 5 football games Over 6.5","2026-10-14"),/Supported goal lines/);
  assert.throws(()=>parseBookingAssistantPrompt("SportyBet 51 football games Over 2.5","2026-10-14"),/between 1 and 50/);
});
