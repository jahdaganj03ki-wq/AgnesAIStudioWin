// Global application state + persistence (localStorage). Secrets live in the host.
const State = {
  mode: 'chat',
  hasKey: false,
  baseUrl: 'https://apihub.agnes-ai.com/v1',
  settings: {
    theme: 'light',
    chatModel: 'agnes-2.0-flash',
    imageModel: 'agnes-image-2.1-flash',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    thinking: false,
    streaming: true,
    imageSize: '1024x1024',
    imageFormat: 'url',
    videoWidth: 1152,
    videoHeight: 768,
    videoFrames: 121,
    videoFps: 24,
  },
  conversations: { chat: [], bilder: [], video: [], editor: [] },
  currentId: null,

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('agnesai.settings') || '{}');
      this.settings = Object.assign(this.settings, s.settings || {});
      this.mode = s.mode || 'chat';
      this.conversations = Object.assign({ chat: [], bilder: [], video: [], editor: [] }, s.conversations || {});
    } catch (e) {}
  },

  save() {
    localStorage.setItem('agnesai.settings', JSON.stringify({
      settings: this.settings,
      mode: this.mode,
      conversations: this.conversations,
    }));
  },

  newConversation(title) {
    const conv = { id: 'c' + Date.now() + Math.floor(Math.random() * 1000), title: title || 'Neue Unterhaltung', items: [] };
    this.conversations[this.mode].unshift(conv);
    this.currentId = conv.id;
    this.save();
    return conv;
  },

  current() {
    return this.conversations[this.mode].find(c => c.id === this.currentId) || null;
  },

  ensureCurrent(title) {
    let c = this.current();
    if (!c) c = this.newConversation(title);
    return c;
  },
};

// ---- small helpers ----
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'dataset') Object.assign(e.dataset, attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
  }
  if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}

function uid() { return 'u' + Math.random().toString(36).slice(2, 10); }

// Very small markdown renderer (headings, bold, italic, inline code, code blocks, lists, paragraphs).
function renderMarkdown(text) {
  if (text == null) return '';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = text.replace(/\r/g, '').split('\n');
  let html = '', i = 0, inList = false, listType = '';
  const closeList = () => { if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; inList = false; } };
  const inline = (s) => {
    s = esc(s);
    s = s.replace(/```([\s\S]*?)```/g, (m, c) => `<pre><code>${c.replace(/^\n/, '')}</code></pre>`);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  };
  while (i < lines.length) {
    let line = lines[i];
    if (/^```/.test(line)) {
      closeList();
      let code = '';
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
      i++;
      html += `<pre><code>${esc(code.replace(/\n$/, ''))}</code></pre>`;
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      closeList();
      const lvl = line.match(/^#+/)[0].length;
      html += `<h${lvl}>${inline(line.replace(/^#+\s/, ''))}</h${lvl}>`;
      i++; continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList || listType !== 'ul') { closeList(); html += '<ul>'; inList = true; listType = 'ul'; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
      i++; continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList || listType !== 'ol') { closeList(); html += '<ol>'; inList = true; listType = 'ol'; }
      html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`;
      i++; continue;
    }
    if (line.trim() === '') { closeList(); i++; continue; }
    closeList();
    html += `<p>${inline(line)}</p>`;
    i++;
  }
  closeList();
  return html;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
