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

  const totalQuestions = evaluations.reduce((sum, item) => sum + (item.questions?.length || 0), 0);
  const averageAccuracy = evaluations.length
    ? Number((evaluations.reduce((sum, item) => sum + (item.averageAccuracy ?? 0), 0) / evaluations.length).toFixed(1))
    : 0;
  const averageLatency = evaluations.length
    ? Number((evaluations.reduce((sum, item) => sum + (item.averageLatency || 0), 0) / evaluations.length).toFixed(1))
    : 0;
  const passRate = Math.round((averageAccuracy / 5) * 100);

  return (
    <section className="panel dashboard-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">KAI Eval</p>
          <h2>Test history</h2>
          <p className="section-copy">All your previous test runs in one place.</p>
        </div>
        <Link className="button" to="/upload">New Test</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="summary-grid">
        <article className="stat-card">
          <p className="stat-label">Accuracy</p>
          <strong>{passRate}%</strong>
          <span>Average across all tests</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Avg response time</p>
          <strong>{averageLatency}s</strong>
          <span>Median first response time</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Test runs</p>
          <strong>{evaluations.length}</strong>
          <span>Total history items</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Questions</p>
          <strong>{totalQuestions}</strong>
          <span>Total questions evaluated</span>
        </article>
      </div>

      {loading ? (
        <p>Loading evaluations…</p>
      ) : evaluations.length === 0 ? (
        <div className="empty-state">
          <h3>No evaluations yet</h3>
          <p>Upload a markdown file to create your first benchmark report.</p>
        </div>
      ) : (
        <div className="history-card">
          <table className="history-table">
            <thead>
              <tr>
                <th>Test name</th>
                <th>Date</th>
                <th>Questions</th>
                <th>Pass rate</th>
                <th>Avg response</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((item) => {
                const runPassRate = Math.round(((item.averageAccuracy ?? 0) / 5) * 100);
                return (
                  <tr key={item._id}>
                    <td>{item.filename}</td>
                    <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td>{item.questions?.length ?? 0}</td>
                    <td>{runPassRate}%</td>
                    <td>{item.averageLatency ?? 0}s</td>
                    <td>
                      <Link className="button small" to={`/evaluations/${item._id}`}>
                        View results
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default Dashboard;
