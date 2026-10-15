import test from "node:test";
import assert from "node:assert/strict";
import {parseBookingAssistantPrompt} from "../booking-assistant.js";

test("parses an Over 2.5 three-day request",()=>{
  const request=parseBookingAssistantPrompt("Find 35 football games Over 2.5 goals from today, tomorrow and next tomorrow for SportyBet","2026-10-14");
  assert.equal(request.requestedGames,35);
  assert.equal(request.sport,"football");
  assert.equal(request.bookmaker,"SportyBet");
  assert.equal(request.criteria[0].type,"goals");
  assert.equal(request.criteria[0].direction,"over");
  assert.equal(request.criteria[0].line,2.5);
  assert.deepEqual(request.dates.map(x=>x.date),["2026-10-14","2026-10-15","2026-10-16"]);
});

test("supports BTTS Yes and BTTS No as separate exact options",()=>{
  assert.deepEqual(parseBookingAssistantPrompt("SportyBet 20 football games BTTS Yes today","2026-10-14").criteria,[{type:"btts",option:"Yes",label:"BTTS Yes"}]);
  assert.deepEqual(parseBookingAssistantPrompt("SportyBet 20 football games BTTS No today","2026-10-14").criteria,[{type:"btts",option:"No",label:"BTTS No"}]);
});

test("supports best games across any market",()=>{\n  const request=parseBookingAssistantPrompt("SportyBet best 20 games from any options, markets or leagues today","2026-10-14");\n  assert.equal(request.requestedGames,20);\n  assert.equal(request.criteria[0].type,"any");\n});\n\ntest("supports multiple requested markets without replacing them",()=>{
  const request=parseBookingAssistantPrompt("SportyBet 20 football games BTTS Yes and Over 2.5 goals today","2026-10-14");
  assert.equal(request.criteria.length,2);
  assert.deepEqual(request.criteria.map(c=>c.type),["goals","btts"]);
});

test("supports corners, cards and result markets",()=>{
  assert.equal(parseBookingAssistantPrompt("SportyBet 8 football games Over 8.5 corners today","2026-10-14").criteria[0].type,"corners");
  assert.equal(parseBookingAssistantPrompt("SportyBet 8 football games Under 4.5 cards today","2026-10-14").criteria[0].type,"cards");
  assert.deepEqual(parseBookingAssistantPrompt("SportyBet 8 football games 1X2 Away today","2026-10-14").criteria,[{type:"1x2",option:"Away",label:"1X2 Away"}]);
});

test("defaults to today and rejects unsupported sports, bookmakers, goal lines and counts",()=>{
  assert.deepEqual(parseBookingAssistantPrompt("SportyBet 4 football matches Under 1.5 goals","2026-10-14").dates.map(x=>x.date),["2026-10-14"]);
  assert.throws(()=>parseBookingAssistantPrompt("SportyBet 4 basketball games Over 2.5","2026-10-14"),/football fixtures/);
  assert.throws(()=>parseBookingAssistantPrompt("Bet9ja 4 football games Over 2.5","2026-10-14"),/specify SportyBet/);
  assert.throws(()=>parseBookingAssistantPrompt("SportyBet 5 football games Over 6.5 goals","2026-10-14"),/Supported goal lines/);
  assert.throws(()=>parseBookingAssistantPrompt("SportyBet 51 football games Over 2.5","2026-10-14"),/between 1 and 50/);
});
