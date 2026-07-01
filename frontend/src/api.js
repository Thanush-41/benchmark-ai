import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

export const uploadMarkdown = (formData) => client.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export const evaluateMarkdown = (payload) => client.post('/evaluate', payload);
export const rejudgeEvaluation = (id) => client.patch(`/evaluations/${id}/rejudge`);
export const getEvaluations = () => client.get('/evaluations');
export const getEvaluationById = (id) => client.get(`/evaluations/${id}`);
export const deleteEvaluation = (id) => client.delete(`/evaluations/${id}`);
export const downloadEvaluation = (id) => client.get(`/download/${id}`, { responseType: 'blob' });
