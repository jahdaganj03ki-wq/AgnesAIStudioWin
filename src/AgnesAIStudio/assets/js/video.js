// Video mode — agnes-video-v2.0 (text-to-video / image-to-video, async + polling)
Modes.video = (function () {
  let refImage = null;
  let busy = false;

  function render() {
    refImage = null;
    const content = document.getElementById('content');
    const composer = document.getElementById('composer');
    content.innerHTML = '';

    const conv = State.current();
    const gallery = el('div', { class: 'gallery' });
    if (!conv || conv.items.length === 0) {
      gallery.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'big', text: '🎬' }),
        el('h2', { text: 'Video generieren' }),
        el('div', { text: 'Beschreibe eine Szene oder lade ein Bild. Die Generierung läuft asynchron (Free: 1 RPM).' }),
      ]));
    } else {
      conv.items.forEach(it => gallery.appendChild(renderCard(it)));
    }
    content.appendChild(gallery);
    content.scrollTop = content.scrollHeight;

    composer.innerHTML = '';
    composer.appendChild(renderComposer());
    UI.updateKeyStatus();
  }

  function statusText(it) {
    return it.status === 'done' ? 'Fertig' : (it.status || 'Wird generiert…');
  }

  function renderCard(it) {
    const media = it.src
      ? el('div', { class: 'media' }, [el('video', { src: it.src, controls: 'true' })])
      : el('div', { class: 'media' }, [el('div', { class: 'spinner' }), el('div', { style: 'margin-left:10px;color:var(--text-2)', text: it.status || 'Wird generiert…' })]);
    const actions = it.src ? el('div', { class: 'actions' }, [
      el('button', { class: 'act-btn', text: '⬇️ Download', onclick: () => UI.downloadUrl(it.src, 'agnes-video.mp4') }),
      el('button', { class: 'act-btn', text: '🔁 Nochmal', onclick: () => regenerate(it) }),
    ]) : null;
    return el('div', { class: 'gen-card' }, [
      media,
      el('div', { class: 'prompt-line', text: (it.prompt || '') + (it.src ? '' : '  ·  ' + statusText(it)) }),
      actions,
    ].filter(Boolean));
  }

  function regenerate(it) {
    generate(it.prompt, it.width, it.height, it.frames, it.fps, it.refImage);
  }

  function renderComposer() {
    const box = el('div', { class: 'composer-box' });
    const ta = el('textarea', { rows: '2', placeholder: 'Beschreibe die Videoszene…', oninput: () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; } });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(ta); } });

    const w = numInput('Breite', State.settings.videoWidth);
    const h = numInput('Höhe', State.settings.videoHeight);
    const f = numInput('Frames', State.settings.videoFrames);
    const fps = numInput('FPS', State.settings.videoFps);

    const refThumb = el('div', { class: 'attach-thumbs' });
    const showRef = () => {
      refThumb.innerHTML = '';
      if (refImage) refThumb.appendChild(el('div', { class: 'thumb' }, [el('img', { src: refImage.dataUri }),
        el('button', { class: 'rm', text: '✕', onclick: () => { refImage = null; refThumb.innerHTML = ''; } })]));
    };
    const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: (e) => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader(); r.onload = () => { refImage = { dataUri: r.result }; showRef(); };
      r.readAsDataURL(file); e.target.value = '';
    }});
    showRef();
    const attachBtn = el('button', { class: 'icon-btn', title: 'Bild (image-to-video)', text: '📎', onclick: () => fileInput.click() });
    const genBtn = el('button', { class: 'send-btn', title: 'Video erstellen', text: '➤', onclick: () => submit(ta) });

    box.appendChild(refThumb);
    box.appendChild(el('div', { class: 'composer-row' }, [attachBtn, fileInput, ta,
      el('div', { class: 'composer-actions' }, [genBtn])]));
    box.appendChild(el('div', { class: 'composer-row', style: 'margin-top:6px;flex-wrap:wrap;' }, [
      field('Breite', w), field('Höhe', h), field('Frames', f), field('FPS', fps),
    ]));
    return box;
  }

  function numInput(label, val) {
    return el('input', { type: 'number', class: 'select', value: String(val), style: 'width:84px;', min: '1' });
  }
  function field(label, input) { return el('span', { style: 'display:flex;align-items:center;gap:4px;' }, [el('span', { class: 'field-label', text: label }), input]); }

  function submit(ta) {
    const prompt = ta.value.trim();
    if (!prompt || busy) return;
    const ins = document.querySelectorAll('#composer input[type=number]');
    generate(prompt, Number(ins[0].value), Number(ins[1].value), Number(ins[2].value), Number(ins[3].value), refImage ? refImage.dataUri : null);
    ta.value = '';
  }

  function generate(prompt, width, height, frames, fps, refDataUri) {
    if (busy) return;
    busy = true;
    const conv = State.ensureCurrent(prompt.slice(0, 40));
    if (conv.items.length === 1) conv.title = prompt.slice(0, 40);
    State.save();

    const gallery = document.querySelector('#content .gallery');
    const item = { type: 'video', prompt, width, height, frames, fps, refImage: refDataUri || undefined, status: 'Wird generiert…' };
    conv.items.push(item); State.save();
    const card = renderCard(item);
    card.id = item._domId || (item._domId = uid());
    gallery.appendChild(card);
    document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight;
    UI.renderSidebar();

    const body = { model: 'agnes-video-v2.0', prompt, width, height, num_frames: frames, frame_rate: fps };
    if (refDataUri) body.image = refDataUri;

    Bridge.request({
      method: 'POST', endpoint: 'videos', body, stream: false,
      onData: (m) => {
        let d; try { d = JSON.parse(m.data); } catch (e) { return; }
        const vid = d.video_id || d.id;
        if (!vid) { UI.toast('Keine video_id in Antwort', true); busy = false; return; }
        pollLoop(vid, item);
      },
      onError: (m) => {
        item.status = 'Fehler ' + (m.status || '');
        const cur = document.getElementById(item._domId);
        if (cur) cur.replaceWith(renderCard(item));
        UI.toast('Video-Fehler: ' + (m.status || ''), true);
        busy = false;
      },
    });
  }

  function pollLoop(videoId, item) {
    const root = State.baseUrl.replace(/\/v1\/?$/, '');
    const url = root + '/agnesapi?video_id=' + encodeURIComponent(videoId);
    Bridge.request({
      method: 'GET', endpoint: url, stream: false,
      onData: (m) => {
        let d; try { d = JSON.parse(m.data); } catch (e) { d = {}; }
        const status = String(d.status || '').toLowerCase();
        const src = d.video_url || d.url || (d.result && (d.result.url || d.result.video_url)) || (d.data && (d.data.url || d.data.video_url));
        if (src) {
          item.src = src; item.status = 'done'; State.save();
          const cur = document.getElementById(item._domId);
          if (cur) cur.replaceWith(renderCard(item)); busy = false; UI.renderSidebar();
        } else if (['failed', 'error', 'cancelled'].includes(status)) {
          item.status = 'Fehlgeschlagen'; State.save();
          const cur = document.getElementById(item._domId);
          if (cur) cur.replaceWith(renderCard(item)); busy = false;
          UI.toast('Video fehlgeschlagen', true);
        } else {
          item.status = 'Wird generiert… (' + (status || 'wartet') + ')'; State.save();
          const cur = document.getElementById(item._domId);
          if (cur) cur.replaceWith(renderCard(item));
          setTimeout(() => pollLoop(videoId, item), 5000);
        }
      },
      onError: (m) => {
        item.status = 'Fehler ' + (m.status || '');
        const cur = document.getElementById(item._domId);
        if (cur) cur.replaceWith(renderCard(item)); busy = false;
        UI.toast('Poll-Fehler: ' + (m.status || ''), true);
      },
    });
  }

  function openWithImage(src) {
    refImage = { dataUri: src };
    if (State.mode !== 'video') UI.setMode('video');
    else render();
  }

  return { render, openWithImage };
})();
