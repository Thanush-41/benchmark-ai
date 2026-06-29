require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const evaluationRoutes = require('./routes/evaluation.routes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', evaluationRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('MongoDB connected');
    } catch (error) {
      console.warn('MongoDB connection unavailable, continuing in fallback mode.', error.message);
    }
  }

  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

start();
