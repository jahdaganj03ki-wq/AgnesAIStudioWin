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

            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null, userData);
                await _webView.EnsureCoreWebView2Async(env);
            }
            catch
            {
                await _webView.EnsureCoreWebView2Async();
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
    }
}
