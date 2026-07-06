# AgnesAI Studio (Windows 10/11, 64-bit)

Kostenlose, native Windows-App für die Agnes-AI-Modelle, optisch angelehnt an Qwen Chat.
Die App nutzt deinen **eigenen, kostenlosen** Agnes-API-Key (registriere ihn einmalig unter
[platform.agnes-ai.com](https://platform.agnes-ai.com)).

## Modelle
- **Chat** – `agnes-2.0-flash` (Streaming, Vision/Bildanalyse)
- **Bilder** – `agnes-image-2.0-flash` / `agnes-image-2.1-flash` (Text- & Image-to-Image)
- **Video** – `agnes-video-v2.0` (Text-/Image-to-Video, asynchron mit Polling)
- **Editor** – bildbasierte Nachbearbeitung mit `agnes-image-2.1-flash`, chat-artig iterierbar

Unter jedem erzeugten Bild: **Weiter bearbeiten · Nochmal generieren · Vollbild · Download**
(wie in Qwen Chat). Ergebnisse lassen sich per Button direkt in Chat / Bilder / Video weiterreichen.

## Technik
- Nativer Windows-Host (C# + WinForms) mit eingebettetem **Edge WebView2**.
- Die gesamte UI ist HTML/CSS/JS (im WebView geladen) → exakte Qwen-Chat-Optik.
- Alle API-Calls laufen über den Host (WinHTTP/HttpClient) → **kein CORS**, der Key wird
  verschlüsselt (DPAPI, nur dieser Windows-Account) lokal gespeichert.
- API-Basis: `https://apihub.agnes-ai.com/v1` (OpenAI-kompatibel).

## Build (automatisch via GitHub Actions)
Der Build läuft **nie lokal**, sondern immer in GitHub Actions (`windows-latest`):
`dotnet publish` (self-contained, win-x64) → NSIS-Setup-Installer.
Der Installer bundlelt bei Bedarf den WebView2-Evergreen-Runtime-Installer.

## Einrichten
1. Installer aus den GitHub-Actions-Artefakten (oder Release) herunterladen und installieren.
2. App starten → Einstellungen (⚙️) → **API-Key** eintragen (kostenlos auf platform.agnes-ai.com).
3. Modus wählen und loslegen.

## Repository
Quelle/Build: https://github.com/jahdaganj02ki-sketch/AgnesAIStudioWin
