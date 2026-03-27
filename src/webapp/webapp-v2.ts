import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Static-only router for a separate WebApp v2 build (keeps v1 and v2 isolated).
// - Serves files from `/webapp-v2/*`
// - SPA fallback for deep links
// - Does NOT register API endpoints (use existing `/webapp/api/*`)

const router = express.Router();

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webappV2Dir = path.join(__dirname, '../../webapp-v2');

router.use(express.static(webappV2Dir));
router.use('/static', express.static(webappV2Dir));

router.get('/', (_req, res) => {
  const indexPath = path.join(webappV2Dir, 'index.html');
  res.sendFile(indexPath);
});

// SPA fallback: allow deep links like `/webapp-v2/profile/123`
router.get('*', (req, res, next) => {
  // Do not hijack API calls in case someone uses `/webapp-v2/api/*` later.
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(webappV2Dir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next(err);
  });
});

export { router as webappV2Router };

