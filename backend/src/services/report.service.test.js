const assert = require('assert');
const { buildEvaluationSummary } = require('./report.service');

const sample = {
  _id: 'demo',
  filename: 'demo.md',
  createdAt: '2026-06-29T00:00:00.000Z',
  questions: [
    { score: 8, hallucination: false, latency: 1.2 },
    { score: 10, hallucination: true, latency: 2.3 }
  ]
};

const result = buildEvaluationSummary(sample);
assert.strictEqual(result.averageScore, 9);
assert.strictEqual(result.averageLatency, 1.75);
assert.strictEqual(result.hallucinationCount, 1);
console.log('report service test passed');
