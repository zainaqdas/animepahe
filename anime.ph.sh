#!/usr/bin/env bash
#
# anime.ph.sh — One-stop anime downloader for AnimePahe
#
# Features:
#   • Auto-installs dependencies (Docker, FlareSolverr, curl_cffi, Node.js, yt-dlp)
#   • Interactive anime search with fzf
#   • Extracts kwik.cx → m3u8 HLS links
#   • Play with mpv/vlc, show URL, or download with yt-dlp
#
# Usage:
#   chmod +x anime.ph.sh && ./anime.ph.sh
#

set -uo pipefail

# We manage errors explicitly — critical pipelines that must succeed use
# the fail() helper. Non-critical failures are caught with || true guards.

# ──────────────────────────────────────────────
# Color helpers
# ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

info()  { printf "${GREEN}[INFO]${NC} %b\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC} %b\n" "$*"; }
error() { printf "${RED}[ERROR]${NC} %b\n" "$*" >&2; }
header(){ printf "\n${BOLD}${BLUE}════════════════════════════════════════════════════════${NC}\n"; }
subheader(){ printf "${CYAN}── %b${NC}\n" "$*"; }

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
BASE_HOST="https://animepahe.pw"
FS_PORT="8191"
FS_URL="http://localhost:${FS_PORT}/v1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Python helper script path — embedded below
PY_HELPER="$SCRIPT_DIR/.anime_helper.py"

# Fail with message
fail() {
    error "$*"
    exit 1
}

# ──────────────────────────────────────────────
# 1. PRE-FLIGHT — Dependency check & install
# ──────────────────────────────────────────────
check_prereqs() {
    header
    echo -e "${BOLD}  ⚡ Anime.ph.sh — Pre-flight Check${NC}"
    header

    local missing=0

    # --- apt update first ---
    if ! command -v apt &>/dev/null; then
        error "This script requires apt (Debian/Ubuntu). Unsupported OS."
        exit 1
    fi

    # --- curl ---
    if ! command -v curl &>/dev/null; then
        warn "curl not found, installing..."
        sudo apt install -y curl 2>/dev/null || { error "Failed to install curl"; missing=1; }
    fi
    info "✓ curl $(curl --version | head -1 | awk '{print $2}')"

    # --- jq ---
    if ! command -v jq &>/dev/null; then
        warn "jq not found, installing..."
        sudo apt install -y jq 2>/dev/null || { error "Failed to install jq"; missing=1; }
    fi
    info "✓ jq $(jq --version 2>/dev/null || echo 'installed')"

    # --- fzf ---
    if ! command -v fzf &>/dev/null; then
        warn "fzf not found, installing..."
        sudo apt install -y fzf 2>/dev/null || { error "Failed to install fzf"; missing=1; }
    fi
    info "✓ fzf $(fzf --version 2>/dev/null || echo 'installed')"

    # --- Docker ---
    if ! command -v docker &>/dev/null; then
        warn "Docker not found, installing..."
        curl -fsSL https://get.docker.com | sudo sh 2>&1 | tail -3
        sudo usermod -aG docker "$USER" 2>/dev/null || true
        # Re-check
        if ! command -v docker &>/dev/null; then
            error "Docker installation failed. Install manually: https://docs.docker.com/engine/install/"
            missing=1
        fi
    fi
    info "✓ Docker $(docker --version | awk '{print $3}' | tr -d ',')"

    # --- Node.js ---
    if ! command -v node &>/dev/null; then
        warn "Node.js not found, installing..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3
        sudo apt install -y nodejs 2>/dev/null || { error "Failed to install Node.js"; missing=1; }
    fi
    info "✓ Node.js $(node --version)"

    # --- yt-dlp ---
    if ! command -v yt-dlp &>/dev/null; then
        warn "yt-dlp not found, installing via pip..."
        pip3 install yt-dlp 2>&1 | tail -1
        if ! command -v yt-dlp &>/dev/null; then
            warn "pip3 install failed, trying standalone..."
            sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp 2>/dev/null
            sudo chmod +x /usr/local/bin/yt-dlp 2>/dev/null || true
        fi
    fi
    if command -v yt-dlp &>/dev/null; then
        info "✓ yt-dlp $(yt-dlp --version 2>/dev/null || echo 'installed')"
    else
        error "yt-dlp installation failed"
        missing=1
    fi

    # --- Python3 & pip ---
    if ! command -v python3 &>/dev/null; then
        warn "Python3 not found, installing..."
        sudo apt install -y python3 python3-pip 2>/dev/null || { error "Failed to install Python3"; missing=1; }
    fi
    info "✓ Python3 $(python3 --version | awk '{print $2}')"

    # --- curl_cffi (Python) ---
    if ! python3 -c "from curl_cffi import requests" 2>/dev/null; then
        warn "curl_cffi not found, installing..."
        pip3 install curl_cffi 2>&1 | tail -1
    fi
    if python3 -c "from curl_cffi import requests" 2>/dev/null; then
        info "✓ curl_cffi (Python)"
    else
        error "curl_cffi installation failed"
        missing=1
    fi

    # --- beautifulsoup4 ---
    if ! python3 -c "from bs4 import BeautifulSoup" 2>/dev/null; then
        warn "beautifulsoup4 not found, installing..."
        pip3 install beautifulsoup4 2>&1 | tail -1
    fi
    info "✓ beautifulsoup4"

    # --- mpv / vlc (optional, for playback) ---
    MPV_AVAILABLE=false
    VLC_AVAILABLE=false
    command -v mpv &>/dev/null && MPV_AVAILABLE=true && info "✓ mpv available"
    command -v vlc &>/dev/null 2>&1 || command -v cvlc &>/dev/null 2>&1 && VLC_AVAILABLE=true && info "✓ vlc available"
    if ! $MPV_AVAILABLE && ! $VLC_AVAILABLE; then
        warn "Neither mpv nor vlc found. Install for playback: sudo apt install mpv vlc"
    fi

    if [ "$missing" -ne 0 ]; then
        error "Missing dependencies, cannot continue"
        exit 1
    fi

    echo
    info "All prerequisites satisfied!"
    echo
}

