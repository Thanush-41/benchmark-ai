const assert = require('assert');
const { buildEvaluationWorkbook } = require('./evaluation.controller');

(async () => {
  const sampleEvaluation = {
    filename: 'test-report.md',
    questions: [
      { question: 'What is AI?', accuracy: 4.5, latency: 1.1, hallucination: false, reason: 'Good answer.' },
      { question: 'What is ML?', accuracy: 3.0, latency: 1.3, hallucination: true, reason: 'Missing details.' }
    ]
  };

  const buffer = await buildEvaluationWorkbook(sampleEvaluation);
  assert(buffer instanceof Uint8Array || Buffer.isBuffer(buffer), 'Expected Excel export buffer');
  assert(buffer.length > 100, 'Expected non-empty workbook content');

  // Basic xlsx header check: PK prefix at start of file
  const header = buffer.slice(0, 2).toString('utf8');
  assert.strictEqual(header, 'PK', 'Expected Excel XLSX file header');

  console.log('evaluation controller export test passed');
})();
