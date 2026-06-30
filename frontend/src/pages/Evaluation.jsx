import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { downloadEvaluation, getEvaluationById } from '../api';

function Evaluation() {
  const { id } = useParams();
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  useEffect(() => {
    async function loadEvaluation() {
      try {
        const response = await getEvaluationById(id);
        setEvaluation(response.data);
      } catch (err) {
        setError(err.message || 'Unable to load evaluation.');
      } finally {
        setLoading(false);
      }
    }

    loadEvaluation();
  }, [id]);

  async function handleExport() {
    try {
      const response = await downloadEvaluation(id);
      const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';

      if (contentType.includes('application/json')) {
        const text = await response.data.text?.() || new TextDecoder().decode(await response.data);
        const payload = JSON.parse(text || '{}');
        throw new Error(payload.error || payload.message || 'Unable to export evaluation.');
      }

      const url = window.URL.createObjectURL(new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${evaluation?.filename || 'evaluation'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Unable to export evaluation.');
    }
  }

  if (loading) {
    return <p>Loading evaluation…</p>;
  }

  if (error || !evaluation) {
    return <p className="error">{error || 'Evaluation not found.'}</p>;
  }

  const getEntryAccuracy = (entry) => Number(((entry.accuracy ?? ((entry.score ?? 0) / 2)) || 0).toFixed(1));

  const averageAccuracy = evaluation.averageAccuracy ?? Number(
    ((evaluation.questions?.reduce((sum, entry) => sum + getEntryAccuracy(entry), 0) / (evaluation.questions?.length || 1))).toFixed(1)
  );

  const toggleQuestion = (index) => {
    setExpandedQuestion((current) => (current === index ? null : index));
  };

  const accuracyStatus = averageAccuracy >= 2.5 ? 'positive' : 'negative';

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Report</p>
          <h2>{evaluation.filename}</h2>
        </div>
        <div className="pill-row">
          <span className={`pill ${accuracyStatus}`}>Avg accuracy {averageAccuracy}/5</span>
          <span className="pill">{evaluation.hallucinationCount ?? 0} hallucinations</span>
          <button className="button secondary" type="button" onClick={handleExport}>Export Excel</button>
        </div>
      </div>

      <div className="metrics-row">
        <div>
          <strong>{evaluation.questions?.length ?? 0}</strong>
          <span>Questions</span>
        </div>
        <div>
          <strong>{evaluation.averageLatency ?? 0}s</strong>
          <span>Average latency</span>
        </div>
        <div>
          <strong>{averageAccuracy ?? 0}/5</strong>
          <span>Accuracy</span>
        </div>
        <div>
          <strong>{evaluation.questions?.reduce((sum, entry) => sum + (entry.tokens?.total || 0), 0) ?? 0}</strong>
          <span>Total tokens</span>
        </div>
      </div>

      <div className="question-list">
        {evaluation.questions?.map((entry, index) => {
          const entryAccuracy = getEntryAccuracy(entry);
          const entryStatus = entryAccuracy >= 2.5 ? 'positive' : 'negative';

          return (
            <article className="card question-card" key={`${entry.question}-${index}`}>
              <button type="button" className="question-summary" onClick={() => toggleQuestion(index)}>
                <span className="summary-cell id-cell">#{index + 1}</span>
                <span className="summary-cell question-cell">{entry.question}</span>
                <span className={`summary-cell accuracy-cell ${entryStatus}`}>{entryAccuracy}/5</span>
                <span className="summary-cell latency-cell">{entry.latency}s</span>
              </button>

              {expandedQuestion === index ? (
                <div className="expand-panel">
                  <div className="answer-grid">
                    <div>
                      <h4>Bot answer</h4>
                      <ReactMarkdown>{entry.botAnswer}</ReactMarkdown>
                    </div>
                    <div>
                      <h4>Expected answer</h4>
                      <ReactMarkdown>{entry.expectedAnswer}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="detail-list">
                    <p><strong>Accuracy:</strong> {getEntryAccuracy(entry)}/5</p>
                    <p><strong>Hallucination:</strong> {entry.hallucination ? 'Yes' : 'No'}</p>
                    <p><strong>Reason:</strong> {entry.reason}</p>
                    <p><strong>Tokens:</strong> prompt {entry.tokens?.prompt || 0}, completion {entry.tokens?.completion || 0}, total {entry.tokens?.total || 0}</p>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Evaluation;
