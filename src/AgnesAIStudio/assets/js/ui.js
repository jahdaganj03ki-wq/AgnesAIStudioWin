// Shared UI: sidebar, mode switching, modals, fullscreen, toasts.
const UI = {
  setMode(mode) {
    State.mode = mode;
    State.currentId = null;
    State.save();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const titles = { chat: 'Chat', bilder: 'Bilder', video: 'Video', editor: 'Editor' };
    document.getElementById('mode-title').textContent = titles[mode] || mode;
    document.body.dataset.theme = State.settings.theme;
    App.renderSidebar();
    App.renderMode();
  },

  renderSidebar() {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === State.mode));
    const list = document.getElementById('conv-list');
    list.innerHTML = '';
    const convs = State.conversations[State.mode] || [];
    convs.forEach(c => {
      const item = el('div', { class: 'conv-item' + (c.id === State.currentId ? ' active' : ''), onclick: () => {
        State.currentId = c.id; State.save(); UI.renderSidebar(); App.renderMode();
      } }, [
        el('span', { text: c.title || 'Unbenannt' }),
        el('span', { class: 'del', text: '✕', title: 'Löschen', onclick: (e) => {
          e.stopPropagation();
          State.conversations[State.mode] = State.conversations[State.mode].filter(x => x.id !== c.id);
          if (State.currentId === c.id) State.currentId = null;
          State.save(); UI.renderSidebar(); App.renderMode();
        } }),
      ]);
      list.appendChild(item);
    });
  },

  updateKeyStatus() {
    const k = document.getElementById('key-status');
    if (State.hasKey) {
      k.className = 'key-status auth';
      k.textContent = '🔑 API-Key aktiv';
    } else {
      k.className = 'key-status unauth';
      k.textContent = '🔑 Kein API-Key';
    }
  },

  toast(msg, isError) {
    const t = el('div', { text: msg, style: `position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:${isError ? '#cf1322' : '#1f1f1f'};color:#fff;padding:10px 16px;border-radius:10px;z-index:300;font-size:13px;box-shadow:var(--shadow);max-width:80%;` });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },

  showFullscreenImage(src) {
    const ov = el('div', { class: 'fs-overlay' }, [
      el('button', { class: 'close', text: '✕', onclick: () => ov.remove() }),
      el('img', { src }),
    ]);
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    document.getElementById('modal-root').appendChild(ov);
  },

  downloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename || ('agnesai-' + Date.now());
    document.body.appendChild(a); a.click(); a.remove();
  },

  downloadDataUri(dataUri, filename) {
    const a = document.createElement('a');
    a.href = dataUri; a.download = filename || ('agnesai-' + Date.now());
    document.body.appendChild(a); a.click(); a.remove();
  },

  openModal(node) {
    const root = document.getElementById('modal-root');
    const overlay = el('div', { class: 'modal-overlay' }, [node]);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    root.appendChild(overlay);
    return overlay;
  },

  closeModals() { document.getElementById('modal-root').innerHTML = ''; },
};

// Register mode modules registry
const Modes = {};
