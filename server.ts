import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

// Import all API handlers
import sendBatchHandler from './api/whatsapp/send-batch.js';
import whatsappWebhookHandler from './api/whatsapp/webhook.js';
import submissionsHandler from './api/submissions.js';
import requestValidateHandler from './api/request/validate.js';
import requestCreateHandler from './api/request/create.js';
import submitHandler from './api/submit.js';
import signSubmitHandler from './api/sign/submit.js';
import signValidateHandler from './api/sign/validate.js';
import tallyStatusHandler from './api/tally/status.js';
import tallyWebhookHandler from './api/tally/webhook.js';
import tallySubmissionsHandler from './api/tally/submissions.js';
import tallySyncSubmissionsHandler from './api/tally/sync-submissions.js';
import templateUploadHandler from './api/template/upload.js';
import uploadPdfHandler from './api/upload-pdf.js';
import parseCrewHandler from './api/parse-crew.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Mount API routes
  app.all('/api/whatsapp/send-batch', sendBatchHandler as any);
  app.all('/api/whatsapp/webhook', whatsappWebhookHandler as any);
  app.all('/api/submissions', submissionsHandler as any);
  app.all('/api/request/validate', requestValidateHandler as any);
  app.all('/api/request/create', requestCreateHandler as any);
  app.all('/api/submit', submitHandler as any);
  app.all('/api/sign/submit', signSubmitHandler as any);
  app.all('/api/sign/validate', signValidateHandler as any);
  app.all('/api/tally/status', tallyStatusHandler as any);
  app.all('/api/tally/webhook', tallyWebhookHandler as any);
  app.all('/api/tally/submissions', tallySubmissionsHandler as any);
  app.all('/api/tally/sync-submissions', tallySyncSubmissionsHandler as any);
  app.all('/api/template/upload', templateUploadHandler as any);
  app.all('/api/upload-pdf', uploadPdfHandler as any);
  app.all('/api/parse-crew', parseCrewHandler as any);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
