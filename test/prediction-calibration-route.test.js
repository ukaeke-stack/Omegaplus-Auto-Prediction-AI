import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

let server;
let baseUrl;

before(async () => {
  process.env.VERCEL = "1";
  const { default: app } = await import("../server.js");
  server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
});

test("calibration endpoint rejects impossible calendar dates", async () => {
  const response = await fetch(baseUrl + "/api/prediction-calibration?from=2026-02-30&to=2026-02-30");
  assert.equal(response.status, 400);
  assert.equal((await response.json()).ok, false);
});

test("calibration endpoint rejects unsupported sports", async () => {
  const response = await fetch(baseUrl + "/api/prediction-calibration?from=2026-10-01&to=2026-10-02&sport=cricket");
  assert.equal(response.status, 400);
});

test("calibration endpoint bounds requested date range", async () => {
  const response = await fetch(baseUrl + "/api/prediction-calibration?from=2026-01-01&to=2026-04-01");
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /90 days/);
});
