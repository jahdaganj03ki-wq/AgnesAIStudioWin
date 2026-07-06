// Settings modal: API key, base URL, theme, model + parameter defaults
const Settings = {
  open() {
    const s = State.settings;
    const modal = el('div', { class: 'modal' }, [
      el('h3', { text: 'Einstellungen' }),
    ]);

    // API Key
    const keyInput = el('input', { type: 'password', placeholder: 'Agnes API-Key (plattform.agnes-ai.com)', value: State.hasKey ? '••••••••••••••••' : '' });
    modal.appendChild(el('div', { class: 'row' }, [
      el('label', { text: 'API-Key' }),
      keyInput,
      el('div', { class: 'hint', text: 'Wird verschlüsselt (DPAPI, nur dieser Windows-Account) lokal gespeichert. Kostenlos unter platform.agnes-ai.com.' }),
    ]));

    // Base URL
    const urlInput = el('input', { type: 'text', value: State.baseUrl });
    modal.appendChild(el('div', { class: 'row' }, [
      el('label', { text: 'API Base-URL' }),
      urlInput,
    ]));

    // Theme
    const themeInput = el('input', { type: 'checkbox' });
    themeInput.checked = s.theme === 'dark';
    modal.appendChild(el('div', { class: 'row toggle-row' }, [
      el('label', { text: 'Dunkles Design' }),
      el('label', { class: 'switch' }, [themeInput, el('span', { class: 'slider' })]),
    ]));

    // Chat model
    const chatModel = el('select', { class: 'select' }, [
      el('option', { value: 'agnes-2.0-flash', text: 'agnes-2.0-flash' }),
      el('option', { value: 'agnes-1.5-flash', text: 'agnes-1.5-flash' }),
    ]);
    chatModel.value = s.chatModel;
    modal.appendChild(el('div', { class: 'row' }, [el('label', { text: 'Chat-Modell' }), chatModel]));

    // Image model default
    const imgModel = el('select', { class: 'select' }, [
      el('option', { value: 'agnes-image-2.1-flash', text: 'agnes-image-2.1-flash' }),
      el('option', { value: 'agnes-image-2.0-flash', text: 'agnes-image-2.0-flash' }),
    ]);
    imgModel.value = s.imageModel;
    modal.appendChild(el('div', { class: 'row' }, [el('label', { text: 'Standard-Bildmodell' }), imgModel]));

    // Temperature / max_tokens / top_p
    const temp = el('input', { type: 'number', step: '0.1', min: '0', max: '2', value: s.temperature });
    const mtok = el('input', { type: 'number', step: '1', min: '1', value: s.maxTokens });
    const topp = el('input', { type: 'number', step: '0.1', min: '0', max: '1', value: s.topP });
    modal.appendChild(el('div', { class: 'row', style: 'flex-direction:row;gap:10px;flex-wrap:wrap;' }, [
      el('div', { style: 'flex:1;min-width:120px;' }, [el('label', { text: 'Temperatur' }), temp]),
      el('div', { style: 'flex:1;min-width:120px;' }, [el('label', { text: 'Max Tokens' }), mtok]),
      el('div', { style: 'flex:1;min-width:120px;' }, [el('label', { text: 'Top-P' }), topp]),
    ]));

    // thinking + streaming
    const thinking = el('input', { type: 'checkbox' }); thinking.checked = !!s.thinking;
    const streaming = el('input', { type: 'checkbox' }); streaming.checked = !!s.streaming;
    modal.appendChild(el('div', { class: 'row', style: 'flex-direction:row;gap:20px;flex-wrap:wrap;' }, [
      el('label', { class: 'switch' }, [thinking, el('span', { class: 'slider' }), document.createTextNode(' Thinking/Reasoning')]),
      el('label', { class: 'switch' }, [streaming, el('span', { class: 'slider' }), document.createTextNode(' Streaming')]),
    ]));

    // image defaults
    const imgSize = el('input', { type: 'text', value: s.imageSize });
    const imgFmt = el('select', { class: 'select' }, [el('option', { value: 'url', text: 'URL' }), el('option', { value: 'b64_json', text: 'Base64' })]);
    imgFmt.value = s.imageFormat;
    modal.appendChild(el('div', { class: 'row', style: 'flex-direction:row;gap:10px;flex-wrap:wrap;' }, [
      el('div', { style: 'flex:1;min-width:120px;' }, [el('label', { text: 'Bildgröße' }), imgSize]),
      el('div', { style: 'flex:1;min-width:120px;' }, [el('label', { text: 'Bildausgabe' }), imgFmt]),
    ]));

    // video defaults
    const vw = el('input', { type: 'number', value: s.videoWidth });
    const vh = el('input', { type: 'number', value: s.videoHeight });
    const vf = el('input', { type: 'number', value: s.videoFrames });
    const vfp = el('input', { type: 'number', value: s.videoFps });
    modal.appendChild(el('div', { class: 'row', style: 'flex-direction:row;gap:10px;flex-wrap:wrap;' }, [
      el('div', { style: 'flex:1;min-width:100px;' }, [el('label', { text: 'Video Breite' }), vw]),
      el('div', { style: 'flex:1;min-width:100px;' }, [el('label', { text: 'Video Höhe' }), vh]),
      el('div', { style: 'flex:1;min-width:100px;' }, [el('label', { text: 'Frames' }), vf]),
      el('div', { style: 'flex:1;min-width:100px;' }, [el('label', { text: 'FPS' }), vfp]),
    ]));

    const saveBtn = el('button', { class: 'btn primary', text: 'Speichern', onclick: () => {
      const keyVal = keyInput.value.trim();
      if (keyVal && !keyVal.includes('•')) { State.hasKey = true; Bridge.setKey(keyVal); }
      const newUrl = urlInput.value.trim();
      if (newUrl && newUrl !== State.baseUrl) { State.baseUrl = newUrl; Bridge.setConfig(newUrl); }
      else Bridge.getConfig();
      s.theme = themeInput.checked ? 'dark' : 'light';
      s.chatModel = chatModel.value;
      s.imageModel = imgModel.value;
      s.temperature = Number(temp.value);
      s.maxTokens = Number(mtok.value);
      s.topP = Number(topp.value);
      s.thinking = thinking.checked;
      s.streaming = streaming.checked;
      s.imageSize = imgSize.value.trim();
      s.imageFormat = imgFmt.value;
      s.videoWidth = Number(vw.value); s.videoHeight = Number(vh.value);
      s.videoFrames = Number(vf.value); s.videoFps = Number(vfp.value);
      State.save();
      document.body.dataset.theme = s.theme;
      UI.updateKeyStatus();
      UI.closeModals();
      UI.toast('Einstellungen gespeichert');
    }});

    modal.appendChild(el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn', text: 'Abbrechen', onclick: () => UI.closeModals() }),
      saveBtn,
    ]));

    UI.openModal(modal);
  },
};