# ──────────────────────────────────────────────
# 2. Docker / FlareSolverr management
# ──────────────────────────────────────────────
ensure_flaresolverr() {
    header
    echo -e "${BOLD}  🔥 FlareSolverr${NC}"
    header

    # Check if Docker daemon is running
    if ! docker info &>/dev/null; then
        warn "Docker daemon not running. Attempting to start..."
        sudo systemctl enable --now docker 2>/dev/null || {
            error "Cannot start Docker. Try: sudo systemctl start docker"
            exit 1
        }
        sleep 2
    fi

    # Check if FlareSolverr container exists
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^flaresolverr$'; then
        local status
        status=$(docker inspect --format='{{.State.Status}}' flaresolverr 2>/dev/null)
        if [ "$status" = "running" ]; then
            info "✓ FlareSolverr already running (port ${FS_PORT})"
            return 0
        else
            info "Starting existing FlareSolverr container..."
            docker start flaresolverr 2>&1 | tail -1
            sleep 3
        fi
    else
        info "Pulling and starting FlareSolverr (first run)..."
        docker run -d --name flaresolverr \
            -p "${FS_PORT}:8191" \
            --restart unless-stopped \
            ghcr.io/flaresolverr/flaresolverr:latest 2>&1 | tail -1
        sleep 4
    fi

    # Verify it's running
    local retries=5
    local i=0
    while [ $i -lt $retries ]; do
        if curl -sf "http://localhost:${FS_PORT}/" >/dev/null 2>&1; then
            local version
            version=$(curl -sf "http://localhost:${FS_PORT}/" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','?'))" 2>/dev/null || echo '?')
            info "✓ FlareSolverr v${version} ready on port ${FS_PORT}"
            return 0
        fi
        i=$((i + 1))
        sleep 2
    done

    error "FlareSolverr failed to start. Check: docker logs flaresolverr"
    exit 1
}

# ──────────────────────────────────────────────
# 3. Helper: make request through FlareSolverr
# ──────────────────────────────────────────────
fs_request() {
    local url="$1"
    local max_timeout="${2:-60000}"

    curl -sf -X POST "$FS_URL" \
        -H "Content-Type: application/json" \
        -d "{\"cmd\":\"request.get\",\"url\":\"${url}\",\"maxTimeout\":${max_timeout}}" 2>/dev/null
}

# ──────────────────────────────────────────────
# 4. Generate Python helper script
# ──────────────────────────────────────────────
generate_py_helper() {
    cat > "$PY_HELPER" << 'PYEOF'
#!/usr/bin/env python3
"""
Anime.ph.sh Python helper — extracts m3u8 URLs from kwik.cx pages
Uses curl_cffi for Chrome TLS impersonation + Node.js for JS eval decoding
"""
import sys, json, re, subprocess
from bs4 import BeautifulSoup
from curl_cffi import requests

KWIK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Referer": "https://animepahe.pw/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

def extract_m3u8(script_text):
    """Decode eval'd JS to extract m3u8 URL"""
    if not script_text:
        return None
    modified = script_text.replace("eval(", "console.log(")
    try:
        p = subprocess.run(["node", "-e", modified],
                          capture_output=True, text=True, timeout=15)
        output = p.stdout + p.stderr
        # Try multiple patterns — NOTE: all patterns return the FULL URL
        # including the .m3u8 suffix; do NOT append another .m3u8
        for pat in [
            r"const source='([^']+\.m3u8)",
            r'const source="([^"]+\.m3u8)"',
            r"source\s*[:=]\s*['\"]([^'\"]+\.m3u8)['\"]",
            r'(https?://[^\s"\'<]+\.m3u8)',
        ]:
            m = re.search(pat, output)
            if m:
                url = m.group(1)
                if not url.startswith("http"):
                    url = "https:" + url if url.startswith("//") else url
                return url
        return None
    except Exception as e:
        print(f"NODE_ERR: {e}", file=sys.stderr)
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: resolve_kwik <kwik_url>", file=sys.stderr)
        sys.exit(1)

    kwik_url = sys.argv[1]

    # Fetch kwik.cx page with curl_cffi (Chrome TLS impersonation)
    try:
        resp = requests.get(kwik_url, impersonate="chrome124",
                            headers=KWIK_HEADERS, timeout=30)
    except Exception as e:
        print(json.dumps({"error": f"curl_cffi failed: {e}"}))
        sys.exit(1)

    if resp.status_code != 200:
        print(json.dumps({"error": f"HTTP {resp.status_code}"}))
        sys.exit(1)

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    # Extract video title and detect quality
    title_tag = soup.find("title")
    video_title = title_tag.text.strip() if title_tag else "unknown"

    # Find eval script
    scripts = soup.find_all("script")
    m3u8_url = None
    for script in scripts:
        text = script.string or ""
        if "eval(" in text:
            m3u8_url = extract_m3u8(text)
            if m3u8_url:
                break

    if m3u8_url:
        result = {
            "status": "ok",
            "title": video_title,
            "m3u8_url": m3u8_url,
            "kwik_url": kwik_url,
        }
    else:
        # Fallback: look for any m3u8 in raw HTML
        m = re.search(r'(https?://[^\s"\'<]+\.m3u8)', html)
        if m:
            result = {"status": "ok", "title": video_title,
                      "m3u8_url": m.group(1), "kwik_url": kwik_url}
        else:
            result = {"status": "error", "error": "No m3u8 found",
                      "html_snippet": html[:300]}

    print(json.dumps(result))


if __name__ == "__main__":
    main()
PYEOF
    chmod +x "$PY_HELPER"
}

# ──────────────────────────────────────────────
# 5. Search anime via FlareSolverr
# ──────────────────────────────────────────────
search_anime() {
    local query="$1"
    local url="${BASE_HOST}/api?m=search&q=${query// /%20}"

    fs_request "$url" 60000 | python3 -c "
import sys, json
try:
    # FlareSolverr wraps response in HTML <pre> tag
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(sys.stdin.read(), 'html.parser')
    pre = soup.find('pre')
    if pre:
        data = json.loads(pre.text)
    else:
        data = json.loads(sys.stdin.read())
    print(json.dumps(data))
except Exception as e:
    print(json.dumps({'error': str(e)}))
" 2>/dev/null
}

# ──────────────────────────────────────────────
# 6. Fetch episodes
# ──────────────────────────────────────────────
fetch_episodes() {
    local session="$1"
    local all_eps="[]"
    local page=1
    local last_page=1

    while [ "$page" -le "$last_page" ]; do
        local url="${BASE_HOST}/api?m=release&id=${session}&sort=episode_asc&page=${page}"
        local result
        result=$(fs_request "$url" 60000 | python3 -c "
import sys, json
from bs4 import BeautifulSoup
soup = BeautifulSoup(sys.stdin.read(), 'html.parser')
pre = soup.find('pre')
if pre:
    print(pre.text)
else:
    print('{}')
" 2>/dev/null)

        local parsed
        parsed=$(echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('data'):
    print(json.dumps({'data': d['data'], 'last_page': d.get('last_page', 1)}))
else:
    print(json.dumps({'data': [], 'last_page': 1}))
" 2>/dev/null)

        last_page=$(echo "$parsed" | python3 -c "import sys,json; print(json.load(sys.stdin).get('last_page',1))" 2>/dev/null || echo "1")

        if [ "$page" -eq 1 ]; then
            all_eps=$(echo "$parsed" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "[]")
        else
            local new_eps
            new_eps=$(echo "$parsed" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "[]")
            all_eps=$(echo "$all_eps" "$new_eps" | python3 -c "
import sys, json
a, b = [json.loads(x) for x in sys.stdin.read().split()]
print(json.dumps(a + b))
" 2>/dev/null || echo "$all_eps")
        fi

        page=$((page + 1))
    done

    echo "$all_eps"
}

# ──────────────────────────────────────────────
# 7. Get kwik.cx URLs from play page
# ──────────────────────────────────────────────
get_stream_urls() {
    local anime_session="$1"
    local ep_session="$2"
    local url="${BASE_HOST}/play/${anime_session}/${ep_session}"

    fs_request "$url" 60000 | python3 -c "
import sys, json
from bs4 import BeautifulSoup

soup = BeautifulSoup(sys.stdin.read(), 'html.parser')
buttons = soup.find_all('button', attrs={'data-src': True, 'data-av1': '0'})

streams = []
for b in buttons:
    q = b.get('data-resolution') or '0'
    a = b.get('data-audio') or 'unknown'
    u = b.get('data-src') or ''
    streams.append({'quality': q, 'audio': a, 'url': u})

# Sort by quality descending
streams.sort(key=lambda s: int(s['quality']) if s['quality'].isdigit() else 0, reverse=True)
print(json.dumps(streams))
" 2>/dev/null
}

# ──────────────────────────────────────────────
# 8. Resolve kwik.cx → m3u8 using Python helper
# ──────────────────────────────────────────────
resolve_kwik_url() {
    local kwik_url="$1"
    python3 "$PY_HELPER" "$kwik_url" 2>/dev/null
}

# ──────────────────────────────────────────────
# 9. Detect media players
# ──────────────────────────────────────────────
detect_player() {
    if command -v mpv &>/dev/null; then
        echo "mpv"
    elif command -v cvlc &>/dev/null; then
        echo "vlc"
    elif    command -v vlc &>/dev/null 2>&1; then
        echo "vlc"
    elif command -v ffplay &>/dev/null; then
        echo "ffplay"
    else
        echo ""
    fi
}

# ──────────────────────────────────────────────
# 10. Main interactive flow
# ──────────────────────────────────────────────
main() {
    # Splash
    clear
    echo -e "${BOLD}${MAGENTA}"
    echo '    ╔═══════════════════════════════════════════╗'
    echo '    ║        🎬 anime.ph.sh — v1.0             ║'
    echo '    ║    AnimePahe Downloader & Streamer        ║'
    echo '    ╚═══════════════════════════════════════════╝'
    echo -e "${NC}"

    # Step 1: Pre-flight
    check_prereqs

    # Step 2: Generate Python helper
    generate_py_helper

    # Step 3: FlareSolverr
    ensure_flaresolverr

    # Step 4: Search
    header
    echo -e "${BOLD}  🔍 Search Anime${NC}"
    header
    echo
    read -r -p "$(echo -e "${CYAN}Enter anime name: ${NC}")" search_query
    [ -z "$search_query" ] && search_query="naruto"
    echo

    info "Searching for \"${search_query}\"..."
    search_result=$(search_anime "$search_query") || fail "Failed to search anime"
    local total
    total=$(echo "$search_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null || echo "0")

    if [ "$total" -eq 0 ]; then
        error "No results found. Try a different name."
        exit 1
    fi

    info "Found ${total} results."
    echo

    # Use fzf for selection
    local selected_line
    selected_line=$(echo "$search_result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('data', []):
    season = r.get('season', '')
    year = r.get('year', '')
    eps = r.get('episodes', '?')
    status = r.get('status', '')
    print(f\"[{r['session']}] {r['title']} ({year}) — {eps}eps, {season} [{status}]\")
" 2>/dev/null | fzf --height=15 --prompt="Select anime > " --header="Results for: ${search_query}" 2>/dev/null || true)

    if [ -z "$selected_line" ]; then
        error "No anime selected."
        exit 1
    fi

    # Extract session and title
    local anime_session anime_title
    anime_session=$(echo "$selected_line" | awk -F'[][]' '{print $2}')
    anime_title=$(echo "$selected_line" | sed -E 's/^\[[^]]+\] //' | sed -E 's/ \([0-9]{4}\).*//')

    echo
    info "Selected: ${BOLD}${anime_title}${NC} (session: ${anime_session})"

    # Step 5: Fetch episodes
    echo
    subheader "Fetching episodes..."
    episodes_json=$(fetch_episodes "$anime_session") || fail "Failed to fetch episodes"
    local ep_count
    ep_count=$(echo "$episodes_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

    if [ "$ep_count" -eq 0 ]; then
        error "No episodes found for this anime."
        exit 1
    fi

    # Get episode range
    local ep_min ep_max
    ep_min=$(echo "$episodes_json" | python3 -c "import sys,json; e=json.load(sys.stdin); print(min(int(x['episode']) for x in e))" 2>/dev/null || echo "1")
    ep_max=$(echo "$episodes_json" | python3 -c "import sys,json; e=json.load(sys.stdin); print(max(int(x['episode']) for x in e))" 2>/dev/null || echo "$ep_count")

    info "${anime_title} has ${BOLD}${ep_count}${NC} episodes (${ep_min}–${ep_max})"
    echo

    # Episode selection
    echo -e "${CYAN}Select episode(s):${NC}"
    echo "  1. Pick a specific episode"
    echo "  2. Pick a range (e.g. 1-10)"
    echo "  3. Single episode (latest)"
    echo "  4. Interactive fzf multi-select"
    read -r -p "$(echo -e "${YELLOW}Choice [1-4]:${NC} ")" ep_choice

    local selected_episodes=""

    case "$ep_choice" in
        2)
            read -r -p "Enter range (e.g. 1-10): " ep_range
            local start_ep end_ep
            start_ep=$(echo "$ep_range" | cut -d'-' -f1)
            end_ep=$(echo "$ep_range" | cut -d'-' -f2)
            selected_episodes=$(seq "$start_ep" "$end_ep" | tr '\n' ',' | sed 's/,$//')
            ;;
        3)
            selected_episodes="$ep_max"
            info "Selected latest episode: ${ep_max}"
            ;;
        4)
            local fzf_sel
            fzf_sel=$(echo "$episodes_json" | python3 -c "
import sys, json
eps = json.load(sys.stdin)
for e in eps:
    num = e['episode']
    sess = e['session'][:8]
    print(f'Episode {num} [{sess}]')
" 2>/dev/null | fzf --multi --height=20 --prompt="Select episodes (Tab to multi-select) > " 2>/dev/null || true)
            if [ -n "$fzf_sel" ]; then
                selected_episodes=$(echo "$fzf_sel" | grep -oP 'Episode \K[0-9]+' | sort -n | tr '\n' ',' | sed 's/,$//')
            fi
            ;;
        *)
            read -r -p "Enter episode number [${ep_min}-${ep_max}]: " ep_single
            selected_episodes="${ep_single:-$ep_min}"
            ;;
    esac

    if [ -z "$selected_episodes" ]; then
        warn "No episodes selected. Using first episode."
        selected_episodes="$ep_min"
    fi

    info "Selected episodes: ${selected_episodes}"
    echo

    # Step 6: Action selection
    header
    echo -e "${BOLD}  📋 Actions${NC}"
    header
    echo "  1. 🔗 Show kwik.cx player links"
    echo "  2. 🎬 Extract and show m3u8 HLS links"
    echo "  3. ▶️  Play with media player (mpv/vlc)"
    echo "  4. ⬇️  Download with yt-dlp"
    echo "  5. All of the above"
    read -r -p "$(echo -e "${YELLOW}Choice [1-5]:${NC} ")" action_choice
    echo

    # Process each selected episode
    IFS=',' read -ra EP_ARRAY <<< "$selected_episodes"

    for ep_num in "${EP_ARRAY[@]}"; do
        ep_num=$(echo "$ep_num" | xargs)  # trim whitespace

        # Get episode session from JSON
        local ep_session
        ep_session=$(echo "$episodes_json" | python3 -c "
import sys, json
eps = json.load(sys.stdin)
for e in eps:
    if int(e['episode']) == $ep_num:
        print(e['session'])
        break
" 2>/dev/null)

        [ -z "$ep_session" ] && { warn "Episode ${ep_num}: session not found, skipping"; continue; }

        echo
        subheader "Episode ${ep_num} (session: ${ep_session:0:8}...)"

        # Get kwik.cx URLs
        info "Fetching stream URLs..."
        streams_json=$(get_stream_urls "$anime_session" "$ep_session")
        local stream_count
        stream_count=$(echo "$stream_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

        if [ "$stream_count" -eq 0 ]; then
            warn "No streams found for Episode ${ep_num}"
            continue
        fi

        # Show available streams
        echo
        echo -e "${DIM}Available streams:${NC}"
        local i=0
        local best_url=""
        local best_quality=""
        while [ $i -lt "$stream_count" ]; do
            local sq sa su
            sq=$(echo "$stream_json" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['quality'])" 2>/dev/null)
            sa=$(echo "$stream_json" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['audio'])" 2>/dev/null)
            su=$(echo "$stream_json" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['url'])" 2>/dev/null)
            echo "  [$((i+1))] ${sq}p (${sa})"
            if [ $i -eq 0 ]; then
                best_url="$su"
                best_quality="${sq}p"
            fi
            i=$((i+1))
        done

        # Auto-pick best quality (first = highest)
        if [ "$stream_count" -gt 1 ]; then
            echo
            read -r -p "$(echo -e "${YELLOW}Select stream [1-${stream_count}, default=1]:${NC} ")" stream_choice
            stream_choice="${stream_choice:-1}"
            best_url=$(echo "$stream_json" | python3 -c "import sys,json; print(json.load(sys.stdin)[$((stream_choice-1))]['url'])" 2>/dev/null)
            best_quality=$(echo "$stream_json" | python3 -c "import sys,json; print(json.load(sys.stdin)[$((stream_choice-1))]['quality'] + 'p')" 2>/dev/null)
        fi

        echo
        info "Using ${best_quality} stream"

        # Show kwik link (Action 1)
        if [ "$action_choice" = "1" ] || [ "$action_choice" = "5" ]; then
            echo
            subheader "🔗 kwik.cx Link"
            echo -e "${CYAN}${best_url}${NC}"
        fi

        # Extract m3u8 (Action 2,3,4,5)
        if [ "$action_choice" = "2" ] || [ "$action_choice" = "3" ] || [ "$action_choice" = "4" ] || [ "$action_choice" = "5" ]; then
            info "Resolving m3u8 HLS URL from kwik.cx..."
            local resolve_result
            resolve_result=$(resolve_kwik_url "$best_url")

            local resolve_status
            resolve_status=$(echo "$resolve_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','error'))" 2>/dev/null)

            if [ "$resolve_status" = "ok" ]; then
                local m3u8_url
                m3u8_url=$(echo "$resolve_result" | python3 -c "import sys,json; print(json.load(sys.stdin)['m3u8_url'])" 2>/dev/null)

                # Show m3u8 link (Action 2)
                if [ "$action_choice" = "2" ] || [ "$action_choice" = "5" ]; then
                    echo
                    subheader "🎬 m3u8 HLS Link"
                    echo -e "${GREEN}${m3u8_url}${NC}"
                fi

                # Play (Action 3)
                if [ "$action_choice" = "3" ] || [ "$action_choice" = "5" ]; then
                    local player
                    player=$(detect_player)
                    if [ -n "$player" ]; then
                        echo
                        subheader "▶️  Playing with ${player}..."
                        if [ "$player" = "mpv" ]; then
                            mpv --title="${anime_title} - Episode ${ep_num}" \
                                --http-header-fields="Referer: https://kwik.cx/" \
                                --user-agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
                                --cache=yes \
                                "$m3u8_url" &
                        elif [ "$player" = "vlc" ] || [ "$player" = "cvlc" ]; then
                            cvlc --meta-title "${anime_title} - Episode ${ep_num}" \
                                --http-referer="https://kwik.cx/" \
                                "$m3u8_url" &
                        elif [ "$player" = "ffplay" ]; then
                            ffplay -window_title "${anime_title} - Episode ${ep_num}" \
                                -referer "https://kwik.cx/" \
                                "$m3u8_url" &
                        fi
                        info "Launched ${player} — adjust volume/window as needed"
                        sleep 1
                    else
                        warn "No media player found. Install mpv: sudo apt install mpv"
                    fi
                fi

                # Download (Action 4)
                if [ "$action_choice" = "4" ] || [ "$action_choice" = "5" ]; then
                    local dl_dir="${SCRIPT_DIR}/downloads/${anime_title// /_}"
                    mkdir -p "$dl_dir"
                    local output="${dl_dir}/Episode_${ep_num}.mp4"
                    echo
                    subheader "⬇️  Downloading Episode ${ep_num}..."
                    echo -e "${DIM}Destination: ${output}${NC}"
                    echo

                    yt-dlp --impersonate chrome \
                        --referer "https://kwik.cx/" \
                        --no-warnings \
                        -N 4 \
                        -o "$output" \
                        "$m3u8_url" 2>&1 | tail -5

                    if [ -f "$output" ]; then
                        local size
                        size=$(du -h "$output" | cut -f1)
                        info "✅ Downloaded: ${output} (${size})"
                    else
                        warn "Download may have failed. Check yt-dlp output above."
                    fi
                fi

            else
                local error_msg
                error_msg=$(echo "$resolve_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null)
                warn "Failed to resolve m3u8: ${error_msg}"
            fi
        fi
    done

    echo
    header
    echo -e "${BOLD}${GREEN}  ✅ All done!${NC}"
    header
    echo
    echo -e "${DIM}Episodes downloaded to: ${SCRIPT_DIR}/downloads/${NC}"
    echo
}

# ──────────────────────────────────────────────
# Cleanup on exit
# ──────────────────────────────────────────────
cleanup() {
    rm -f "$PY_HELPER" 2>/dev/null || true
}
trap cleanup EXIT

# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────
main "$@"
