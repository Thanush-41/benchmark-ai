const assert = require('assert');
const { parseJsonArray } = require('./gemini.service');

const rawResponse = 'Here are the results:\n```json\n[\n  {\n    "question": "What is AI?",\n    "score": 8,\n    "expected_answer": "AI is the simulation of human intelligence in machines.",\n    "hallucination": false,\n    "reason": "Accurate grounding in the source."\n  }\n]\n```\n';

const parsed = parseJsonArray(rawResponse);
assert(Array.isArray(parsed), 'parseJsonArray should return an array');
assert.strictEqual(parsed[0].question, 'What is AI?');
assert.strictEqual(parsed[0].score, 8);
console.log('gemini parser test passed');
