/* ============================================
   LAN File Drop — Client-side Application
   ============================================ */

(function () {
  'use strict';

  // --- DOM refs ---
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseLink = document.getElementById('browseLink');
  const filesGrid = document.getElementById('filesGrid');
  const emptyState = document.getElementById('emptyState');
  const fileCount = document.getElementById('fileCount');
  const deviceNum = document.getElementById('deviceNum');
  const progressSection = document.getElementById('progressSection');
  const progressFill = document.getElementById('progressFill');
  const progressStats = document.getElementById('progressStats');
  const progressDetail = document.getElementById('progressDetail');
  const toastContainer = document.getElementById('toastContainer');
  const bgParticles = document.getElementById('bgParticles');

  // --- Socket.io ---
  const socket = io();

  socket.on('devices:count', (count) => {
    deviceNum.textContent = count;
  });

  socket.on('file:added', (file) => {
    addFileCard(file);
    updateFileCount();
    showToast('success', `"${truncate(file.originalName, 28)}" uploaded`);
  });

  socket.on('file:removed', (fileId) => {
    removeFileCard(fileId);
    updateFileCount();
  });

  // --- Init ---
  async function init() {
    setupTheme();
    createParticles();
    await loadFiles();
    setupDragDrop();
    setupBrowse();
    setupQRModal();
  }

  // --- Theme Toggle ---
  function setupTheme() {
    const toggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    
    // Load saved theme
    const saved = localStorage.getItem('lan-drop-theme');
    if (saved) {
      html.setAttribute('data-theme', saved);
    }

    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      
      if (next === 'dark') {
        html.removeAttribute('data-theme');
      } else {
        html.setAttribute('data-theme', 'light');
      }
      
      localStorage.setItem('lan-drop-theme', next);
      
      // Animate the toggle
      toggle.style.transform = 'rotate(360deg) scale(1.1)';
      setTimeout(() => toggle.style.transform = '', 400);
    });
  }

  // --- Background particles ---
  function createParticles() {
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.classList.add('particle');
      const size = Math.random() * 3 + 1;
      const x = Math.random() * 100;
      const duration = Math.random() * 15 + 10;
      const delay = Math.random() * 15;
      const hue = Math.random() > 0.5 ? '250' : '190';
      p.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${x}%;
        background: hsl(${hue}, 80%, 65%);
        box-shadow: 0 0 ${size * 3}px hsl(${hue}, 80%, 65%);
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
      `;
      bgParticles.appendChild(p);
    }
  }

  // --- Load existing files ---
  async function loadFiles() {
    try {
      const res = await fetch('/api/files');
      const files = await res.json();
      filesGrid.innerHTML = '';
      files.forEach(addFileCard);
      updateFileCount();
    } catch (err) {
      showToast('error', 'Failed to load files');
    }
  }

  // --- Drag & Drop ---
  function setupDragDrop() {
    let dragCounter = 0;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
      document.body.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
    });

    dropZone.addEventListener('dragenter', () => {
      dragCounter++;
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      dragCounter = 0;
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length) uploadFiles(files);
    });

    // Click to upload
    dropZone.addEventListener('click', (e) => {
      if (e.target.closest('.browse-link') || e.target === dropZone || e.target.closest('.drop-zone-content')) {
        fileInput.click();
      }
    });
  }

  function setupBrowse() {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        uploadFiles(fileInput.files);
        fileInput.value = '';
      }
    });
  }

  // --- Upload ---
  async function uploadFiles(fileList) {
    const formData = new FormData();
    let totalSize = 0;

    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
      totalSize += fileList[i].size;
    }

    const fileNames = Array.from(fileList).map(f => f.name);
    const label = fileList.length === 1
      ? `"${truncate(fileNames[0], 24)}"`
      : `${fileList.length} files`;

    // Show progress
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    progressStats.textContent = '0% · Calculating...';
    progressDetail.textContent = `Uploading ${label} (${formatSize(totalSize)})`;

    const startTime = Date.now();

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? e.loaded / elapsed : 0;
          progressFill.style.width = pct + '%';
          progressStats.textContent = `${pct}% · ${formatSize(speed)}/s`;
        }
      });

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      progressFill.style.width = '100%';
      progressStats.textContent = '100% · Complete';
      progressDetail.textContent = `Successfully uploaded ${label}`;

      setTimeout(() => {
        progressSection.style.display = 'none';
      }, 2000);

    } catch (err) {
      showToast('error', `Upload failed: ${err.message}`);
      progressSection.style.display = 'none';
    }
  }

  // --- File Cards ---
  const FILE_ICONS = {
    image:        '🖼️',
    video:        '🎬',
    audio:        '🎵',
    document:     '📄',
    spreadsheet:  '📊',
    presentation: '📽️',
    archive:      '📦',
    code:         '💻',
    executable:   '⚙️',
    other:        '📎'
  };

  function addFileCard(file) {
    emptyState.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.id = file.id;

    const elapsed = getTimeAgo(file.uploadedAt);

    card.innerHTML = `
      <div class="file-type-icon ${file.mimetype}">${FILE_ICONS[file.mimetype] || '📎'}</div>
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(file.originalName)}">${escapeHtml(file.originalName)}</div>
        <div class="file-meta">
          <span>${formatSize(file.size)}</span>
          <span class="meta-dot"></span>
          <span class="file-time" data-ts="${file.uploadedAt}">${elapsed}</span>
        </div>
      </div>
      <span class="download-hint">👁 Preview</span>
      <button class="file-delete" title="Delete file" onclick="event.stopPropagation()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>
    `;

    // Click: preview if supported, otherwise download
    card.addEventListener('click', () => {
      const previewable = ['image', 'video', 'audio', 'document'];
      if (previewable.includes(file.mimetype)) {
        openPreview(file);
      } else {
        window.location.href = `/api/download/${file.id}`;
      }
    });

    // Delete button
    card.querySelector('.file-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        showToast('info', `"${truncate(file.originalName, 28)}" deleted`);
      } catch (err) {
        showToast('error', 'Failed to delete file');
      }
    });

    filesGrid.prepend(card);
  }

  function removeFileCard(fileId) {
    const card = filesGrid.querySelector(`[data-id="${fileId}"]`);
    if (card) {
      card.classList.add('removing');
      card.addEventListener('animationend', () => {
        card.remove();
        updateFileCount();
      });
    }
  }

  function updateFileCount() {
    const count = filesGrid.querySelectorAll('.file-card').length;
    fileCount.textContent = `${count} file${count !== 1 ? 's' : ''}`;
    emptyState.style.display = count === 0 ? 'flex' : 'none';
  }

  // --- Toasts ---
  function showToast(type, message) {
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
  }

  // --- Utilities ---
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '…' : str;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getTimeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  // Update timestamps every minute
  setInterval(() => {
    document.querySelectorAll('.file-time').forEach(el => {
      const ts = parseFloat(el.dataset.ts);
      if (ts) el.textContent = getTimeAgo(ts);
    });
  }, 60000);

  // --- QR Code Modal ---
  function setupQRModal() {
    const shareBtn = document.getElementById('shareBtn');
    const qrModal = document.getElementById('qrModal');
    const qrClose = document.getElementById('qrClose');
    const qrCanvas = document.getElementById('qrCanvas');
    const qrUrlText = document.getElementById('qrUrlText');
    const qrCopyBtn = document.getElementById('qrCopyBtn');
    let lanUrl = '';

    // Fetch LAN info and generate QR
    async function loadQR() {
      try {
        const res = await fetch('/api/info');
        const info = await res.json();
        lanUrl = info.url;
        qrUrlText.textContent = lanUrl;

        // Generate QR code on canvas
        if (typeof QRCode !== 'undefined') {
          QRCode.toCanvas(qrCanvas, lanUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#1a1a2e', light: '#ffffff' }
          }, function(error) {
            if (error) console.error('QR generation error:', error);
          });
        }
      } catch (err) {
        qrUrlText.textContent = 'Could not detect network';
      }
    }

    // Open modal
    shareBtn.addEventListener('click', () => {
      qrModal.classList.add('active');
      loadQR();
    });

    // Close modal
    qrClose.addEventListener('click', () => {
      qrModal.classList.remove('active');
    });

    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) qrModal.classList.remove('active');
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') qrModal.classList.remove('active');
    });

    // Copy URL
    qrCopyBtn.addEventListener('click', async () => {
      if (!lanUrl) return;
      try {
        await navigator.clipboard.writeText(lanUrl);
        showToast('success', 'URL copied to clipboard');
      } catch {
        // Fallback
        const input = document.createElement('input');
        input.value = lanUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        showToast('success', 'URL copied to clipboard');
      }
    });
  }

  // --- Preview Modal ---
  function openPreview(file) {
    const modal = document.getElementById('previewModal');
    const content = document.getElementById('previewContent');
    const filename = document.getElementById('previewFilename');
    const filesize = document.getElementById('previewFilesize');
    const downloadBtn = document.getElementById('previewDownload');
    const closeBtn = document.getElementById('previewClose');

    filename.textContent = file.originalName;
    filesize.textContent = formatSize(file.size);
    downloadBtn.href = `/api/download/${file.id}`;
    content.innerHTML = '';

    const viewUrl = `/api/view/${file.id}`;

    switch (file.mimetype) {
      case 'image': {
        const img = document.createElement('img');
        img.src = viewUrl;
        img.alt = file.originalName;
        content.appendChild(img);
        break;
      }
      case 'video': {
        const video = document.createElement('video');
        video.src = viewUrl;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        content.appendChild(video);
        break;
      }
      case 'audio': {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-unsupported';
        wrapper.innerHTML = `<span class="preview-unsupported-icon">🎵</span><p>${escapeHtml(file.originalName)}</p>`;
        const audio = document.createElement('audio');
        audio.src = viewUrl;
        audio.controls = true;
        audio.autoplay = true;
        wrapper.appendChild(audio);
        content.appendChild(wrapper);
        break;
      }
      case 'document': {
        // PDF gets iframe, others get unsupported message
        const ext = file.originalName.split('.').pop().toLowerCase();
        if (ext === 'pdf') {
          const iframe = document.createElement('iframe');
          iframe.src = viewUrl;
          content.appendChild(iframe);
        } else {
          showUnsupported(content, file);
        }
        break;
      }
      default:
        showUnsupported(content, file);
    }

    modal.classList.add('active');

    // Close handlers
    function close() {
      modal.classList.remove('active');
      // Stop video/audio
      const vid = content.querySelector('video');
      const aud = content.querySelector('audio');
      if (vid) vid.pause();
      if (aud) aud.pause();
      setTimeout(() => { content.innerHTML = ''; }, 300);
    }

    closeBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
    
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function showUnsupported(container, file) {
    const div = document.createElement('div');
    div.className = 'preview-unsupported';
    div.innerHTML = `
      <span class="preview-unsupported-icon">${FILE_ICONS[file.mimetype] || '📎'}</span>
      <p>Preview not available</p>
      <span>Click download to save this file</span>
    `;
    container.appendChild(div);
  }

  // --- Go ---
  init();
})();
