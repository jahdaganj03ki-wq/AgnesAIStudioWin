// Editor mode — image editing with agnes-image-2.1-flash, chat-like & iterative
Modes.editor = (function () {
  let inputImages = []; // data URIs used as source for next edit
  let busy = false;

  const SIZES = ['1024x1024', '1024x768', '768x1024', '1280x720', '720x1280', '1536x1024', '1024x1536'];

  function render() {
    const content = document.getElementById('content');
    const composer = document.getElementById('composer');
    content.innerHTML = '';

    const conv = State.current();
    const thread = el('div', { class: 'editor-thread' });
    if (!conv || conv.items.length === 0) {
      thread.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'big', text: '✏️' }),
        el('h2', { text: 'Bild bearbeiten' }),
        el('div', { text: 'Lade ein Bild hoch und gib eine Editier-Anweisung. Das Ergebnis kannst du direkt weiterbearbeiten.' }),
      ]));
    } else {
      conv.items.forEach(it => thread.appendChild(renderItem(it)));
    }
    content.appendChild(thread);
    content.scrollTop = content.scrollHeight;

    composer.innerHTML = '';
    composer.appendChild(renderComposer());
    UI.updateKeyStatus();
  }

  function renderItem(it) {
    if (it.role === 'user') {
      const imgs = el('div', { class: 'attach-thumbs', style: 'margin:6px 0;' });
      (it.images || []).forEach(s => imgs.appendChild(el('div', { class: 'thumb' }, [el('img', { src: s })])));
      return el('div', { class: 'msg user' }, [
        el('div', { class: 'avatar me', text: 'Du' }),
        el('div', { class: 'bubble' }, [imgs, it.text ? document.createTextNode(it.text) : null].filter(Boolean)),
      ]);
    }
    const media = it.src ? el('div', { class: 'media', style: 'padding:6px;' }, [el('img', { src: it.src, style: 'max-width:100%;border-radius:8px;' })])
      : el('div', { class: 'media' }, [el('div', { class: 'spinner' })]]);
    const card = el('div', { class: 'gen-card', style: 'max-width:520px;' }, [
      media,
      el('div', { class: 'actions' }, [
        el('button', { class: 'act-btn', text: '✏️ Weiter bearbeiten', onclick: () => setInputImage(it.src) }),
        el('button', { class: 'act-btn', text: '⛶ Vollbild', onclick: () => UI.showFullscreenImage(it.src) }),
        el('button', { class: 'act-btn', text: '⬇️ Download', onclick: () => {
          if (it.src.startsWith('data:')) UI.downloadDataUri(it.src, 'agnes-edit.png'); else UI.downloadUrl(it.src, 'agnes-edit.png'); } }),
        el('button', { class: 'act-btn', text: '💬 In Chat', onclick: () => Modes.chat.openWithImage(it.src) }),
        el('button', { class: 'act-btn', text: '🖼️ In Bilder', onclick: () => Modes.bilder.openWithImage(it.src) }),
        el('button', { class: 'act-btn', text: '🎬 In Video', onclick: () => Modes.video.openWithImage(it.src) }),
      ]),
    ]);
    return el('div', { class: 'msg ai' }, [el('div', { class: 'avatar ai', text: 'A' }), card]);
  }

  function setInputImage(src) {
    inputImages = [src];
    if (State.mode !== 'editor') UI.setMode('editor');
    else { render(); }
  }

  function renderComposer() {
    const box = el('div', { class: 'composer-box' });
    const thumbs = el('div', { class: 'attach-thumbs' });
    const renderThumbs = () => {
      thumbs.innerHTML = '';
      inputImages.forEach((s, idx) => thumbs.appendChild(el('div', { class: 'thumb' }, [el('img', { src: s }),
        el('button', { class: 'rm', text: '✕', onclick: () => { inputImages.splice(idx, 1); renderThumbs(); } })])));
    };
    renderThumbs();

    const ta = el('textarea', { rows: '2', placeholder: 'Editier-Anweisung, z. B. „mache den Himmel sonnig“…', oninput: () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; } });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(ta); } });

    const fileInput = el('input', { type: 'file', accept: 'image/*', multiple: 'true', class: 'hidden', onchange: (e) => {
      Array.from(e.target.files).forEach(f => { const r = new FileReader(); r.onload = () => { inputImages.push(r.result); renderThumbs(); }; r.readAsDataURL(f); });
      e.target.value = '';
    }});
    const attachBtn = el('button', { class: 'icon-btn', title: 'Bild hochladen', text: '📎', onclick: () => fileInput.click() });
    const editBtn = el('button', { class: 'send-btn', title: 'Bearbeiten', text: '✏️', onclick: () => submit(ta) });

    const sizeSel = el('select', { class: 'select', title: 'Größe' }, SIZES.map(s => el('option', { value: s, text: s })));
    sizeSel.value = SIZES.includes(State.settings.imageSize) ? State.settings.imageSize : '1024x1024';
    const fmtSel = el('select', { class: 'select', title: 'Ausgabe' }, [
      el('option', { value: 'url', text: 'URL' }), el('option', { value: 'b64_json', text: 'Base64' }),
    ]);
    fmtSel.value = State.settings.imageFormat;

    box.appendChild(thumbs);
    box.appendChild(el('div', { class: 'composer-row' }, [attachBtn, fileInput, ta,
      el('div', { class: 'composer-actions' }, [editBtn])]));
    box.appendChild(el('div', { class: 'composer-row', style: 'margin-top:6px;flex-wrap:wrap;' }, [
      el('span', { class: 'field-label', text: 'Größe' }), sizeSel,
      el('span', { class: 'field-label', text: 'Ausgabe' }), fmtSel,
    ]));
    return box;
  }

  function submit(ta) {
    const text = ta.value.trim();
    if ((!text && inputImages.length === 0) || busy) return;
    const conv = State.ensureCurrent(text ? text.slice(0, 40) : 'Bildbearbeitung');
    if (conv.items.length === 1) conv.title = (text || 'Bearbeitung').slice(0, 40);
    const instruction = text || 'Bearbeite das Bild';
    const sources = inputImages.slice();
    conv.items.push({ role: 'user', text: instruction, images: sources });
    State.save();

    const thread = document.querySelector('#content .editor-thread');
    const aiItem = { role: 'assistant', src: null };
    conv.items.push(aiItem); State.save();
    const aiNode = renderItem(aiItem);
    thread.appendChild(aiNode);
    document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight;
    UI.renderSidebar();

    const size = document.querySelectorAll('#composer select')[0].value;
    const format = document.querySelectorAll('#composer select')[1].value;
    const body = {
      model: 'agnes-image-2.1-flash', prompt: instruction, size, n: 1, response_format: format,
      extra_body: { image: sources },
    };
    if (format === 'b64_json') body.return_base64 = true;

    busy = true;
    Bridge.request({
      method: 'POST', endpoint: 'images/generations', body, stream: false,
      onData: (m) => {
        let d; try { d = JSON.parse(m.data); } catch (e) { return; }
        const img = (d.data && d.data[0]) || {};
        const src = img.url || (img.b64_json ? 'data:image/png;base64,' + img.b64_json : null);
        if (!src) { UI.toast('Kein Bild in Antwort', true); return; }
        aiItem.src = src; State.save();
        const fresh = renderItem(aiItem);
        aiNode.replaceWith(fresh);
      },
      onError: (m) => {
        aiItem.error = true; State.save();
        const fresh = el('div', { class: 'msg ai' }, [el('div', { class: 'avatar ai', text: 'A' }),
          el('div', { class: 'bubble', text: '⚠️ Fehler ' + (m.status || '') })]); aiNode.replaceWith(fresh);
        UI.toast('Editor-Fehler: ' + (m.status || ''), true);
      },
      onDone: () => { busy = false; },
    });

    inputImages = [];
    ta.value = '';
    // keep current edited image available as input for next iteration
    conv._lastResult = aiItem.src;
    render();
  }

  // called from other modes
  function loadFromImage(src, prompt) {
    inputImages = [src];
    if (State.mode !== 'editor') UI.setMode('editor');
    const ta = document.querySelector('#composer textarea');
    if (ta && prompt) ta.value = prompt;
    if (State.mode === 'editor') render();
  }

  return { render, loadFromImage, setInputImage };
})();
