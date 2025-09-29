/* Simple Express server to persist survey submissions to a local JSON file */
const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

async function ensureDataFile() {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.access(DATA_FILE, fs.constants.F_OK).catch(async () => {
      await fsp.writeFile(DATA_FILE, '[]', 'utf8');
    });
  } catch (err) {
    console.error('Failed to ensure data file', err);
    throw err;
  }
}

async function readAll() {
  await ensureDataFile();
  const raw = await fsp.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    // Reset the file if corrupted
    await fsp.writeFile(DATA_FILE, '[]', 'utf8');
    return [];
  }
}

async function writeAll(items) {
  await ensureDataFile();
  const tmp = DATA_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(items, null, 2), 'utf8');
  await fsp.rename(tmp, DATA_FILE);
}

app.get('/api/submissions', async (req, res) => {
  try {
    const items = await readAll();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read submissions' });
  }
});

app.post('/api/submissions', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const items = await readAll();
    items.push(body);
    await writeAll(items);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

app.delete('/api/submissions', async (req, res) => {
  try {
    await writeAll([]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear submissions' });
  }
});

app.listen(PORT, () => {
  console.log(`Survey server listening on http://localhost:${PORT}`);
});
