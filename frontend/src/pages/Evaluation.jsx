import React, { useEffect, useState } from 'react';
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
    <section className="panel evaluation-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Evaluation</p>
          <h2>{evaluation.filename}</h2>
          <p className="section-copy">View the same dashboard-style summary and results for this run.</p>
        </div>
        <div className="button-group">
          <button className="button secondary" type="button" onClick={handleExport}>Export report</button>
        </div>
      </div>

      <div className="summary-grid evaluation-summary">
        <article className="stat-card">
          <p className="stat-label">Avg accuracy</p>
          <strong>{averageAccuracy}/5</strong>
          <span>{Math.round((averageAccuracy / 5) * 100)}% pass rate</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Questions</p>
          <strong>{evaluation.questions?.length ?? 0}</strong>
          <span>Total questions evaluated</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Avg latency</p>
          <strong>{evaluation.averageLatency ?? 0}s</strong>
          <span>Average per question</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Hallucinations</p>
          <strong>{evaluation.hallucinationCount ?? 0}</strong>
          <span>Potential issues found</span>
        </article>
      </div>

      <div className="history-card">
        <table className="evaluation-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Accuracy</th>
              <th>Latency</th>
              <th>Hallucination</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {evaluation.questions?.map((entry, index) => {
              const entryAccuracy = getEntryAccuracy(entry);
              const entryStatus = entryAccuracy >= 2.5 ? 'positive' : 'negative';

              return (
                <React.Fragment key={`group-${index}`}>
                  <tr key={`row-${index}`} className="expandable-row" onClick={() => toggleQuestion(index)}>
                    <td>{index + 1}</td>
                    <td>{entry.question}</td>
                    <td>
                      <span className={`pill ${entryStatus}`}>{entryAccuracy}/5</span>
                    </td>
                    <td>{entry.latency}s</td>
                    <td>{entry.hallucination ? 'Yes' : 'No'}</td>
                    <td><span className="detail-toggle">View</span></td>
                  </tr>
                  {expandedQuestion === index ? (
                    <tr key={`detail-${index}`} className="detail-row">
                      <td colSpan="6">
                        <div className="detail-panel">
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
                            <p><strong>Reason:</strong> {entry.reason}</p>
                            <p><strong>Tokens:</strong> prompt {entry.tokens?.prompt || 0}, completion {entry.tokens?.completion || 0}, total {entry.tokens?.total || 0}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Evaluation;
