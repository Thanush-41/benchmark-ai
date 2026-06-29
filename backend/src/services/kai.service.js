const axios = require('axios');

function extractKaiAnswer(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return payload.answer || payload.response || payload.message || payload.text || payload.content || 'No answer returned.';
  }

  return 'No answer returned.';
}

async function queryKai(question, markdown) {
  if (process.env.KAI_URL) {
    try {
      const response = await axios.post(process.env.KAI_URL, {
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
        timeout: 20000
      });

      return extractKaiAnswer(response?.data);
    } catch (error) {
      const detail = error.response?.data;
      const bodyText = typeof detail === 'string' ? detail : JSON.stringify(detail || {});
      console.warn('KAI request failed, using fallback answer.', {
        status: error.response?.status,
        body: bodyText,
        headers: error.response?.headers,
        config: error.config
      });
    }
  }

  return `A benchmark answer for: ${question}`;
}

module.exports = {
  queryKai
};
