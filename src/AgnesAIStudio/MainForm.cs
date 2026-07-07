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
        private readonly string _bootstrapper =
            "https://go.microsoft.com/fwlink/p/?LinkId=2086861";

        public MainForm()
        {
            Text = "AgnesAI Studio";
            Width = 1280;
            Height = 850;
            MinimumSize = new System.Drawing.Size(900, 600);
        }

        private async void MainForm_Load(object? sender, EventArgs e)
        {
            _webView = new WebView2 { Dock = DockStyle.Fill };
            Controls.Add(_webView);

            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AgnesAIStudio", "WebView2");

            CoreWebView2Environment? env = null;
            try
            {
                env = await CoreWebView2Environment.CreateAsync(null, userData);
                await _webView.EnsureCoreWebView2Async(env);
            }
            catch (Exception ex)
            {
                if (!await TryInstallWebView2Async())
                {
                    MessageBox.Show(
                        "Die Edge WebView2 Runtime wird für diese App benötigt, konnte aber nicht automatisch installiert werden.\n\n" +
                        "Fehler: " + ex.Message + "\n\n" +
                        "Bitte installiere die Runtime manuell:\n" +
                        "https://developer.microsoft.com/microsoft-edge/webview2/",
                        "AgnesAI Studio - WebView2 fehlt",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                try
                {
                    env = await CoreWebView2Environment.CreateAsync(null, userData);
                    await _webView.EnsureCoreWebView2Async(env);
                }
                catch (Exception ex2)
                {
                    MessageBox.Show(
                        "WebView2 lädt trotz Installation nicht korrekt.\n\n" + ex2.Message + "\n\n" +
                        "Bitte starte die App neu.",
                        "AgnesAI Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
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

        private async Task<bool> TryInstallWebView2Async()
        {
            var res = MessageBox.Show(
                "Die Edge WebView2 Runtime ist nicht installiert.\n\n" +
                "Ohne diese Komponente kann das Fenster nicht angezeigt werden.\n\n" +
                "Jetzt Runtime herunterladen und installieren?",
                "AgnesAI Studio - WebView2 benötigt",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question);

            if (res != DialogResult.Yes) return false;

            try
            {
                var dest = Path.Combine(
                    Path.GetTempPath(),
                    "AgnesAIStudio", "MicrosoftEdgeWebview2Setup.exe");
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);

                using var wc = new System.Net.WebClient();
                wc.DownloadFile(_bootstrapper, dest);

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = dest,
                    Arguments = "/silent /install",
                    UseShellExecute = true,
                    Verb = "runas",
                    CreateNoWindow = true,
                };
                using var p = System.Diagnostics.Process.Start(psi);
                if (p != null) await Task.Run(() => p.WaitForExit(15 * 60 * 1000));

                Application.DoEvents();
                var testEnv = await CoreWebView2Environment.CreateAsync(null, string.Empty);
                return testEnv != null;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Automatische Installation fehlgeschlagen:\n" + ex.Message,
                    "AgnesAI Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return false;
            }
        }
            catch (Exception ex)
            {
                if (!TryInstallWebView2(out env))
                {
                    MessageBox.Show(
                        "Die Edge WebView2 Runtime wird für diese App benötigt, konnte aber nicht automatisch installiert werden.\n\n" +
                        "Fehler: " + ex.Message + "\n\n" +
                        "Bitte installiere die Runtime manuell:\n" +
                        "https://developer.microsoft.com/microsoft-edge/webview2/",
                        "AgnesAI Studio - WebView2 fehlt",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                try
                {
                    await _webView.EnsureCoreWebView2Async(env);
                }
                catch (Exception ex2)
                {
                    MessageBox.Show(
                        "WebView2 lädt trotz Installation nicht korrekt.\n\n" + ex2.Message + "\n\n" +
                        "Bitte starte die App neu.",
                        "AgnesAI Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
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

        private bool TryInstallWebView2(out CoreWebView2Environment? env)
        {
            env = null;
            var result = MessageBox.Show(
                "Die Edge WebView2 Runtime ist nicht installiert.\n\n" +
                "Ohne diese Komponente kann das Fenster nicht angezeigt werden.\n\n" +
                "Jetzt Runtime herunterladen und installieren?",
                "AgnesAI Studio - WebView2 benötigt",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question);

            if (result != DialogResult.Yes) return false;

            try
            {
                var dest = Path.Combine(
                    Path.GetTempPath(),
                    "AgnesAIStudio", "MicrosoftEdgeWebview2Setup.exe");
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);

                using var wc = new System.Net.WebClient();
                wc.DownloadFile(_bootstrapper, dest);

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = dest,
                    Arguments = "/silent /install",
                    UseShellExecute = true,
                    Verb = "runas",
                    CreateNoWindow = true,
                };
                using var p = System.Diagnostics.Process.Start(psi);
                if (p != null) p.WaitForExit(15 * 60 * 1000);

                Application.DoEvents();
                return CoreWebView2Environment.CreateAsync(null, string.Empty).GetAwaiter().GetResult() != null;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Automatische Installation fehlgeschlagen:\n" + ex.Message,
                    "AgnesAI Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return false;
            }
        }
    }
}
