import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteEvaluation, getEvaluations } from '../api';

function Dashboard() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadEvaluations() {
    try {
      const response = await getEvaluations();
      setEvaluations(response.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load evaluations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvaluations();
  }, []);

  async function handleDelete(id) {
    if (!window.confirm('Delete this evaluation?')) {
      return;
    }

    try {
      await deleteEvaluation(id);
      setEvaluations((current) => current.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.message || 'Unable to delete evaluation.');
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Past evaluations</h2>
        </div>
        <Link className="button secondary" to="/upload">Run new evaluation</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {loading ? (
        <p>Loading evaluations…</p>
      ) : evaluations.length === 0 ? (
        <div className="empty-state">
          <h3>No evaluations yet</h3>
          <p>Upload a markdown file to create your first benchmark report.</p>
        </div>
      ) : (
        <div className="card-list">
          {evaluations.map((item) => {
            const score = item.averageAccuracy ?? 0;
            const statusClass = score >= 2.5 ? 'positive' : 'negative';
            return (
              <article className="card" key={item._id}>
                <div className="card-top">
                  <div>
                    <h3>{item.filename}</h3>
                    <p>{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`pill ${statusClass}`}>{score}/5</span>
                </div>

                <div className="metrics-row">
                  <div>
                    <strong>{item.questions?.length ?? 0}</strong>
                    <span>Questions</span>
                  </div>
                  <div>
                    <strong>{item.hallucinationCount ?? 0}</strong>
                    <span>Hallucinations</span>
                  </div>
                  <div>
                    <strong>{item.averageLatency ?? 0}s</strong>
                    <span>Average latency</span>
                  </div>
                </div>

                <div className="card-actions">
                  <Link className="button" to={`/evaluations/${item._id}`}>View details</Link>
                  <button className="button secondary" type="button" onClick={() => handleDelete(item._id)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Dashboard;
