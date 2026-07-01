const axios = require('axios');

function parseKaiStream(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const chunks = text
    .split(/\r?\n(?=data:\s*)/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const extractResponse = (payload) => {
    try {
      const event = JSON.parse(payload);
      return typeof event.response === 'string'
        ? event.response
        : typeof event.message === 'string'
          ? event.message
          : null;
    } catch {
      const match = payload.match(/"response"\s*:\s*("(?:\\.|[^"\\])*")/s)
        || payload.match(/"message"\s*:\s*("(?:\\.|[^"\\])*")/s);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1]);
        } catch {
          return match[1].slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
      return null;
    }
  };

  let answer = '';
  let foundResponse = false;

  chunks.forEach((chunk) => {
    const payload = chunk.replace(/^data:\s*/i, '').trim();
    if (!payload || payload === '[DONE]') {
      return;
    }

    const responseText = extractResponse(payload);
    if (!responseText) {
      return;
    }

    const trimmedResponse = responseText.trim();
    if (!trimmedResponse || /^(stream_complete|chat_saved|function_call)$/i.test(trimmedResponse)) {
      return;
    }

    if (answer && !/[\s\n]$/.test(answer) && !/^\s/.test(responseText)) {
      answer += ' ';
    }
    answer += responseText;
    foundResponse = true;
  });

  return foundResponse ? answer.trim() : null;
}

function extractKaiAnswer(payload) {
  if (typeof payload === 'string') {
    const parsedStream = parseKaiStream(payload);
    if (parsedStream) {
      return parsedStream;
    }
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return payload.answer || payload.response || payload.message || payload.text || payload.content || 'No answer returned.';
  }

  return 'No answer returned.';
}

async function queryKai(question, markdown) {
  const kaiUrl = process.env.KAI_URL || 'http://localhost:8080/chat';
  const startTime = Date.now();

  try {
    const response = await axios.post(kaiUrl, {
      query: question
    }, {
      params: {
        stream: 'true'
      },
      headers: {
        'Content-Type': 'application/json',
        'KAI-API-KEY': process.env.KAI_API_KEY || '',
        'AGENT-ID': process.env.AGENT_ID || ''
      },
      responseType: 'text',
      timeout: 20000
    });

    return {
      answer: extractKaiAnswer(response?.data),
      latency: Number(((Date.now() - startTime) / 1000).toFixed(2))
    };
  } catch (error) {
    const detail = error.response?.data;
    const bodyText = typeof detail === 'string' ? detail : JSON.stringify(detail || {});
    console.warn('KAI request failed, using fallback answer.', {
      kaiUrl,
      status: error.response?.status,
      body: bodyText,
      headers: error.response?.headers,
      config: error.config
    });

    return {
      answer: `A benchmark answer for: ${question}`,
      latency: Number(((Date.now() - startTime) / 1000).toFixed(2))
    };
  }
}

module.exports = {
  queryKai,
  parseKaiStream
};
