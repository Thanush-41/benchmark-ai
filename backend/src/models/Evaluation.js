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
  averageScore: Number,
  averageAccuracy: Number,
  averageLatency: Number,
  hallucinationCount: Number
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
