# AnimeFlow / anime.ph.sh

Tools for browsing, streaming, and downloading anime from **AnimePahe** (`animepahe.pw`), complete with a Cloudflare-bypass proxy pipeline.

This repository contains two separate tools that share the same trick — bypassing Cloudflare protection with **FlareSolverr** (via Docker) and decoding `kwik.cx` encrypted streams into playable `m3u8` HLS links:

| Tool | What it is | How you use it |
|------|-----------|----------------|
| `server.py` | Flask web app ("AnimeFlow") with a streaming proxy | `python3 server.py` → open `http://localhost:5050` |
| `anime.ph.sh` | Interactive terminal CLI to search / play / download | `./anime.ph.sh` |

## Repository structure

```
├── server.py              # Flask backend: API proxy + m3u8 streaming proxy
├── index.html             # Frontend (dark-themed SPA, hls.js player)
├── playwright_helper.py   # Subprocess helper: kwik.cx → m3u8 (Playwright)
├── anime.ph.sh            # Standalone CLI downloader/streamer (bash)
└── .gitignore             # Excludes runtime cache & bytecode
```

> ⚠️ Runtime files `.cache/` (contains the cached `cf_clearance` cookie) and `__pycache__/` are **not** committed — they are regenerated automatically.

---

## 🖥️ Web app — `server.py`

A Flask backend that proxies AnimePahe through `curl_cffi` (Chrome TLS impersonation), decodes `kwik.cx` → `m3u8` streams, and re-proxies HLS segments so the browser player (hls.js) can play them with the correct `Referer`.

### Requirements

- **Python 3.10+** and `pip`
- **Docker** (used to run the FlareSolverr container for Cloudflare bypass)
- **Playwright** + Chromium (used by `playwright_helper.py` to decode kwik.cx)
- System packages: `sudo apt install -y curl jq`

### Install

```bash
# Python dependencies
pip install flask requests beautifulsoup4 curl_cffi playwright

# Browser for kwik.cx decoding
playwright install chromium

# FlareSolverr runs via Docker (auto-pulled on first request if missing)
docker --version   # confirm Docker is installed
```

### Run

```bash
python3 server.py
```

The server:
1. **Pre-warms** the Cloudflare `cf_clearance` cookie on startup (starts FlareSolverr if needed).
2. Serves the web app at **http://localhost:5050**.

Open the URL in a browser — you'll see "Latest Releases", can search, pick an anime, choose a quality/audio stream, and watch or download.

### API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Serves `index.html` |
| `GET /api/latest` | Latest airing anime |
| `GET /api/search?q=<query>` | Search anime by title |
| `GET /api/anime/<session>/episodes` | Episode list for an anime |
| `GET /api/play/<session>/<ep_session>` | Play-page data + decoded m3u8 streams |
| `GET /api/decode?url=<kwik_url>` | Decode a single kwik.cx URL → m3u8 (on demand) |
| `GET /api/stream?url=<m3u8>&referer=<ref>` | Proxy m3u8 playlists / `.ts` / `.m4s` / key segments (URLs rewritten through this proxy) |
| `GET /api/anime-list` | Full anime list from `/anime` page |

> Configuration lives at the top of `server.py` (`BASE_HOST`, FlareSolverr URL/port, server port).

---

## 🎬 CLI tool — `anime.ph.sh`

A single-file interactive terminal app: search anime, pick episodes, then show links, play with `mpv`/`vlc`, or download with `yt-dlp`.

### Requirements

- **Debian/Ubuntu** with `apt` (the script auto-installs everything else):
  `curl`, `jq`, `fzf`, **Docker**, **Node.js**, `yt-dlp`, Python3 + `curl_cffi` + `beautifulsoup4`. `mpv`/`vlc` are optional (needed for the *play* action).

### Usage

```bash
chmod +x anime.ph.sh
./anime.ph.sh
```

### What it does (interactive flow)

1. **Pre-flight** — checks/installs all dependencies.
2. **FlareSolverr** — ensures the Docker container is running (port `8191`).
3. **Search** — type an anime name, pick a result with `fzf`.
4. **Select episodes** —
   - `1` specific episode
   - `2` a range (e.g. `1-10`)
   - `3` latest episode
   - `4` interactive multi-select with `fzf`
5. **Choose an action** —
   - `1` Show kwik.cx player links
   - `2` Extract and show m3u8 HLS links
   - `3` Play with `mpv`/`vlc`/`ffplay`
   - `4` Download with `yt-dlp` (to `./downloads/<Anime_Title>/Episode_N.mp4`)
   - `5` All of the above

> 💡 The script embeds its own Python helper (written to `.anime_helper.py` at runtime and cleaned up on exit) which uses `curl_cffi` + Node.js to decode the kwik.cx obfuscated `eval()` scripts — no Playwright needed here.

---

## 🔥 How the Cloudflare bypass works

1. **FlareSolverr** (Docker, `ghcr.io/flaresolverr/flaresolverr`) solves the Cloudflare challenge and returns a `cf_clearance` cookie + browser User-Agent.
2. The cookie is **cached** to `.cache/cf_cookie.json` and reused across requests (re-minted automatically on `403`/failure).
3. All upstream requests are made with **`curl_cffi`** using Chrome TLS impersonation (`impersonate="chrome124"`).
4. kwik.cx pages are decoded to real `m3u8` URLs (Playwright in the web app; curl_cffi + Node.js in the CLI).
5. HLS segments/keys are proxied through `/api/stream` with the proper `Referer` so the browser player can fetch them without CORS/DRM issues.

---

## ⚠️ Disclaimer

This project is for **personal/educational use only**. It interacts with a third-party website (AnimePahe) and its stream hosts; respect their terms of service and applicable copyright law. Use at your own risk.
