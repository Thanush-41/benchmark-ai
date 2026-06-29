function buildEvaluationSummary(record) {
  const totalQuestions = record.questions.length;
  const averageScore = totalQuestions
    ? Number((record.questions.reduce((sum, item) => sum + item.score, 0) / totalQuestions).toFixed(1))
    : 0;
  const averageAccuracy = totalQuestions
    ? Number((record.questions.reduce((sum, item) => sum + (item.accuracy ?? (item.score / 2)), 0) / totalQuestions).toFixed(1))
    : 0;
  const averageLatency = totalQuestions
    ? Number((record.questions.reduce((sum, item) => sum + (item.latency || 0), 0) / totalQuestions).toFixed(2))
    : 0;
  const hallucinationCount = record.questions.filter((item) => item.hallucination).length;

  return {
    ...record,
    averageScore,
    averageAccuracy,
    averageLatency,
    hallucinationCount
  };
}

module.exports = {
  buildEvaluationSummary
};
