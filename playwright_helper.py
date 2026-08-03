#!/usr/bin/env python3
"""Standalone Playwright helper — called as subprocess to extract m3u8 from kwik.cx.

Usage: python3 playwright_helper.py <kwik_url>
Outputs the m3u8 URL to stdout, or nothing on failure.
"""
import json
import sys
import traceback

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit(1)


def extract_m3u8(kwik_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
                extra_http_headers={"Referer": "https://animepahe.pw/"},
            )
            try:
                page = context.new_page()
                page.goto(kwik_url, timeout=30000, wait_until="domcontentloaded")
                page.wait_for_timeout(5000)

                url = page.evaluate("""() => {
                    if (window.hls && window.hls.url) return window.hls.url;
                    if (window.f && window.f.url) return window.f.url;
                    const video = document.getElementById('kwikPlayer');
                    if (video && (video.src || video.currentSrc)) return video.src || video.currentSrc;
                    return '';
                }""")

                if url and url.startswith('//'):
                    url = 'https:' + url
                return url
            finally:
                context.close()
        finally:
            browser.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(1)

    url = extract_m3u8(sys.argv[1])
    if url:
        sys.stdout.write(url)
