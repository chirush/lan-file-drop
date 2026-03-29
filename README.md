# 🚀 LAN File Drop

**Instantly share files between devices on your local network.**

A sleek, self-hosted file sharing tool that runs on your PC and lets any device on the same WiFi upload and download files — no internet required.

![Dark Theme](https://img.shields.io/badge/theme-dark%20glassmorphism-6C63FF)
![Node.js](https://img.shields.io/badge/node.js-18+-339933)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- **Drag & Drop Upload** — Drop files onto the page or click to browse
- **Real-time Sync** — Files appear instantly on all connected devices via Socket.io
- **QR Code** — Scan the terminal QR code on your phone to connect instantly
- **One-click Download** — Tap any file to download it
- **Upload Progress** — Real-time progress bar with speed and percentage
- **Multiple Files** — Upload many files at once
- **File Type Icons** — Visual icons for images, videos, documents, audio, and more
- **Delete Files** — Remove shared files with one click
- **Auto-cleanup** — Files are automatically deleted after 1 hour
- **Mobile Responsive** — Works perfectly on phone browsers
- **Connected Devices** — See how many devices are connected
- **Premium UI** — Dark glassmorphism theme with smooth animations

## 🏃 Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/lan-file-drop.git
cd lan-file-drop

# Install dependencies
npm install

# Start the server
node server.js
```

Then scan the QR code shown in your terminal, or open the displayed URL on any device on the same network.

## 📱 How It Works

1. Run `node server.js` on your PC
2. The terminal shows your LAN IP, port, and a QR code
3. Scan the QR code on your phone (or type the URL)
4. Drag & drop files to share between devices
5. All connected devices see files in real-time

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Node.js + Express |
| Real-time | Socket.io |
| Uploads | Multer |
| QR Code | qrcode-terminal |
| Frontend | Pure HTML/CSS/JS |

## 📁 Project Structure

```
lan-file-drop/
├── server.js          # Express + Socket.io server
├── package.json
├── public/
│   ├── index.html     # Drag-and-drop UI
│   ├── style.css      # Dark glassmorphism theme
│   └── app.js         # Upload logic, socket events
└── uploads/           # Temporary file storage (auto-created)
```

## ⚙️ Configuration

Edit `server.js` to change:

| Setting | Default | Description |
|---------|---------|-------------|
| `PORT` | `3000` | Server port |
| `FILE_TTL` | `3600000` (1hr) | Auto-delete time in ms |
| `fileSize` limit | `500MB` | Max upload size |

## 📝 License

MIT — use it however you want.
