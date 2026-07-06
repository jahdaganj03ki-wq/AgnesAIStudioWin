// Bilder mode — agnes-image-2.0-flash / agnes-image-2.1-flash (text-to-image + image-to-image)
Modes.bilder = (function () {
  let refImage = null; // {name, dataUri}
  let busy = false;

  const SIZES = ['1024x1024', '1024x768', '768x1024', '1280x720', '720x1280', '1536x1024', '1024x1536', '2048x1024', '1024x2048'];

  function render() {
    refImage = null;
    const content = document.getElementById('content');
    const composer = document.getElementById('composer');
    content.innerHTML = '';

    const conv = State.current();
    const gallery = el('div', { class: 'gallery' });
    if (!conv || conv.items.length === 0) {
      gallery.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'big', text: '🖼️' }),
        el('h2', { text: 'Bilder generieren' }),
        el('div', { text: 'Beschreibe ein Bild und lasse es von Agnes erzeugen. Optional mit Referenzbild.' }),
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

  function imageActions(it) {
    return el('div', { class: 'actions' }, [
      el('button', { class: 'act-btn', text: '✏️ Weiter bearbeiten', onclick: () => Modes.editor.loadFromImage(it.src, it.prompt) }),
      el('button', { class: 'act-btn', text: '🔁 Nochmal generieren', onclick: () => regenerate(it) }),
      el('button', { class: 'act-btn', text: '⛶ Vollbild', onclick: () => UI.showFullscreenImage(it.src) }),
      el('button', { class: 'act-btn', text: '⬇️ Download', onclick: () => download(it) }),
    ]);
  }

  function renderCard(it) {
    const media = el('div', { class: 'media' }, [el('img', { src: it.src, loading: 'lazy' })]);
    return el('div', { class: 'gen-card' }, [
      media,
      el('div', { class: 'prompt-line', text: it.prompt || '(kein Prompt)' }),
      imageActions(it),
    ]);
  }

  function download(it) {
    if (it.src.startsWith('data:')) UI.downloadDataUri(it.src, 'agnes-bild.png');
    else UI.downloadUrl(it.src, 'agnes-bild.png');
  }

  function regenerate(it) {
    generate(it.prompt, it.model, it.size, it.format, it.refImage);
  }

  function renderComposer() {
    const box = el('div', { class: 'composer-box' });
    const ta = el('textarea', { rows: '2', placeholder: 'Beschreibe das gewünschte Bild…', oninput: () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; } });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(ta); } });

    const modelSel = el('select', { class: 'select', title: 'Modell' }, [
      el('option', { value: 'agnes-image-2.1-flash', text: 'agnes-image-2.1-flash (hochwertig)' }),
      el('option', { value: 'agnes-image-2.0-flash', text: 'agnes-image-2.0-flash (schnell)' }),
    ]);
    modelSel.value = State.settings.imageModel;

    const sizeSel = el('select', { class: 'select', title: 'Größe' }, SIZES.map(s => el('option', { value: s, text: s })));
    sizeSel.value = SIZES.includes(State.settings.imageSize) ? State.settings.imageSize : '1024x1024';

    const fmtSel = el('select', { class: 'select', title: 'Ausgabe' }, [
      el('option', { value: 'url', text: 'URL' }),
      el('option', { value: 'b64_json', text: 'Base64' }),
    ]);
    fmtSel.value = State.settings.imageFormat;

    const refThumb = el('div', { class: 'attach-thumbs' });
    const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { refImage = { name: f.name, dataUri: r.result }; showRef(); };
      r.readAsDataURL(f); e.target.value = '';
    }});
    const showRef = () => {
      refThumb.innerHTML = '';
      if (refImage) refThumb.appendChild(el('div', { class: 'thumb' }, [el('img', { src: refImage.dataUri }),
        el('button', { class: 'rm', text: '✕', onclick: () => { refImage = null; refThumb.innerHTML = ''; } })]));
    };
    showRef();
    const attachBtn = el('button', { class: 'icon-btn', title: 'Referenzbild', text: '📎', onclick: () => fileInput.click() });
    const genBtn = el('button', { class: 'send-btn', title: 'Generieren', text: '➤', onclick: () => submit(ta) });

    box.appendChild(refThumb);
    box.appendChild(el('div', { class: 'composer-row' }, [
      attachBtn, fileInput, ta,
      el('div', { class: 'composer-actions' }, [genBtn]),
    ]));
    box.appendChild(el('div', { class: 'composer-row', style: 'margin-top:6px;flex-wrap:wrap;' }, [
      el('span', { class: 'field-label', text: 'Modell' }), modelSel,
      el('span', { class: 'field-label', text: 'Größe' }), sizeSel,
      el('span', { class: 'field-label', text: 'Ausgabe' }), fmtSel,
    ]));
    return box;
  }

  function submit(ta) {
    const prompt = ta.value.trim();
    if (!prompt || busy) return;
    generate(prompt, document.querySelector('#composer select')?.value || State.settings.imageModel,
      getSize(), getFmt(), refImage ? refImage.dataUri : null);
    ta.value = '';
  }

  function getSize() {
    const s = document.querySelectorAll('#composer select')[1];
    return s ? s.value : State.settings.imageSize;
  }
  function getFmt() {
    const s = document.querySelectorAll('#composer select')[2];
    return s ? s.value : State.settings.imageFormat;
  }

  function generate(prompt, model, size, format, refDataUri) {
    if (busy) return;
    busy = true;
    const conv = State.ensureCurrent(prompt.slice(0, 40));
    if (conv.items.length === 1) conv.title = prompt.slice(0, 40);
    State.save();

    const gallery = document.querySelector('#content .gallery');
    const card = el('div', { class: 'gen-card' }, [el('div', { class: 'media' }, [el('div', { class: 'spinner' })]),
      el('div', { class: 'prompt-line', text: prompt })]);
    gallery.appendChild(card);
    document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight;

    const body = { model, prompt, size, n: 1, response_format: format };
    if (format === 'b64_json') body.return_base64 = true;
    if (refDataUri) body.extra_body = { image: [refDataUri] };

    Bridge.request({
      method: 'POST', endpoint: 'images/generations', body, stream: false,
      onData: (m) => {
        let d; try { d = JSON.parse(m.data); } catch (e) { return; }
        const img = (d.data && d.data[0]) || {};
        const src = img.url || (img.b64_json ? 'data:image/png;base64,' + img.b64_json : null);
        if (!src) { UI.toast('Kein Bild in Antwort', true); return; }
        const item = { type: 'image', prompt, src, model, size, format, refImage: refDataUri || undefined };
        conv.items.push(item); State.save();
        card.replaceWith(renderCard(item));
        UI.renderSidebar();
      },
      onError: (m) => {
        card.querySelector('.media').innerHTML = '<div style="padding:20px;color:#cf1322">Fehler ' + (m.status || '') + '</div>';
        UI.toast('Bild-Fehler: ' + (m.status || ''), true);
      },
      onDone: () => { busy = false; },
    });
  }

  function openWithImage(src) {
    refImage = { dataUri: src };
    if (State.mode !== 'bilder') UI.setMode('bilder');
    else render();
  }

  return { render, openWithImage };
})();
