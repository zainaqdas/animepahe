#!/usr/bin/env python3
"""
animeweb/server.py — Flask backend with Cloudflare bypass proxy

Provides API endpoints that proxy animepahe.pw through curl_cffi,
with m3u8 stream extraction and proxy for browser playback via hls.js.
"""

import atexit
import json
import os
import subprocess
import sys
import time
import re
from pathlib import Path
from urllib.parse import quote, urljoin

import requests as std_requests
from bs4 import BeautifulSoup
from curl_cffi import requests
from flask import Flask, jsonify, request, send_from_directory, Response

# ─── Config ────────────────────────────────────
BASE_HOST = "https://animepahe.pw"
FS_URL = "http://localhost:8191/v1"
CACHE_DIR = Path(__file__).parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)
COOKIE_FILE = CACHE_DIR / "cf_cookie.json"
FLARESOLVERR_NAME = "animeweb-flaresolverr"
_WE_STARTED_FLARE = False  # Track if we created the container

app = Flask(__name__)

# ─── Cookie Management ─────────────────────────

def load_cached_cookie():
    """Load cached cf_clearance cookie from disk"""
    try:
        if COOKIE_FILE.exists():
            return json.loads(COOKIE_FILE.read_text())
    except Exception:
        pass
    return None

def save_cached_cookie(cf, ua):
    COOKIE_FILE.write_text(json.dumps({"cf": cf, "ua": ua, "cached_at": time.time()}))

def mint_cookie_via_flaresolverr():
    """Start FlareSolverr, solve a challenge, extract cf_clearance + UA"""
    global _WE_STARTED_FLARE
    try:
        r = std_requests.get("http://localhost:8191/", timeout=5)
        if r.status_code != 200:
            raise Exception("FlareSolverr not ready")
    except Exception:
        _WE_STARTED_FLARE = True
        subprocess.run(
            ["docker", "run", "-d", "--rm",
             "--name", FLARESOLVERR_NAME,
             "-p", "8191:8191",
             "ghcr.io/flaresolverr/flaresolverr:latest"],
            capture_output=True, timeout=60,
        )
        for _ in range(15):
            try:
                r = std_requests.get("http://localhost:8191/", timeout=5)
                if r.status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(2)

    payload = {
        "cmd": "request.get",
        "url": f"{BASE_HOST}/api?m=search&q=naruto",
        "maxTimeout": 60000,
    }
    resp = std_requests.post(FS_URL, json=payload, timeout=90)
    data = resp.json()

    if data.get("status") != "ok":
        raise Exception(f"FlareSolverr failed: {data.get('message', 'unknown')}")

    solution = data["solution"]
    cf = None
    for c in solution.get("cookies", []):
        if c.get("name") == "cf_clearance":
            cf = c["value"]
            break

    ua = solution.get("userAgent", "")
    if not cf:
        raise Exception("No cf_clearance cookie in FlareSolverr response")

    save_cached_cookie(cf, ua)
    return cf, ua

def get_cookie():
    cached = load_cached_cookie()
    if cached:
        return cached["cf"], cached["ua"]
    return mint_cookie_via_flaresolverr()

# ─── HTTP Proxy (curl_cffi) ────────────────────

