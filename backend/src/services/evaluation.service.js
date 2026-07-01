const { v4: uuidv4 } = require('uuid');
const Evaluation = require('../models/Evaluation');
const { generateQuestions, judgeAnswers } = require('./gemini.service');
const { queryKai } = require('./kai.service');
const { buildEvaluationSummary } = require('./report.service');

const DEFAULT_MODEL_PARAMS = {
  temperature: 0.8,
  topK: 40,
  topP: 0.95,
  minP: 0.05,
  repeatPenalty: 1.0,
  presencePenalty: 0.0,
  frequencyPenalty: 0.0
};

const inMemoryStore = [];

async function createEvaluationFromMarkdown({ filename, markdown, questionCount = 20, params = {} }) {
  const existingQuestions = await getExistingQuestionTexts(filename);
  const finalParams = { ...DEFAULT_MODEL_PARAMS, ...params };
  const questions = await generateQuestions(markdown, questionCount, existingQuestions);
  const results = [];
  const qaPairs = [];

  for (const question of questions) {
    const { answer, latency } = await queryKai(question, markdown, finalParams);
    qaPairs.push({ question, answer });
    results.push({
      question,
      expectedAnswer: '',
      botAnswer: answer,
      score: 0,
      accuracy: 0,
      rawScore: 0,
      hallucination: false,
      reason: 'Pending evaluation',
      latency,
      tokens: { prompt: 0, completion: 0, total: 0 }
    });
  }

  let record = buildEvaluationSummary({
    _id: uuidv4(),
    filename,
    createdAt: new Date().toISOString(),
    questions: results,
    sourceMarkdown: markdown,
    params: finalParams,
    status: 'pending',
    averageScore: 0,
    averageLatency: 0,
    hallucinationCount: 0
  });

  await persistEvaluation(record);

  try {
    const evaluations = await judgeAnswers(markdown, qaPairs);
    evaluations.forEach((evaluation, index) => {
      const score5 = Number(((evaluation.score ?? 0) / 2).toFixed(1));
      results[index] = {
        ...results[index],
        expectedAnswer: evaluation.expectedAnswer,
        score: score5,
        accuracy: score5,
        rawScore: evaluation.score ?? 0,
        hallucination: evaluation.hallucination,
        reason: evaluation.reason,
        latency: results[index].latency,
        tokens: evaluation.tokens
      };
    });

    record = buildEvaluationSummary({
      ...record,
      questions: results,
      status: 'complete'
    });
    await persistEvaluation(record);
    return record;
  } catch (error) {
    console.warn('Gemini judgment failed, returning partial evaluation.', error.message || error);
    return record;
  }
}

async function getExistingQuestionTexts(filename) {
  if (!filename) {
    return [];
  }

  if (process.env.MONGODB_URI) {
    try {
      const existing = await Evaluation.find({ filename }).sort({ createdAt: -1 }).limit(1);
      if (existing.length && Array.isArray(existing[0].questions)) {
        return existing[0].questions
          .map((item) => item.question)
          .filter(Boolean);
      }
    } catch (error) {
      console.warn('MongoDB lookup for existing questions failed.', error.message);
    }
  }

  const inMemoryRecord = inMemoryStore
    .slice()
    .reverse()
    .find((item) => item.filename === filename);
  return inMemoryRecord ? inMemoryRecord.questions.map((item) => item.question).filter(Boolean) : [];
}

async function persistEvaluation(record) {
  if (process.env.MONGODB_URI) {
    try {
      await Evaluation.findOneAndUpdate(
        { _id: record._id },
        { $set: record },
        { upsert: true, new: true }
      );
      return;
    } catch (error) {
      console.warn('MongoDB persistence failed, using in-memory storage instead.', error.message);
    }
  }

  inMemoryStore.push(record);
}

async function listEvaluations() {
  if (process.env.MONGODB_URI) {
    try {
      return await Evaluation.find({}).sort({ createdAt: -1 });
    } catch (error) {
      console.warn('MongoDB read failed, falling back to in-memory data.', error.message);
    }
  }

  return [...inMemoryStore].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getEvaluationById(id) {
  if (process.env.MONGODB_URI) {
    try {
      return await Evaluation.findById(id);
    } catch (error) {
      console.warn('MongoDB lookup failed.', error.message);
    }
  }

  return inMemoryStore.find((item) => item._id === id) || null;
}

async function resumeEvaluation(id) {
  const record = await getEvaluationById(id);
  if (!record) {
    throw new Error('Evaluation not found.');
  }

  const markdown = record.sourceMarkdown || '';
  if (!markdown) {
    console.warn('Resuming evaluation without saved markdown; using empty source context.');
  }

  const qaPairs = (record.questions || []).map((entry) => ({
    question: entry.question,
    answer: entry.botAnswer
  }));

  const evaluations = await judgeAnswers(markdown, qaPairs);
  const results = (record.questions || []).map((entry, index) => {
    const evaluation = evaluations[index] || {};
    const score5 = Number(((evaluation.score ?? 0) / 2).toFixed(1));
    return {
      ...entry,
      expectedAnswer: evaluation.expectedAnswer ?? entry.expectedAnswer,
      score: score5,
      accuracy: score5,
      rawScore: evaluation.score ?? entry.rawScore,
      hallucination: evaluation.hallucination ?? entry.hallucination,
      reason: evaluation.reason ?? entry.reason,
      tokens: evaluation.tokens ?? entry.tokens
    };
  });

  const updatedRecord = buildEvaluationSummary({
    ...record,
    questions: results,
    status: 'complete'
  });

  await persistEvaluation(updatedRecord);
  return updatedRecord;
}

async function deleteEvaluation(id) {
  if (process.env.MONGODB_URI) {
    try {
      await Evaluation.findByIdAndDelete(id);
      return true;
    } catch (error) {
      console.warn('MongoDB delete failed.', error.message);
    }
  }

  const index = inMemoryStore.findIndex((item) => item._id === id);
  if (index >= 0) {
    inMemoryStore.splice(index, 1);
    return true;
  }
  return false;
}

module.exports = {
  createEvaluationFromMarkdown,
  listEvaluations,
  getEvaluationById,
  resumeEvaluation,
  deleteEvaluation
};
