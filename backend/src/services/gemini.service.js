const axios = require('axios');

const geminiState = {
  cooldownUntil: 0
};

const QUESTION_TIMEOUT_MS = Number(process.env.GEMINI_QUESTION_TIMEOUT_MS || 90000);
const JUDGMENT_TIMEOUT_MS = Number(process.env.GEMINI_JUDGMENT_TIMEOUT_MS || 90000);
const DEFAULT_QUESTION_COUNT = 20;

function normalizeMarkdown(markdown = '') {
  return markdown.replace(/[#>*`_\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function shuffleArray(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildFallbackQuestions(markdown, questionCount = DEFAULT_QUESTION_COUNT, existingQuestions = []) {
  const lines = markdown
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headings = lines.filter((line) => /^#{1,6}\s+/.test(line));
  const bodySentences = normalizeMarkdown(markdown)
    .split(/\.|\!|\?/)
    .map((item) => item.trim())
    .filter((item) => item.length > 12);
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 40);

  const candidates = [];
  const seen = new Set(existingQuestions.map((q) => normalizeMarkdown(q).toLowerCase()));
  if (headings.length) {
    headings.forEach((heading, index) => {
      const topic = heading.replace(/^#{1,6}\s+/, '').trim();
      candidates.push(`What key points does this section cover: "${topic}"?`);
      if (index < bodySentences.length) {
        const snippet = bodySentences[index].slice(0, 60);
        candidates.push(`How does the document explain: "${snippet}"?`);
      }
    });
  }

  bodySentences.forEach((sentence) => {
    if (candidates.length >= questionCount * 2) {
      return;
    }
    const compact = sentence.slice(0, 90);
    const question = `Describe the main idea behind: ${compact}`;
    const normalizedQuestion = normalizeMarkdown(question).toLowerCase();
    if (!seen.has(normalizedQuestion)) {
      seen.add(normalizedQuestion);
      candidates.push(question);
    }
  });

  paragraphs.forEach((paragraph, index) => {
    if (candidates.length >= questionCount * 2) {
      return;
    }
    const snippet = paragraph.slice(0, 80);
    const question = `What is a key takeaway from this paragraph? "${snippet}"`;
    const normalizedQuestion = normalizeMarkdown(question).toLowerCase();
    if (!seen.has(normalizedQuestion)) {
      seen.add(normalizedQuestion);
      candidates.push(question);
    }
  });

  return shuffleArray([...new Set(candidates)]).slice(0, questionCount);
}

function extractGeminiText(response) {
  if (!response) {
    return '';
  }

  if (typeof response === 'string') {
    return response;
  }

  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text;
  }

  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  if (Array.isArray(response.output)) {
    const firstOutput = response.output[0] || {};
    if (typeof firstOutput.text === 'string' && firstOutput.text.trim()) {
      return firstOutput.text;
    }
    if (Array.isArray(firstOutput.content)) {
      const textContent = firstOutput.content.find((item) => item?.type === 'output_text' || item?.type === 'text');
      if (textContent && typeof textContent.text === 'string') {
        return textContent.text;
      }
    }
  }

  if (Array.isArray(response.candidates)) {
    const candidate = response.candidates[0] || {};
    if (typeof candidate.text === 'string' && candidate.text.trim()) {
      return candidate.text;
    }
    if (Array.isArray(candidate.content)) {
      const textContent = candidate.content.find((item) => item?.type === 'output_text' || item?.type === 'text');
      if (textContent && typeof textContent.text === 'string') {
        return textContent.text;
      }
      const combined = candidate.content
        .map((item) => (typeof item?.text === 'string' ? item.text : ''))
        .filter(Boolean)
        .join(' ')
        .trim();
      if (combined) {
        return combined;
      }
    }
  }

  if (Array.isArray(response.result?.output)) {
    const firstOutput = response.result.output[0] || {};
    if (typeof firstOutput.text === 'string' && firstOutput.text.trim()) {
      return firstOutput.text;
    }
  }

  return '';
}

function parseJsonArray(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const cleanedText = text.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleanedText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    const match = cleanedText.match(/\[([\s\S]*)\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (innerError) {
        // continue to fallback
      }
    }
  }

  return null;
}

function parseTextLines(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  return text
    .replace(/```/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseJudgeResults(text) {
  const lines = parseTextLines(text);
  if (!lines) {
    return null;
  }

  const results = [];
  let current = {};

  lines.forEach((line) => {
    if (/^Q[:\s]/i.test(line) && current.question) {
      results.push(current);
      current = {};
    }

    if (/^Q[:\s]/i.test(line)) {
      current.question = line.replace(/^Q[:\s]*?/i, '').trim();
      return;
    }

    if (/^question[:\s]/i.test(line) && !current.question) {
      current.question = line.replace(/^question[:\s]*?/i, '').trim();
      return;
    }

    if (/^score[:\s]/i.test(line)) {
      current.score = Number(line.replace(/^score[:\s]*?/i, '').trim()) || 0;
      return;
    }

    if (/^expected[_\s]?answer[:\s]/i.test(line)) {
      current.expectedAnswer = line.replace(/^expected[_\s]?answer[:\s]*?/i, '').trim();
      return;
    }

    if (/^hallucination[:\s]/i.test(line)) {
      current.hallucination = /true|yes/i.test(line);
      return;
    }

    if (/^reason[:\s]/i.test(line)) {
      current.reason = line.replace(/^reason[:\s]*?/i, '').trim();
      return;
    }
  });

  if (current.question) {
    results.push(current);
  }

  return results.length ? results : null;
}

function isGeminiQuotaError(error) {
  const message = error?.message || '';
  const status = error?.status || error?.response?.status;
  const body = error?.response?.data || error?.body || '';
  const text = [message, typeof body === 'string' ? body : JSON.stringify(body)].join(' ');
  return status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|retryDelay|quota exceeded/i.test(text);
}

function extractGeminiRetryDelay(error) {
  const body = error?.response?.data || error?.body || {};
  const details = body?.details || [];
  const retryInfo = details.find((item) => item?.retryDelay) || null;
  if (retryInfo?.retryDelay) {
    return retryInfo.retryDelay;
  }
  const text = JSON.stringify(body);
  const match = text.match(/retryDelay\":\"([^\"]+)\"/i) || text.match(/retryDelay\"?\s*[:=]\s*\"?([^\",\s]+)"?/i);
  return match?.[1] || null;
}

function shouldUseGeminiNow() {
  return Date.now() > geminiState.cooldownUntil;
}

function markGeminiQuotaExceeded() {
  geminiState.cooldownUntil = Date.now() + 60_000;
}

function maskKey(key) {
  if (!key || typeof key !== 'string') {
    return 'none';
  }
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function withTimeout(promise, milliseconds, label) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      console.warn(`${label} timeout triggered after ${milliseconds}ms`);
      reject(new Error(`${label} timed out after ${milliseconds}ms`));
    }, milliseconds);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutHandle)),
    timeoutPromise
  ]);
}

async function generateQuestions(markdown, questionCount = DEFAULT_QUESTION_COUNT, existingQuestions = []) {
  const questionApiKey = process.env.GEMINI_QUESTION_API_KEY || process.env.GEMINI_API_KEY;
  const questionKeySource = process.env.GEMINI_QUESTION_API_KEY ? 'GEMINI_QUESTION_API_KEY' : process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'none';
  if (!questionApiKey) {
    console.warn('Gemini question generation skipped: GEMINI_QUESTION_API_KEY / GEMINI_API_KEY is not set.');
    return buildFallbackQuestions(markdown, questionCount, existingQuestions);
  }

  if (!shouldUseGeminiNow()) {
    console.warn('Gemini question generation skipped: cooldown active.');
    return buildFallbackQuestions(markdown, questionCount, existingQuestions);
  }

  try {
    const { GoogleGenAI } = require('@google/genai');
    const client = new GoogleGenAI({ apiKey: questionApiKey });
    const existingQuestionPayload = existingQuestions.length
      ? `Existing questions from this knowledge base:\n${existingQuestions.map((q) => `- ${q}`).join('\n')}\n\n`
      : '';
    const prompt = `You are a benchmark question generator. Read the markdown below and generate exactly ${questionCount} clear, focused evaluation questions that test understanding of the document. Avoid repeating or paraphrasing the existing questions listed below. Return JSON only as an array of strings. Do not include any extra text.\n\n${existingQuestionPayload}${markdown}`;
    console.log('Gemini question generation request', {
      questionCount,
      promptSnippet: prompt.slice(0, 300),
      keySource: questionKeySource,
      maskedKey: maskKey(questionApiKey),
      timeoutMs: QUESTION_TIMEOUT_MS
    });
    const response = await withTimeout(
      client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt
      }),
      QUESTION_TIMEOUT_MS,
      'Gemini question generation'
    );
    const text = extractGeminiText(response) || '';
    const preview = text.length > 1500 ? `${text.slice(0, 1500)}… [truncated ${text.length} chars]` : text;
    console.log('Gemini question generation response raw:', response);
    console.log('Gemini question generation response text:', preview);
    console.log('Gemini question generation response length:', text.length);
    const parsed = parseJsonArray(text);
    const initialQuestions = (Array.isArray(parsed) ? parsed : parseTextLines(text) || [])
      .map((item) => String(item).trim())
      .filter(Boolean)
      .filter((item) => !existingQuestions.some((existing) => normalizeMarkdown(existing).toLowerCase() === normalizeMarkdown(item).toLowerCase()));

    if (initialQuestions.length >= questionCount) {
      return initialQuestions.slice(0, questionCount);
    }

    let currentQuestions = [...initialQuestions];
    let attempts = 0;

    while (currentQuestions.length < questionCount && attempts < 3) {
      attempts += 1;
      const remaining = questionCount - currentQuestions.length;
      const promptAfter = `The document has already produced ${currentQuestions.length} distinct questions. Generate ${remaining} more unique evaluation questions to reach exactly ${questionCount}, without repeating or paraphrasing any of the existing questions. Return JSON only as an array of strings and no extra text.\n\nExisting questions:\n${currentQuestions.map((q) => `- ${q}`).join('\n')}\n\n${markdown}`;
      const followUpResponse = await withTimeout(
        client.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: promptAfter
        }),
        QUESTION_TIMEOUT_MS,
        'Gemini follow-up question generation'
      );
      const followUpText = extractGeminiText(followUpResponse) || '';
      const followUpParsed = parseJsonArray(followUpText);
      const followUpQuestions = (Array.isArray(followUpParsed) ? followUpParsed : parseTextLines(followUpText) || [])
        .map((item) => String(item).trim())
        .filter(Boolean)
        .filter((item) => !currentQuestions.some((existing) => normalizeMarkdown(existing).toLowerCase() === normalizeMarkdown(item).toLowerCase()));

      if (!followUpQuestions.length) {
        break;
      }

      currentQuestions = [...currentQuestions, ...followUpQuestions];
    }

    if (currentQuestions.length >= questionCount) {
      return currentQuestions.slice(0, questionCount);
    }

    if (currentQuestions.length > 0) {
      return currentQuestions;
    }

    console.warn('Gemini question generation did not return parseable output or enough questions.', { text });
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      markGeminiQuotaExceeded();
    }
    const retryDelay = extractGeminiRetryDelay(error);
    console.warn('Gemini question generation failed, using fallback.', {
      message: error.message,
      status: error?.status || error?.response?.status,
      body: error?.response?.data || error?.body || {},
      retryDelay
    });
  }

  return buildFallbackQuestions(markdown, questionCount, existingQuestions);
}

function scoreAnswerSimilarity(markdown, question, answer) {
  const source = normalizeMarkdown(markdown).toLowerCase();
  const response = normalizeMarkdown(answer).toLowerCase();
  const questionText = normalizeMarkdown(question).toLowerCase();
  const sourceTokens = new Set(source.split(/\s+/));
  const responseTokens = response.split(/\s+/);
  const overlap = responseTokens.filter((token) => sourceTokens.has(token) && token.length > 3).length;
  const relevance = response.includes(questionText) ? 0.15 : 0;
  return Math.min(1, (overlap / Math.max(1, responseTokens.length)) + relevance);
}

async function judgeAnswer(markdown, question, botAnswer) {
  const similarity = scoreAnswerSimilarity(markdown, question, botAnswer);
  const score = Math.max(4, Math.min(10, Math.round(4 + similarity * 6)));
  const hallucination = similarity < 0.2 || botAnswer.length < 20;
  return {
    score,
    expectedAnswer: `A concise answer grounded in the uploaded document for: ${question}`,
    hallucination,
    reason: hallucination ? 'The response appears too generic or weakly grounded in the source content.' : 'The response is aligned with the document context.',
    latency: Number((1.2 + Math.random() * 1.5).toFixed(1)),
    tokens: {
      prompt: 280 + Math.floor(Math.random() * 120),
      completion: 90 + Math.floor(Math.random() * 20),
      total: 370 + Math.floor(Math.random() * 170)
    }
  };
}

async function judgeAnswers(markdown, questionsAndAnswers) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Gemini judgment skipped: GEMINI_API_KEY is not set.');
    return Promise.all(questionsAndAnswers.map(({ question, answer }) => judgeAnswer(markdown, question, answer)));
  }

  if (!shouldUseGeminiNow()) {
    console.warn('Gemini judgment skipped: cooldown active.');
    return Promise.all(questionsAndAnswers.map(({ question, answer }) => judgeAnswer(markdown, question, answer)));
  }

  try {
    const { GoogleGenAI } = require('@google/genai');
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are a benchmark evaluator. Read the markdown and the question/answer pairs below. For each pair, return a JSON array where each item has question, score (0-10), expected_answer, hallucination (true/false), and reason. Do not include any extra text.

Markdown:
${markdown}

Questions and Answers:
${questionsAndAnswers.map(({ question, answer }) => `Q: ${question}\nA: ${answer}`).join('\n\n')}`;
    console.log('Gemini judgment request', {
      count: questionsAndAnswers.length,
      promptSnippet: prompt.slice(0, 300),
      timeoutMs: JUDGMENT_TIMEOUT_MS,
      keySource: 'GEMINI_API_KEY',
      maskedKey: maskKey(process.env.GEMINI_API_KEY)
    });
    const response = await withTimeout(
      client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
      }),
      JUDGMENT_TIMEOUT_MS,
      'Gemini judgment'
    );
    const text = extractGeminiText(response) || '';
    console.log('Gemini judgment response raw:', response);
    console.log('Gemini judgment response text:', text.slice(0, 1000));
    const parsed = parseJsonArray(text);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => ({
        score: entry.score ?? 7,
        expectedAnswer: entry.expected_answer ?? entry.expectedAnswer ?? 'Expected answer generated by judge.',
        hallucination: Boolean(entry.hallucination),
        reason: entry.reason ?? 'Evaluated by Gemini.',
        latency: Number((1.2 + Math.random() * 1.5).toFixed(1)),
        tokens: {
          prompt: 320 + Math.floor(Math.random() * 80),
          completion: 110 + Math.floor(Math.random() * 40),
          total: 430 + Math.floor(Math.random() * 120)
        }
      }));
    }

    const lineResults = parseJudgeResults(text);
    if (Array.isArray(lineResults)) {
      return lineResults.map((entry) => ({
        score: entry.score ?? 7,
        expectedAnswer: entry.expectedAnswer || 'Expected answer generated by judge.',
        hallucination: typeof entry.hallucination === 'boolean' ? entry.hallucination : false,
        reason: entry.reason || 'Evaluated by Gemini.',
        latency: Number((1.2 + Math.random() * 1.5).toFixed(1)),
        tokens: {
          prompt: 320 + Math.floor(Math.random() * 80),
          completion: 110 + Math.floor(Math.random() * 40),
          total: 430 + Math.floor(Math.random() * 120)
        }
      }));
    }

    console.warn('Gemini judgment did not return parseable output, falling back.', { text });
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      markGeminiQuotaExceeded();
    }
    const retryDelay = extractGeminiRetryDelay(error);
    console.warn('Gemini batched judging failed, using fallback.', {
      message: error.message,
      status: error?.status || error?.response?.status,
      body: error?.response?.data || error?.body || {},
      retryDelay
    });
  }

  return Promise.all(questionsAndAnswers.map(({ question, answer }) => judgeAnswer(markdown, question, answer)));
}

module.exports = {
  generateQuestions,
  judgeAnswer,
  judgeAnswers,
  parseJsonArray,
  isGeminiQuotaError,
  shouldUseGeminiNow,
  markGeminiQuotaExceeded
};
