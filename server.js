const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const FILE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

// Ensure uploads dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// --- Multer config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage }); // No file size limit

// --- In-memory file registry ---
let files = [];

function loadExistingFiles() {
  if (!fs.existsSync(UPLOAD_DIR)) return;
  const entries = fs.readdirSync(UPLOAD_DIR);
  entries.forEach(name => {
    const filePath = path.join(UPLOAD_DIR, name);
    const stat = fs.statSync(filePath);
    const originalName = name.replace(/^\d+-/, '');
    files.push({
      id: name,
      originalName,
      size: stat.size,
      uploadedAt: stat.mtimeMs,
      mimetype: getMimeCategory(originalName)
    });
  });
}

function getMimeCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image', '.svg': 'image', '.bmp': 'image',
    '.mp4': 'video', '.mkv': 'video', '.avi': 'video', '.mov': 'video', '.webm': 'video',
    '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.flac': 'audio', '.aac': 'audio',
    '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document', '.rtf': 'document',
    '.xls': 'spreadsheet', '.xlsx': 'spreadsheet', '.csv': 'spreadsheet',
    '.ppt': 'presentation', '.pptx': 'presentation',
    '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive', '.gz': 'archive',
    '.js': 'code', '.py': 'code', '.html': 'code', '.css': 'code', '.json': 'code', '.ts': 'code',
    '.exe': 'executable', '.msi': 'executable', '.apk': 'executable',
  };
  return map[ext] || 'other';
}

loadExistingFiles();

// --- Auto-cleanup ---
setInterval(() => {
  const now = Date.now();
  files = files.filter(f => {
    if (now - f.uploadedAt > FILE_TTL) {
      const filePath = path.join(UPLOAD_DIR, f.id);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      io.emit('file:removed', f.id);
      return false;
    }
    return true;
  });
}, 60 * 1000); // check every minute

// --- Serve static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API routes ---
app.get('/api/info', (req, res) => {
  const ip = getLanIP();
  res.json({ url: `http://${ip}:${PORT}`, ip, port: PORT });
});

app.get('/api/files', (req, res) => {
  res.json(files);
});

app.post('/api/upload', upload.array('files', 20), (req, res) => {
  const uploaded = req.files.map(f => {
    const entry = {
      id: f.filename,
      originalName: f.originalname,
      size: f.size,
      uploadedAt: Date.now(),
      mimetype: getMimeCategory(f.originalname)
    };
    files.push(entry);
    io.emit('file:added', entry);
    return entry;
  });
  res.json({ success: true, files: uploaded });
});

app.get('/api/download/:id', (req, res) => {
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(UPLOAD_DIR, file.id);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  const stat = fs.statSync(filePath);
  res.set({
    'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    'Content-Length': stat.size,
    'Content-Type': 'application/octet-stream'
  });
  fs.createReadStream(filePath).pipe(res);
});

app.get('/api/view/:id', (req, res) => {
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(UPLOAD_DIR, file.id);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  const stat = fs.statSync(filePath);
  const mime = require('path').extname(file.originalName).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
    '.pdf': 'application/pdf'
  };
  res.set({
    'Content-Length': stat.size,
    'Content-Type': mimeTypes[mime] || 'application/octet-stream',
    'Accept-Ranges': 'bytes'
  });
  fs.createReadStream(filePath).pipe(res);
});

app.delete('/api/files/:id', (req, res) => {
  const idx = files.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'File not found' });
  const file = files[idx];
  const filePath = path.join(UPLOAD_DIR, file.id);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  files.splice(idx, 1);
  io.emit('file:removed', file.id);
  res.json({ success: true });
});

// --- Socket.io ---
let connectedDevices = 0;

io.on('connection', (socket) => {
  connectedDevices++;
  io.emit('devices:count', connectedDevices);
  
  socket.on('disconnect', () => {
    connectedDevices--;
    io.emit('devices:count', connectedDevices);
  });
});

// --- Get LAN IP ---
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// --- Start server ---
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  🚀 LAN File Drop is running!\n');
});
