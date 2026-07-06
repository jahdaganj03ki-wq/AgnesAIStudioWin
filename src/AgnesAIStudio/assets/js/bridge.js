// Bridge between the JS UI and the C#/WebView2 host.
const Bridge = {
  seq: 0,
  pending: {},

  _onHost(msg) {
    let m;
    try { m = JSON.parse(msg); } catch (e) { return; }
    if (m.id && Bridge.pending[m.id]) {
      Bridge.pending[m.id](m);
    }
    if (window.App && App.onHost) App.onHost(m);
  },

  send(type, payload) {
    const msg = Object.assign({ type }, payload || {});
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(JSON.stringify(msg));
    }
  },

  // Generic API request. Returns the request id.
  request({ method = 'POST', endpoint, body = null, stream = false, onStart, onChunk, onData, onError, onDone }) {
    const id = 'r' + (++Bridge.seq);
    Bridge.pending[id] = (m) => {
      if (m.type === 'resp.start' && onStart) onStart(m);
      else if (m.type === 'resp.chunk' && onChunk) onChunk(m);
      else if (m.type === 'resp.data') { if (onData) onData(m); if (onDone) onDone(m); }
      else if (m.type === 'resp.error') { if (onError) onError(m); if (onDone) onDone(m); }
      else if (m.type === 'resp.done' && onDone) onDone(m);
    };
    Bridge.send('request', { id, method, endpoint, body, stream });
    return id;
  },

  setKey(key) { Bridge.send('auth.setKey', { key }); },
  refreshKey() { Bridge.send('auth.ready'); },
  getConfig() { Bridge.send('config.get'); },
  setConfig(baseUrl) { Bridge.send('config.set', { baseUrl }); },
};

window.__host = (msg) => Bridge._onHost(msg);
