// Chat mode — agnes-2.0-flash (streaming, vision input)
Modes.chat = (function () {
  let attachments = []; // {name, dataUri}
  let busy = false;

  function render() {
    attachments = [];
    const content = document.getElementById('content');
    const composer = document.getElementById('composer');
    content.innerHTML = '';

    const conv = State.current();
    const wrap = el('div', { class: 'chat-wrap', id: 'chat-wrap' });

    if (!conv || conv.items.length === 0) {
      wrap.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'big', text: '💬' }),
        el('h2', { text: 'Womit kann ich helfen?' }),
        el('div', { text: 'Stelle eine Frage, lade ein Bild zum Analysieren hoch oder lasse etwas programmieren.' }),
      ]));
    } else {
      conv.items.forEach(it => wrap.appendChild(renderMsg(it)));
    }
    content.appendChild(wrap);
    if (conv && conv.items.length) wrap.scrollTop = wrap.scrollHeight;
    content.scrollTop = content.scrollHeight;

    composer.innerHTML = '';
    composer.appendChild(renderComposer());
    UI.updateKeyStatus();
  }

  function renderMsg(it) {
    const isUser = it.role === 'user';
    const bubble = el('div', { class: 'bubble' });
    if (it.images && it.images.length) {
      it.images.forEach(src => bubble.appendChild(el('img', { src, style: 'max-width:220px;display:inline-block;margin:4px;' })));
    }
    if (it.text) bubble.innerHTML = (isUser ? escapeHtml(it.text) : renderMarkdown(it.text));
    return el('div', { class: 'msg ' + (isUser ? 'user' : 'ai') }, [
      el('div', { class: 'avatar ' + (isUser ? 'me' : 'ai'), text: isUser ? 'Du' : 'A' }),
      bubble,
    ]);
  }

  function renderComposer() {
    const box = el('div', { class: 'composer-box' });
    const thumbs = el('div', { class: 'attach-thumbs' });
    const ta = el('textarea', { rows: '1', placeholder: 'Nachricht an Agnes schreiben…', oninput: () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; } });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta); }
    });

    const fileInput = el('input', { type: 'file', accept: 'image/*', multiple: 'true', class: 'hidden', onchange: (e) => {
      Array.from(e.target.files).forEach(f => {
        const r = new FileReader();
        r.onload = () => { attachments.push({ name: f.name, dataUri: r.result }); renderThumbs(thumbs); };
        r.readAsDataURL(f);
      });
      e.target.value = '';
    }});

    const attachBtn = el('button', { class: 'icon-btn', title: 'Bild anhängen', text: '📎', onclick: () => fileInput.click() });
    const sendBtn = el('button', { class: 'send-btn', title: 'Senden', text: '➤', onclick: () => send(ta) });

    box.appendChild(thumbs);
    box.appendChild(el('div', { class: 'composer-row' }, [
      attachBtn, fileInput,
      ta,
      el('div', { class: 'composer-actions' }, [sendBtn]),
    ]));
    return box;
  }

  function renderThumbs(thumbs) {
    thumbs.innerHTML = '';
    attachments.forEach((a, idx) => {
      thumbs.appendChild(el('div', { class: 'thumb' }, [
        el('img', { src: a.dataUri }),
        el('button', { class: 'rm', text: '✕', onclick: () => { attachments.splice(idx, 1); renderThumbs(thumbs); } }),
      ]));
    });
  }

  function send(ta) {
    const text = ta.value.trim();
    if ((!text && attachments.length === 0) || busy) return;
    const conv = State.ensureCurrent(text ? text.slice(0, 40) : 'Bildanalyse');
    if (conv.items.length === 1) conv.title = (text || 'Bild').slice(0, 40);
    conv.items.push({ role: 'user', text, images: attachments.length ? attachments.map(a => a.dataUri) : undefined });
    attachments = [];
    State.save();
    render();

    const wrap = document.getElementById('chat-wrap');
    const aiMsg = { role: 'assistant', text: '' };
    conv.items.push(aiMsg);
    const aiEl = renderMsg(aiMsg);
    const aiBubble = aiEl.querySelector('.bubble');
    wrap.appendChild(aiEl);
    content().scrollTop = content().scrollHeight;

    busy = true;
    const messages = conv.items.slice(0, -1).map(it => {
      if (it.role === 'user' && it.images && it.images.length) {
        const contentArr = [{ type: 'text', text: it.text || '' }];
        it.images.forEach(src => contentArr.push({ type: 'image_url', image_url: { url: src } }));
        return { role: 'user', content: contentArr };
      }
      return { role: it.role, content: it.text || '' };
    });

    const body = {
      model: State.settings.chatModel,
      messages,
      stream: State.settings.streaming,
      temperature: Number(State.settings.temperature),
      max_tokens: Number(State.settings.maxTokens),
      top_p: Number(State.settings.topP),
    };

    Bridge.request({
      method: 'POST', endpoint: 'chat/completions', body, stream: State.settings.streaming,
      onChunk: (m) => {
        let d; try { d = JSON.parse(m.data); } catch (e) { return; }
        const delta = (d.choices && d.choices[0] && d.choices[0].delta) || {};
        const piece = delta.content || delta.reasoning_content || '';
        if (piece) {
          aiMsg.text += piece;
          aiBubble.innerHTML = renderMarkdown(aiMsg.text);
          content().scrollTop = content().scrollHeight;
        }
      },
      onData: (m) => {
        let d; try { d = JSON.parse(m.data); } catch (e) { return; }
        const txt = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || aiMsg.text;
        aiMsg.text = txt; aiBubble.innerHTML = renderMarkdown(txt);
        State.save();
      },
      onError: (m) => {
        aiMsg.text = '⚠️ Fehler ' + (m.status || '') + ': ' + m.body;
        aiBubble.innerHTML = escapeHtml(aiMsg.text);
        UI.toast('Chat-Fehler: ' + (m.status || ''), true);
        State.save();
      },
      onDone: () => { busy = false; State.save(); UI.renderSidebar(); },
    });
  }

  function content() { return document.getElementById('content'); }

  function openWithImage(src) {
    UI.setMode('chat');
    const conv = State.ensureCurrent('Bild besprechen');
    conv.items.push({ role: 'user', text: '', images: [src] });
    State.save();
    render();
  }

  return { render, openWithImage };
})();
