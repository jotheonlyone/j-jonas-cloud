import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { handleBackendFileAction } from './src/utils/fileTransferBackend';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

/**
 * POST /api/files/copy
 * Autorisierungsprüfung: Prüft, ob der Nutzer Schreibrechte auf targetFolderId
 * oder den Zielordner besitzt (canWrite, role !== 'viewer', etc.).
 * Bricht NICHT fälschlicherweise ab, wenn der Nutzer nicht der Eigentümer (owner) des Zielordners ist!
 */
app.post('/api/files/copy', async (req, res) => {
  try {
    const result = await handleBackendFileAction('copy', req.body, req.headers.authorization);
    res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Serverfehler beim Kopieren' });
  }
});

/**
 * POST /api/files/move
 * Autorisierungsprüfung: Prüft, ob der Nutzer Schreibrechte auf targetFolderId besitzt.
 */
app.post('/api/files/move', async (req, res) => {
  try {
    const result = await handleBackendFileAction('move', req.body, req.headers.authorization);
    res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Serverfehler beim Verschieben' });
  }
});

/**
 * POST /api/files/paste
 */
app.post('/api/files/paste', async (req, res) => {
  try {
    const action = req.body.action === 'cut' ? 'move' : 'copy';
    const result = await handleBackendFileAction(action, req.body, req.headers.authorization);
    res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Serverfehler beim Einfügen' });
  }
});

/**
 * Proxy für /api/stream -> https://storage.j-jonas.com/stream
 */
app.use('/api/stream', (req, res) => {
  const targetUrl = `https://storage.j-jonas.com/stream${req.url}`;
  res.redirect(targetUrl);
});

/**
 * GET /api/public-share/:shareId
 * Öffentlicher Info-Endpunkt für freigegebene Einzellinks.
 * Prüft den Share auf https://storage.j-jonas.com/public-share/:shareId per HEAD-Request
 * und liest Content-Disposition (Dateiname), Content-Type (MIME) und Content-Length aus (ohne CORS-Einschränkungen).
 */
app.get('/api/public-share/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    if (!shareId) return res.status(400).json({ success: false, error: 'Keine shareId übergeben.' });

    const backendUrl = `https://storage.j-jonas.com/public-share/${encodeURIComponent(shareId)}`;
    const headRes = await fetch(backendUrl, { method: 'HEAD' });

    if (!headRes.ok && headRes.status !== 206) {
      return res.status(headRes.status).json({ success: false, error: 'Freigabe nicht gefunden.' });
    }

    const cd = headRes.headers.get('content-disposition') || '';
    let fileName = '';
    const matchName = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (matchName && matchName[1]) {
      try {
        fileName = decodeURIComponent(matchName[1].trim());
      } catch {
        fileName = matchName[1].trim();
      }
    }

    const contentType = headRes.headers.get('content-type') || '';
    const contentLength = headRes.headers.get('content-length')
      ? parseInt(headRes.headers.get('content-length')!, 10)
      : undefined;

    res.json({
      success: true,
      shareId,
      fileName: fileName || undefined,
      contentType,
      size: contentLength,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Serverfehler beim Laden der Freigabe.' });
  }
});




/**
 * GET /api/shares
 * Liefert aktuelle, nicht-gecachte Freigaben für einen Ordner oder Nutzer.
 */
app.get('/api/shares', async (req, res) => {
  try {
    const { folderPath, owner, username } = req.query;
    const { getSharedFolder, getSharesForInvitedUser, getSharesByOwner } = await import('./src/services/firebase');

    if (folderPath && owner) {
      const share = await getSharedFolder(String(folderPath), String(owner));
      return res.json({ success: true, share });
    }

    if (username) {
      const [invited, owned] = await Promise.all([
        getSharesForInvitedUser(String(username)),
        getSharesByOwner(String(username)),
      ]);
      return res.json({ success: true, invited, owned });
    }

    res.status(400).json({ success: false, error: 'Fehlende Abfrageparameter.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Serverfehler beim Laden der Freigaben.' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
