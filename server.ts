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
    const result = await handleBackendFileAction('copy', req.body);
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
    const result = await handleBackendFileAction('move', req.body);
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
    const result = await handleBackendFileAction(action, req.body);
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
 * Proxy für /api/thumbnail -> https://storage.j-jonas.com/thumbnail
 * Liefert das serverseitig generierte WebP-Vorschaubild (FFmpeg).
 */
app.use('/api/thumbnail', (req, res) => {
  const targetUrl = `https://storage.j-jonas.com/thumbnail${req.url}`;
  res.redirect(targetUrl);
});

/**
 * PATCH /api/shares/permissions
 * Aktualisiert die Berechtigungen (can_see_members, can_manage_members) für ein Ordner-Mitglied.
 * Überträgt geänderte Flags sofort an das Backend und speichert diese dauerhaft.
 */
app.patch('/api/shares/permissions', async (req, res) => {
  try {
    const { folderPath, owner, username, permissions } = req.body;
    if (!folderPath || !owner || !username || !permissions) {
      return res.status(400).json({ success: false, error: 'Fehlende Pflichtparameter für Berechtigungs-Update.' });
    }
    const { updateMemberPermissions } = await import('./src/services/firebase');
    const result = await updateMemberPermissions(folderPath, owner, username, permissions);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Serverfehler beim Aktualisieren der Berechtigungen.' });
  }
});

/**
 * POST /api/shares/respond
 * Verarbeitet die Annahme oder Ablehnung einer Ordnereinladung und setzt den Status auf 'accepted' / 'declined'.
 */
app.post('/api/shares/respond', async (req, res) => {
  try {
    const { shareId, status, username } = req.body;
    if (!shareId || !status) {
      return res.status(400).json({ success: false, error: 'Fehlende Pflichtparameter (shareId, status).' });
    }
    const { respondToShare } = await import('./src/services/firebase');
    const success = await respondToShare(shareId, status, username);
    res.status(success ? 200 : 400).json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Serverfehler beim Verarbeiten der Ordnereinladung.' });
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
