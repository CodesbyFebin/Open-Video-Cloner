'use strict';
const express = require('express');
const path = require('node:path');
const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// This release is a UI prototype. Never generate fake job completion,
// video downloads, VMAF metrics, agent telemetry, or export URLs.
const unavailable = (_req, res) => res.status(501).json({
  status: 'not_implemented',
  error: 'Media processing is not connected in this prototype.',
  required: 'A configured media worker, FFmpeg, model runtimes, job persistence, and authorization.',
});
app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: 'prototype', mediaProcessing: false }));
app.get('/api/state', (_req, res) => res.json({
  mode: 'prototype', agents: [], tools: [], jobs: [], logs: [], pipelineProgress: 0,
}));
app.get('/api/progress', (_req, res) => res.json({ progress: 0, running: false }));
app.post('/api/clone', unavailable);
app.post('/api/export', unavailable);
app.post('/api/logs', (_req, res) => res.status(405).json({ error: 'Live log ingestion is unavailable.' }));
app.delete('/api/logs', (_req, res) => res.status(405).json({ error: 'No live logs exist.' }));

if (require.main === module) app.listen(port, '127.0.0.1', () => {
  console.log('Open Video Cloner prototype listening at http://127.0.0.1:' + port);
});
module.exports = app;
