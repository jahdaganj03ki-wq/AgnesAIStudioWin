using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AgnesAIStudio
{
    /// <summary>
    /// Bridges the WebView2 UI and the Agnes AI HTTP API.
    /// All network calls (and the API key) live here so the JS layer never sees the key
    /// and never hits CORS restrictions.
    /// </summary>
    public sealed class Backend
    {
        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(15) };

        private readonly WebView2 _webView;
        private readonly string _appDir;
        private readonly string _settingsPath;
        private readonly string _keyPath;
        private const string DefaultBaseUrl = "https://apihub.agnes-ai.com/v1";

        public Backend(WebView2 webView)
        {
            _webView = webView;
            _appDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "AgnesAIStudio");
            Directory.CreateDirectory(_appDir);
            _settingsPath = Path.Combine(_appDir, "settings.json");
            _keyPath = Path.Combine(_appDir, "key.bin");
        }

        // ---- messaging to JS -------------------------------------------------

        public async Task PostToJs(string json)
        {
            if (_webView.CoreWebView2 == null) return;
            try
            {
                var wv = _webView;
                wv.BeginInvoke(new Action(() =>
                {
                    try
                    {
                        var core = wv.CoreWebView2;
                        if (core != null)
                            _ = core.ExecuteScriptAsync("window.__host(" + json + ")");
                    }
                    catch { }
                }));
            }
            catch { }
        }

        private Task Reply(object obj) => PostToJs(JsonSerializer.Serialize(obj));

        // ---- incoming messages ----------------------------------------------

        public async Task HandleMessage(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(raw);
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var typeEl)) return;
                var type = typeEl.GetString();

                switch (type)
                {
                    case "ui.ready":
                        await Reply(new { type = "auth.ready", hasKey = HasKey() });
                        await Reply(new { type = "config.ready", baseUrl = LoadBaseUrl() });
                        break;

                    case "auth.setKey":
                        SaveKey(root.TryGetProperty("key", out var k) ? k.GetString() : null);
                        await Reply(new { type = "auth.ready", hasKey = HasKey() });
                        break;

                    case "auth.ready":
                        await Reply(new { type = "auth.ready", hasKey = HasKey() });
                        break;

                    case "config.get":
                        await Reply(new { type = "config.ready", baseUrl = LoadBaseUrl() });
                        break;

                    case "config.set":
                        if (root.TryGetProperty("baseUrl", out var bu) && bu.ValueKind == JsonValueKind.String)
                        {
                            var v = bu.GetString()!.Trim();
                            if (!string.IsNullOrEmpty(v)) SaveBaseUrl(v);
                        }
                        await Reply(new { type = "config.ready", baseUrl = LoadBaseUrl() });
                        break;

                    case "request":
                        await HandleRequest(root);
                        break;
                }
            }
            catch (Exception ex)
            {
                try { await Reply(new { type = "host.error", message = ex.Message }); } catch { }
            }
        }

        // ---- HTTP proxy ------------------------------------------------------

        private async Task HandleRequest(JsonElement root)
        {
            var id = root.GetProperty("id").GetString() ?? "";
            var method = root.TryGetProperty("method", out var m) ? m.GetString() ?? "POST" : "POST";
            var endpoint = root.GetProperty("endpoint").GetString() ?? "";
            var stream = root.TryGetProperty("stream", out var s) && s.ValueKind == JsonValueKind.True;

            var url = endpoint.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? endpoint
                : Combine(LoadBaseUrl(), endpoint);

            var req = new HttpRequestMessage(new HttpMethod(method), url);
            var key = LoadKey();
            if (!string.IsNullOrEmpty(key))
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", key);

            if (root.TryGetProperty("body", out var body) && body.ValueKind != JsonValueKind.Undefined && method != "GET")
            {
                req.Content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            }

            await Reply(new { type = "resp.start", id });

            try
            {
                if (stream)
                {
                    using var resp = await Http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
                    if (!resp.IsSuccessStatusCode)
                    {
                        var err = await resp.Content.ReadAsStringAsync();
                        await Reply(new { type = "resp.error", id, status = (int)resp.StatusCode, body = err });
                        return;
                    }
                    using var rs = await resp.Content.ReadAsStreamAsync();
                    using var reader = new StreamReader(rs);
                    string? line;
                    while ((line = await reader.ReadLineAsync()) != null)
                    {
                        if (!line.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) continue;
                        var data = line.Substring(5).Trim();
                        if (data == "[DONE]") continue;
                        await Reply(new { type = "resp.chunk", id, data });
                    }
                    await Reply(new { type = "resp.done", id });
                }
                else
                {
                    using var resp = await Http.SendAsync(req);
                    var content = await resp.Content.ReadAsStringAsync();
                    if (!resp.IsSuccessStatusCode)
                    {
                        await Reply(new { type = "resp.error", id, status = (int)resp.StatusCode, body = content });
                    }
                    else
                    {
                        await Reply(new { type = "resp.data", id, data = content });
                    }
                }
            }
            catch (Exception ex)
            {
                await Reply(new { type = "resp.error", id, status = 0, body = ex.Message });
            }
        }

        // ---- storage ---------------------------------------------------------

        private string LoadBaseUrl()
        {
            try
            {
                if (File.Exists(_settingsPath))
                {
                    using var d = JsonDocument.Parse(File.ReadAllText(_settingsPath));
                    if (d.RootElement.TryGetProperty("baseUrl", out var b) && b.ValueKind == JsonValueKind.String)
                    {
                        var v = b.GetString();
                        if (!string.IsNullOrEmpty(v)) return v!;
                    }
                }
            }
            catch { }
            return DefaultBaseUrl;
        }

        private void SaveBaseUrl(string url)
        {
            try
            {
                File.WriteAllText(_settingsPath, JsonSerializer.Serialize(new { baseUrl = url }));
            }
            catch { }
        }

        private bool HasKey() => File.Exists(_keyPath) && LoadKey() is { Length: > 0 };

        private string? LoadKey()
        {
            try
            {
                if (!File.Exists(_keyPath)) return null;
                var bytes = File.ReadAllBytes(_keyPath);
                var plain = ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(plain);
            }
            catch { return null; }
        }

        private void SaveKey(string? key)
        {
            try
            {
                if (string.IsNullOrEmpty(key))
                {
                    if (File.Exists(_keyPath)) File.Delete(_keyPath);
                    return;
                }
                var bytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(key), null, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(_keyPath, bytes);
            }
            catch { }
        }

        private static string Combine(string baseUrl, string endpoint)
        {
            return baseUrl.TrimEnd('/') + "/" + endpoint.TrimStart('/');
        }
    }
}
