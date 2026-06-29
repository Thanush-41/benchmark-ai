import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { evaluateMarkdown, uploadMarkdown } from '../api';

function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [markdown, setMarkdown] = useState('');
  const [filename, setFilename] = useState('sample.md');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus('Uploading markdown...');

    try {
      let response;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        response = await uploadMarkdown(formData);
      } else {
        setStatus('Generating questions...');
        response = await evaluateMarkdown({
          filename: filename || 'upload.md',
          markdown,
          questionCount: 5
        });
      }

      setStatus('Evaluating answers...');
      navigate(`/evaluations/${response.data._id}`);
    } catch (err) {
      setStatus(err.message || 'Evaluation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Workflow</p>
          <h2>Upload markdown for benchmarking</h2>
        </div>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>File upload</span>
          <input type="file" accept=".md,.markdown,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>

        <label className="field">
          <span>Filename</span>
          <input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="BITS.md" />
        </label>

        <label className="field">
          <span>Markdown content</span>
          <textarea
            rows={16}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="# Heading\n\nWrite your markdown here..."
          />
        </label>

        <button className="button" type="submit" disabled={loading || (!file && !markdown.trim())}>
          {loading ? 'Working…' : 'Start evaluation'}
        </button>
      </form>

      {status ? <p className="status-pill">{status}</p> : null}
    </section>
  );
}

export default Upload;
