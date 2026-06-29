const assert = require('assert');
const { isGeminiQuotaError, shouldUseGeminiNow, markGeminiQuotaExceeded, judgeAnswers } = require('./gemini.service');

const quotaError = {
  message: 'RESOURCE_EXHAUSTED',
  response: {
    status: 429,
    data: { error: { message: 'quota exceeded' } }
  }
};

assert.strictEqual(isGeminiQuotaError(quotaError), true);
assert.strictEqual(shouldUseGeminiNow(), true);
markGeminiQuotaExceeded();
assert.strictEqual(shouldUseGeminiNow(), false);

judgeAnswers('AI is intelligence', [{ question: 'What is AI?', answer: 'AI is the simulation of human intelligence in machines.' }])
  .then((results) => {
    assert(Array.isArray(results));
    assert.strictEqual(results.length, 1);
    assert.strictEqual(typeof results[0].score, 'number');
    assert.strictEqual(typeof results[0].expectedAnswer, 'string');
    console.log('gemini service test passed');
  })
  .catch((error) => {
    console.error('gemini service test failed', error);
    process.exit(1);
  });
