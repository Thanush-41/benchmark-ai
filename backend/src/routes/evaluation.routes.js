const express = require('express');
const multer = require('multer');
const { uploadMarkdown, evaluateMarkdown, list, show, remove, download } = require('../controllers/evaluation.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/upload', upload.single('file'), uploadMarkdown);
router.post('/evaluate', evaluateMarkdown);
router.get('/evaluations', list);
router.get('/evaluations/:id', show);
router.delete('/evaluations/:id', remove);
router.get('/download/:id', download);

module.exports = router;
