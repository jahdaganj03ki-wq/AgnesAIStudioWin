// App bootstrap + host message handling
const App = {
  renderMode() {
    const m = Modes[State.mode];
    if (m && m.render) m.render();
  },

  renderSidebar() { UI.renderSidebar(); },
  setMode(mode) { UI.setMode(mode); },

  onHost(m) {
    if (m.type === 'auth.ready') {
      State.hasKey = !!m.hasKey;
      UI.updateKeyStatus();
      if (!State.hasKey) Settings.open();
    } else if (m.type === 'config.ready') {
      if (m.baseUrl) State.baseUrl = m.baseUrl;
    } else if (m.type === 'host.error') {
      UI.toast('Host: ' + m.message, true);
    }
  },
};

window.addEventListener('DOMContentLoaded', () => {
  State.load();
  document.body.dataset.theme = State.settings.theme;

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', () => UI.setMode(b.dataset.mode));
  });
  document.getElementById('new-chat').addEventListener('click', () => {
    State.currentId = null;
    State.save();
    UI.renderSidebar();
    App.renderMode();
    document.getElementById('content').scrollTop = 0;
  });
  document.getElementById('open-settings').addEventListener('click', () => Settings.open());

  UI.renderSidebar();
  UI.setMode(State.mode || 'chat');

  // tell the host the UI is ready -> it replies with auth.ready + config.ready
  Bridge.send('ui.ready');
});
