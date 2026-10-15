import test from "node:test";
import assert from "node:assert/strict";
import { summarizePredictionCalibration } from "../prediction-calibration.js";

test("calibration scores use model probabilities and settled outcomes only", () => {
  const result = summarizePredictionCalibration([
    { modelProbability: 80, status: "Won" },
    { derivedModel: { modelProbability: 20 }, status: "Lost" },
    { confidence: 99, odds: 1.1, status: "Won" },
    { modelProbability: 70, status: "Pending" }
  ]);
  assert.equal(result.sampleSize, 2);
  assert.equal(result.excludedMissingProbability, 1);
  assert.equal(result.excludedUnsettled, 1);
  assert.equal(result.brierScore, 0.04);
  assert.ok(result.logLoss > 0);
});

test("invalid probabilities are excluded rather than coerced", () => {
  const result = summarizePredictionCalibration([
    { modelProbability: 101, status: "Won" },
    { modelProbability: -1, status: "Lost" },
    { modelProbability: "not-a-number", status: "Won" },
    { modelProbability: null, status: "Lost" }
  ]);
  assert.equal(result.sampleSize, 0);
  assert.equal(result.brierScore, null);
  assert.equal(result.excludedMissingProbability, 4);
});

test("probability boundaries and final bin are handled", () => {
  const result = summarizePredictionCalibration([
    { modelProbability: 0, status: "Lost" },
    { modelProbability: 100, status: "Won" }
  ]);
  assert.equal(result.sampleSize, 2);
  assert.equal(result.reliabilityBins[0].count, 1);
  assert.equal(result.reliabilityBins[9].count, 1);
  assert.equal(result.brierScore, 0);
});

test("non-array input returns an empty, well-defined report", () => {
  const result = summarizePredictionCalibration(null);
  assert.equal(result.sampleSize, 0);
  assert.equal(result.brierScore, null);
  assert.equal(result.logLoss, null);
  assert.equal(result.reliabilityBins.length, 10);
});