def proxy_get(url, cf=None, ua=None, referer=None):
    """Make a GET request through curl_cffi with cached cookie + retry"""
    if not cf or not ua:
        cf, ua = get_cookie()

    headers = {
        "User-Agent": ua,
        "Referer": referer or f"{BASE_HOST}/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    def _do():
        return requests.get(
            url, impersonate="chrome124",
            headers=headers,
            cookies={"cf_clearance": cf},
            timeout=30,
        )

    try:
        resp = _do()
    except Exception:
        cf, ua = mint_cookie_via_flaresolverr()
        headers["User-Agent"] = ua
        resp = _do()

    if resp.status_code == 403:
        cf, ua = mint_cookie_via_flaresolverr()
        headers["User-Agent"] = ua
        resp = _do()

    return resp

def extract_pre_json(html_text):
    """Extract JSON from FlareSolverr/API HTML wrapper"""
    soup = BeautifulSoup(html_text, "html.parser")
    pre = soup.find("pre")
    if pre:
        return json.loads(pre.text)
    try:
        return json.loads(html_text.strip())
    except Exception:
        return None

# ─── Kwik.cx → m3u8 Decoder (Playwright subprocess) ─

HELPER_SCRIPT = Path(__file__).parent / "playwright_helper.py"


def decode_kwik_to_m3u8(kwik_url):
    """
    Extract m3u8 URL from a kwik.cx page by running Playwright in a subprocess.
    This avoids thread-safety issues with Playwright's sync API in Flask's
    threaded request handling.
    """
    try:
        result = subprocess.run(
            [sys.executable, str(HELPER_SCRIPT), kwik_url],
            capture_output=True, text=True, timeout=35,
        )
        url = result.stdout.strip()
        if url:
            return url
        if result.stderr:
            print(f"  ⚠️ Playwright helper stderr: {result.stderr[:200]}")
    except subprocess.TimeoutExpired as te:
        if te.process:
            te.process.kill()
        print(f"  ⚠️ Playwright helper timed out for {kwik_url[:50]}...")
    except Exception as e:
        print(f"  ⚠️ Playwright helper failed: {e}")

    return None

# ─── Flask Routes ──────────────────────────────

@app.route("/")
def index():
    return send_from_directory(Path(__file__).parent, "index.html")

@app.route("/api/latest")
def api_latest():
    cf, ua = get_cookie()
    resp = proxy_get(f"{BASE_HOST}/api?m=airing&page=1", cf, ua)
    if resp.status_code != 200:
        return jsonify({"error": "Failed to fetch latest", "status": resp.status_code}), 502
    data = extract_pre_json(resp.text)
    if not data:
        return jsonify({"error": "Failed to parse response"}), 502
    return jsonify(data)

@app.route("/api/search")
def api_search():
    q = request.args.get("q", "")
    if not q:
        return jsonify({"error": "Query parameter 'q' is required"}), 400
    cf, ua = get_cookie()
    resp = proxy_get(f"{BASE_HOST}/api?m=search&q={q.replace(' ', '%20')}", cf, ua)
    if resp.status_code != 200:
        return jsonify({"error": "Search failed", "status": resp.status_code}), 502
    data = extract_pre_json(resp.text)
    return jsonify(data or {"total": 0, "data": []})

@app.route("/api/anime/<session>/episodes")
def api_episodes(session):
    cf, ua = get_cookie()
    all_eps = []
    page = 1
    while True:
        url = f"{BASE_HOST}/api?m=release&id={session}&sort=episode_asc&page={page}"
        resp = proxy_get(url, cf, ua)
        if resp.status_code != 200:
            break
        data = extract_pre_json(resp.text)
        if not data or not data.get("data"):
            break
        all_eps.extend(data["data"])
        last_page = data.get("last_page", 1)
        if page >= last_page:
            break
        page += 1
    return jsonify({"total": len(all_eps), "episodes": all_eps})

@app.route("/api/play/<session>/<ep_session>")
def api_play(session, ep_session):
    """Get play page data with m3u8 stream URLs decoded from kwik.cx"""
    cf, ua = get_cookie()
    url = f"{BASE_HOST}/play/{session}/{ep_session}"
    resp = proxy_get(url, cf, ua)

    if resp.status_code != 200:
        return jsonify({"error": "Failed to fetch play page"}), 502

    soup = BeautifulSoup(resp.text, "html.parser")

    # Extract anime info
    title_tag = soup.find("h1")
    anime_title = ""
    episode_num = ""
    if title_tag:
        text = title_tag.get_text(strip=True)
        parts = text.rsplit(" - ", 1)
        anime_title = parts[0] if len(parts) > 1 else text
        episode_num = parts[1] if len(parts) > 1 else ""

    poster_img = soup.select_one(".anime-poster img")
    poster = poster_img.get("src", "") if poster_img else ""

    status_el = soup.select_one(".anime-status")
    status = status_el.get_text(strip=True) if status_el else ""

    season_el = soup.select_one(".anime-season")
    season = season_el.get_text(strip=True) if season_el else ""

    # Extract stream options (kwik URLs)
    buttons = soup.find_all("button", attrs={"data-src": True, "data-av1": "0"})
    streams = []
    for b in buttons:
        streams.append({
            "quality": b.get("data-resolution", "0"),
            "audio": b.get("data-audio", "unknown"),
            "url": b.get("data-src", ""),
            "fansub": b.get("data-fansub", ""),
            "m3u8": None,  # Filled in below
        })
    streams.sort(key=lambda s: int(s["quality"]) if s["quality"].isdigit() else 0, reverse=True)

    # Decode m3u8 URLs — decode the first (best) stream
    # Others decoded on-demand via /api/decode endpoint
    for s in streams[:1]:
        m3u8_url = decode_kwik_to_m3u8(s["url"])
        if m3u8_url:
            s["m3u8"] = m3u8_url

    # Download links
    download_links = []
    for a in soup.select("#pickDownload a"):
        download_links.append({
            "url": a.get("href", ""),
            "label": a.get_text(strip=True),
        })

    # Episode navigation
    episodes = []
    for a in soup.select("#scrollArea a"):
        href = a.get("href", "")
        parts = href.strip("/").split("/")
        ep_sessions = parts[-2:] if len(parts) >= 2 else ["", ""]
        episodes.append({
            "number": a.get_text(strip=True).replace("Episode ", ""),
            "anime_session": ep_sessions[0] if len(ep_sessions) > 0 else "",
            "episode_session": ep_sessions[1] if len(ep_sessions) > 1 else "",
            "active": "active" in a.get("class", []),
        })

    return jsonify({
        "anime_title": anime_title,
        "episode_num": episode_num,
        "poster": poster,
        "status": status,
        "season": season,
        "streams": streams,
        "downloads": download_links,
        "episodes": episodes,
        "anime_session": session,
    })

@app.route("/api/decode")
def api_decode():
    """Decode a single kwik.cx URL to its m3u8 stream URL (on-demand)"""
    kwik_url = request.args.get("url", "")
    if not kwik_url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    m3u8_url = decode_kwik_to_m3u8(kwik_url)
    return jsonify({"m3u8": m3u8_url or ""})

@app.route("/api/stream", methods=["GET", "OPTIONS"])
def api_stream():
    """
    Proxy CDN stream requests through our backend with correct Referer.

    Handles:
    - .m3u8 playlists (rewrites segment URLs to go through this proxy)
    - .ts video segments
    - .m4s / .mp4 segments (for fMP4)
    - Sets CORS headers so hls.js can consume them
    """
    url = request.args.get("url", "")
    ref = request.args.get("referer", "https://kwik.cx/")
    if not url:
        return "Missing url parameter", 400

    # Debug log
    req_type = "m3u8" if ".m3u8" in url else "key" if "mon.key" in url else "seg" if ".jpg" in url else "other"
    print(f"  [stream] {req_type}: {url[-60:]}")

    # Handle protocol-relative URLs
    if url.startswith("//"):
        url = "https:" + url

    resp = proxy_get(url, referer=ref)
    if resp.status_code != 200:
        print(f"    ❌ proxy_get returned {resp.status_code} for {req_type}")
        return f"Failed: HTTP {resp.status_code}", resp.status_code
    print(f"    ✅ proxy_get OK: {len(resp.content)} bytes")

    # Also verify key data
    if "mon.key" in url:
        print(f"    key hex: {resp.content.hex()}")
        if len(resp.content) == 16:
            print(f"    ✅ valid 16-byte AES-128 key")
        else:
            print(f"    ⚠️ key is {len(resp.content)} bytes, expected 16")

    # Detect content type from URL
    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    # Override content type for known stream file extensions
    # (segments use .jpg as obfuscation, keys are .key or .bin)
    lower_url = url.lower()
    if lower_url.endswith(".m3u8"):
        content_type = "application/vnd.apple.mpegurl"
    elif lower_url.endswith(".ts"):
        content_type = "video/MP2T"
    elif lower_url.endswith(".m4s") or lower_url.endswith(".mp4"):
        content_type = "video/mp4"
    elif lower_url.endswith(".jpg") or lower_url.endswith(".jpeg"):
        # .jpg segments are obfuscated MPEG-TS video
        content_type = "video/MP2T"
    elif "mon.key" in lower_url or lower_url.endswith(".key") or lower_url.endswith(".bin"):
        content_type = "application/octet-stream"

    body = resp.content
    # If it's an m3u8 playlist, rewrite segment/variant/key URLs to go through our proxy
    if ".m3u8" in url or "mpegurl" in content_type:
        try:
            text = resp.text

            def _proxy_url(u):
                """Wrap a URL into our proxy URL format"""
                # Resolve relative URLs against the original m3u8 URL
                if not u.startswith("http://") and not u.startswith("https://"):
                    u = urljoin(url, u)
                return f"/api/stream?url={quote(u)}&referer={quote(ref)}"

            # Pass 1: Rewrite non-# lines (segment URLs, variant playlist URLs)
            def _rewrite_line(m):
                u = m.group(1).strip()
                if not u.startswith("#") and u:
                    return _proxy_url(u)
                return m.group(0)
            text = re.sub(r'^(?!\s*#)(\S+)', _rewrite_line, text, flags=re.MULTILINE)

            # Pass 2: Rewrite URI="..." inside #EXT-X-KEY lines (decryption keys)
            def _rewrite_uri(m):
                inner = m.group(1)
                return f'URI="{_proxy_url(inner)}"'
            text = re.sub(r'URI="([^"]+)"', _rewrite_uri, text)

            body = text.encode("utf-8")
            content_type = "application/vnd.apple.mpegurl"
        except Exception as e:
            print(f"  ⚠️ m3u8 rewrite failed: {e}")
            # Fall through with original body


    # Handle CORS preflight
    if request.method == "OPTIONS":
        resp_opt = Response(status=200)
        resp_opt.headers["Access-Control-Allow-Origin"] = "*"
        resp_opt.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        resp_opt.headers["Access-Control-Allow-Headers"] = "*"
        return resp_opt

    flask_resp = Response(body, status=200)
    flask_resp.headers["Content-Type"] = content_type
    flask_resp.headers["Access-Control-Allow-Origin"] = "*"
    flask_resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    flask_resp.headers["Access-Control-Allow-Headers"] = "*"
    # Cache stream responses for 1 hour to avoid re-proxying every segment
    flask_resp.headers["Cache-Control"] = "public, max-age=3600"
    return flask_resp

@app.route("/api/anime-list")
def api_anime_list():
    cf, ua = get_cookie()
    resp = proxy_get(f"{BASE_HOST}/anime", cf, ua)
    if resp.status_code != 200:
        return jsonify({"error": "Failed to fetch anime list"}), 502
    soup = BeautifulSoup(resp.text, "html.parser")
    anime_list = []
    for a_tag in soup.select('a[href*="/anime/"]'):
        href = a_tag.get("href", "")
        slug = href.strip("/").split("/")[-1]
        title = a_tag.get_text(strip=True)
        if slug and title:
            anime_list.append({"session": slug, "title": title})
    return jsonify({"total": len(anime_list), "data": anime_list})

# ─── Cleanup ───────────────────────────────────

@atexit.register
def cleanup():
    if _WE_STARTED_FLARE:
        subprocess.run(
            ["docker", "stop", FLARESOLVERR_NAME],
            capture_output=True, timeout=30,
        )
    # (playwright_helper.py subprocess handles its own cleanup)

# ─── Main ──────────────────────────────────────

if __name__ == "__main__":
    print("🔄 Pre-warming cf_clearance cookie...")
    try:
        cf, ua = get_cookie()
        print(f"✅ Cookie cached: {cf[:20]}...")
    except Exception as e:
        print(f"⚠️ Cookie pre-warm failed: {e}")
        print("⚠️ The first request will be slow (FlareSolverr needs to start)")

    print(f"\n🚀 Server running at http://localhost:5050")
    app.run(host="0.0.0.0", port=5050, debug=False)
