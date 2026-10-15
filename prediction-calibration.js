const MAX_PROBABILITY = 100;
const DEFAULT_BINS = 10;

function probabilityOf(row) {
  const value = row?.calibratedProbability ?? row?.modelProbability ?? row?.derivedModel?.modelProbability;
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PROBABILITY) return null;
  return n / MAX_PROBABILITY;
}

function outcomeOf(row) {
  const value = String(row?.status ?? row?.resultStatus ?? row?.outcome ?? "").trim().toLowerCase();
  if (["won", "win", "correct"].includes(value)) return 1;
  if (["lost", "loss", "incorrect"].includes(value)) return 0;
  return null;
}

/**
 * Evaluate explicitly stored model probabilities against settled outcomes.
 * Confidence grades and bookmaker odds are intentionally not treated as model probabilities.
 */
export function summarizePredictionCalibration(rows = [], binCount = DEFAULT_BINS) {
  const count = Math.max(2, Math.min(20, Math.trunc(Number(binCount) || DEFAULT_BINS)));
  const bins = Array.from({ length: count }, (_, index) => ({
    lower: index / count,
    upper: (index + 1) / count,
    predictions: 0,
    predictedProbabilitySum: 0,
    wins: 0
  }));
  let brierSum = 0;
  let logLossSum = 0;
  let settledWithProbability = 0;
  let excludedUnsettled = 0;
  let excludedMissingProbability = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const probability = probabilityOf(row);
    const outcome = outcomeOf(row);
    if (outcome === null) {
      excludedUnsettled++;
      continue;
    }
    if (probability === null) {
      excludedMissingProbability++;
      continue;
    }
    settledWithProbability++;
    brierSum += (probability - outcome) ** 2;
    const safeP = Math.max(1e-6, Math.min(1 - 1e-6, probability));
    logLossSum += -(outcome * Math.log(safeP) + (1 - outcome) * Math.log(1 - safeP));
    const index = Math.min(count - 1, Math.floor(probability * count));
    bins[index].predictions++;
    bins[index].predictedProbabilitySum += probability;
    bins[index].wins += outcome;
  }

  const reliabilityBins = bins.map(bin => ({
    lowerProbability: Math.round(bin.lower * 100),
    upperProbability: Math.round(bin.upper * 100),
    count: bin.predictions,
    meanPredictedProbability: bin.predictions ? +(100 * bin.predictedProbabilitySum / bin.predictions).toFixed(2) : null,
    observedWinRate: bin.predictions ? +(100 * bin.wins / bin.predictions).toFixed(2) : null
  }));

  return {
    metricDefinition: "Uses stored calibratedProbability, modelProbability, or derivedModel.modelProbability only; confidence scores and odds are excluded.",
    sampleSize: settledWithProbability,
    brierScore: settledWithProbability ? +(brierSum / settledWithProbability).toFixed(5) : null,
    logLoss: settledWithProbability ? +(logLossSum / settledWithProbability).toFixed(5) : null,
    excludedUnsettled,
    excludedMissingProbability,
    reliabilityBins
  };
}
