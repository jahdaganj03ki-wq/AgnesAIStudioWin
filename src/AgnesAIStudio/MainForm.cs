using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AgnesAIStudio
{
    public class MainForm : Form
    {
        private WebView2? _webView;
        private Backend? _backend;

        public MainForm()
        {
            Text = "AgnesAI Studio";
            Width = 1280;
            Height = 850;
            MinimumSize = new System.Drawing.Size(900, 600);
        }

        private async void MainForm_Load(object? sender, EventArgs e)
        {
            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            Controls.Add(_webView);

            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AgnesAIStudio", "WebView2");

            CoreWebView2Environment? env = null;
            try
            {
                var runtimeDir = FindBundledRuntime();
                env = runtimeDir != null
                    ? await CoreWebView2Environment.CreateAsync(runtimeDir, userData)
                    : await CoreWebView2Environment.CreateAsync(null, userData);
            }
            catch (Exception ex)
            {
                try
                {
                    env = await CoreWebView2Environment.CreateAsync(null, userData);
                }
                catch
                {
                    MessageBox.Show(
                        "WebView2 konnte nicht initialisiert werden.\n\n" + ex.Message +
                        "\n\nDie App enthält eigentlich eine eigene WebView2-Runtime. Falls diese fehlt, " +
                        "installiere die WebView2 Runtime manuell oder starte die App neu.",
                        "AgnesAI Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            try
            {
                await _webView.EnsureCoreWebView2Async(env);
            }
            catch (Exception ex)
            {
                MessageBox.Show("WebView2 konnte nicht geladen werden:\n" + ex.Message,
                    "AgnesAI Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            _backend = new Backend(_webView);

            _webView.CoreWebView2.WebMessageReceived += (s, args) =>
            {
                var msg = args.TryGetWebMessageAsString();
                if (!string.IsNullOrEmpty(msg) && _backend != null)
                    _ = _backend.HandleMessage(msg);
            };

            var htmlPath = Path.Combine(AppContext.BaseDirectory, "assets", "index.html");
            if (File.Exists(htmlPath))
                _webView.CoreWebView2.Navigate(new Uri(htmlPath).AbsoluteUri);
            else
                _webView.CoreWebView2.Navigate("about:blank");
        }

        private static string? FindBundledRuntime()
        {
            try
            {
                var root = Path.Combine(AppContext.BaseDirectory, "WebView2Runtime");
                if (!Directory.Exists(root)) return null;
                foreach (var f in Directory.GetFiles(root, "msedgewebview2.exe", SearchOption.AllDirectories))
                    return Path.GetDirectoryName(f);
            }
            catch { }
            return null;
        }
    }
}
