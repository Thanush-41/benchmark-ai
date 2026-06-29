const ExcelJS = require('exceljs');
const { createEvaluationFromMarkdown, listEvaluations, getEvaluationById, deleteEvaluation } = require('../services/evaluation.service');

async function uploadMarkdown(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a markdown file.' });
    }

    const filename = req.file.originalname || 'upload.md';
    const markdown = req.file.buffer.toString('utf8');
    const evaluation = await createEvaluationFromMarkdown({ filename, markdown, questionCount: 5 });

    return res.status(201).json(evaluation);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Failed to evaluate markdown.' });
  }
}

async function evaluateMarkdown(req, res) {
  try {
    const { filename, markdown, questionCount = 5 } = req.body;
    if (!filename || !markdown) {
      return res.status(400).json({ error: 'filename and markdown are required.' });
    }

    const evaluation = await createEvaluationFromMarkdown({ filename, markdown, questionCount });
    return res.status(201).json(evaluation);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Failed to evaluate markdown.' });
  }
}

async function list(req, res) {
  try {
    const evaluations = await listEvaluations();
    return res.json(evaluations);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch evaluations.' });
  }
}

async function show(req, res) {
  try {
    const evaluation = await getEvaluationById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found.' });
    }

    return res.json(evaluation);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch evaluation.' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteEvaluation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Evaluation not found.' });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to delete evaluation.' });
  }
}

async function buildEvaluationWorkbook(evaluation) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Evaluation');

  worksheet.columns = [
    { header: 'Question', key: 'question', width: 40 },
    { header: 'Score (1-5)', key: 'score', width: 12 },
    { header: 'Latency (s)', key: 'latency', width: 14 },
    { header: 'Hallucination', key: 'hallucination', width: 14 },
    { header: 'Reason', key: 'reason', width: 60 }
  ];

  (evaluation?.questions || []).forEach((entry) => {
    worksheet.addRow({
      question: entry.question || '',
      score: entry.accuracy ?? entry.score ?? 0,
      latency: Number((entry.latency || 0).toFixed(2)),
      hallucination: entry.hallucination ? 'Yes' : 'No',
      reason: entry.reason || ''
    });
  });

  return workbook.xlsx.writeBuffer();
}

async function download(req, res) {
  try {
    const evaluation = await getEvaluationById(req.params.id);
    const buffer = await buildEvaluationWorkbook(evaluation);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${(evaluation?.filename || 'evaluation').replace(/\s+/g, '_')}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to export evaluation.' });
  }
}

module.exports = {
  uploadMarkdown,
  evaluateMarkdown,
  list,
  show,
  remove,
  download,
  buildEvaluationWorkbook
};
