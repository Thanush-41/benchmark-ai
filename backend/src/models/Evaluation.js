const mongoose = require('mongoose');

const questionResultSchema = new mongoose.Schema({
  question: { type: String, required: true },
  expectedAnswer: { type: String, required: true },
  botAnswer: { type: String, required: true },
  score: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  hallucination: { type: Boolean, required: true },
  reason: { type: String, required: true },
  latency: { type: Number, required: true },
  tokens: {
    prompt: Number,
    completion: Number,
    total: Number
  }
}, { _id: false });

const evaluationSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  filename: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  questions: [questionResultSchema],
  sourceMarkdown: String,
  params: {
    temperature: { type: Number, default: 0.8 },
    topK: { type: Number, default: 40 },
    topP: { type: Number, default: 0.95 },
    minP: { type: Number, default: 0.05 },
    repeatPenalty: { type: Number, default: 1.0 },
    presencePenalty: { type: Number, default: 0.0 },
    frequencyPenalty: { type: Number, default: 0.0 }
  },
  status: { type: String, default: 'pending' },
  averageScore: Number,
  averageAccuracy: Number,
  averageLatency: Number,
  hallucinationCount: Number
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
