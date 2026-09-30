"""Zero-dependency Python implementation of Geek Quote API."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import random
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = Path(os.environ.get("GEEK_QUOTES_FILE", ROOT_DIR / "data" / "quotes_bilingual.json"))
PUBLIC_DIR = ROOT_DIR / "public"
STARTED_AT = time.monotonic()
QUOTES: list[dict] = []

CATEGORY_META = {
    "math_logic": {"name_zh": "数理逻辑与纯数", "name_en": "Math & Logic", "icon": "∑"},
    "ai_ml": {"name_zh": "机器学习与 AI 炼丹", "name_en": "AI & Machine Learning", "icon": "∇"},
    "cs_geek": {"name_zh": "计算机体系与算法极客", "name_en": "CS & Geek Culture", "icon": "⌘"},
    "physics_stem": {"name_zh": "理论物理与大学理科", "name_en": "Physics & STEM Life", "icon": "⚛"},
}


def normalize_quote(item: dict) -> dict:
    language = item.get("language") if item.get("language") in {"zh", "en"} else ""
    content = item.get("content") if isinstance(item.get("content"), str) else ""
    source = item.get("source") if isinstance(item.get("source"), str) else ""
    return {
        "id": str(item.get("id", "")),
        "content_zh": str(item.get("content_zh") or (content if language == "zh" else "")),
        "content_en": str(item.get("content_en") or (content if language == "en" else "")),
        "category": str(item.get("category") or "general"),
        "tags": [str(tag) for tag in item.get("tags", [])] if isinstance(item.get("tags"), list) else [],
        "source_zh": str(item.get("source_zh") or source),
        "source_en": str(item.get("source_en") or source),
    }


def load_quotes(data_file: Path = DATA_FILE) -> int:
    global QUOTES
    with data_file.open("r", encoding="utf-8") as handle:
        parsed = json.load(handle)
    if not isinstance(parsed, list):
        raise ValueError(f"Quote data must be an array: {data_file}")
    QUOTES = [normalize_quote(item) for item in parsed if isinstance(item, dict) and item.get("id")]
    return len(QUOTES)


def normalize_language(value: str | None) -> str:
    return value if value in {"zh", "en", "both"} else "both"


def matches_language(quote: dict, language: str) -> bool:
    if language == "zh":
        return bool(quote["content_zh"])
    if language == "en":
        return bool(quote["content_en"])
    return bool(quote["content_zh"] and quote["content_en"])


def filter_quotes(
    *, category: str | None = None, tag: str | None = None, lang: str | None = "both", search: str | None = None
) -> list[dict]:
    language = normalize_language(lang)
    normalized_tag = tag.lower() if tag else ""
    term = search.lower() if search else ""
    result = []

    for quote in QUOTES:
        if category and quote["category"] != category:
            continue
        if not matches_language(quote, language):
            continue
        if normalized_tag and not any(item.lower() == normalized_tag for item in quote["tags"]):
            continue
        if term:
            haystack = "\n".join(
                [
                    quote["content_zh"],
                    quote["content_en"],
                    quote["source_zh"],
                    quote["source_en"],
                    *quote["tags"],
                ]
            ).lower()
            if term not in haystack:
                continue
        result.append(quote)
    return result


def quote_as_text(quote: dict, lang: str) -> str:
    if lang == "zh":
        return f'{quote["content_zh"]}\n—— {quote["source_zh"]}'.strip()
    if lang == "en":
        return f'{quote["content_en"]}\n—— {quote["source_en"]}'.strip()
    return f'{quote["content_zh"]}\n{quote["content_en"]}\n—— {quote["source_zh"]} / {quote["source_en"]}'.strip()


def get_stats() -> dict:
    by_category: dict[str, int] = {}
    by_language = {"zh": 0, "en": 0}
    all_tags: set[str] = set()

    for quote in QUOTES:
        by_category[quote["category"]] = by_category.get(quote["category"], 0) + 1
        if quote["content_zh"]:
            by_language["zh"] += 1
        if quote["content_en"]:
            by_language["en"] += 1
        all_tags.update(quote["tags"])

    return {
        "total_quotes": len(QUOTES),
        "total_categories": len(by_category),
        "total_tags": len(all_tags),
        "by_category": by_category,
        "by_language": by_language,
        "database_engine": "JSON (in-memory)",
        "server": "Python (stdlib)",
        "uptime_seconds": int(time.monotonic() - STARTED_AT),
    }


def parse_positive_int(value: str | None, default: int, maximum: int | None = None) -> int:
    try:
        parsed = int(value or "")
    except ValueError:
        return default
    if parsed < 1:
        return default
    return min(parsed, maximum) if maximum else parsed


class QuoteRequestHandler(BaseHTTPRequestHandler):
    server_version = "GeekQuotePython/1.0"

    def _headers(self, content_type: str) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, status: int, body: dict) -> None:
        payload = json.dumps(body, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self._headers("application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_text(self, status: int, body: str) -> None:
        payload = body.encode("utf-8")
        self.send_response(status)
        self._headers("text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json(status, {"code": status, "message": message})

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._headers("text/plain; charset=utf-8")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        params = {key: values[0] for key, values in parse_qs(parsed.query).items()}

        if parsed.path == "/health":
            return self.send_text(HTTPStatus.OK, "OK")

        if parsed.path == "/api/random":
            lang = normalize_language(params.get("lang"))
            pool = filter_quotes(category=params.get("category"), tag=params.get("tag"), lang=lang)
            if not pool:
                return self.send_json(
                    HTTPStatus.NOT_FOUND,
                    {
                        "code": HTTPStatus.NOT_FOUND,
                        "message": "未找到符合条件的文案",
                        "filters": {key: params.get(key) for key in ("category", "lang", "tag")},
                    },
                )
            quote = random.choice(pool)
            if params.get("format", "json").lower() == "text":
                return self.send_text(HTTPStatus.OK, quote_as_text(quote, lang))
            return self.send_json(
                HTTPStatus.OK,
                {
                    "code": HTTPStatus.OK,
                    "data": quote,
                    "meta": {
                        "total_matched": len(pool),
                        "category_meta": {"id": quote["category"], **CATEGORY_META.get(quote["category"], {})},
                    },
                },
            )

        if parsed.path == "/api/quotes":
            page = parse_positive_int(params.get("page"), 1)
            limit = parse_positive_int(params.get("limit"), 20, 100)
            results = filter_quotes(
                category=params.get("category"), lang=params.get("lang", "both"), search=params.get("search")
            )
            start = (page - 1) * limit
            return self.send_json(
                HTTPStatus.OK,
                {
                    "code": HTTPStatus.OK,
                    "data": {
                        "items": results[start : start + limit],
                        "total": len(results),
                        "page": page,
                        "limit": limit,
                        "total_pages": (len(results) + limit - 1) // limit,
                    },
                },
            )

        if parsed.path == "/api/categories":
            counts = {key: 0 for key in CATEGORY_META}
            for quote in QUOTES:
                counts[quote["category"]] = counts.get(quote["category"], 0) + 1
            categories = [
                {"id": key, **meta, "count": counts.get(key, 0)} for key, meta in CATEGORY_META.items()
            ]
            return self.send_json(HTTPStatus.OK, {"code": HTTPStatus.OK, "data": categories})

        if parsed.path == "/api/stats":
            return self.send_json(
                HTTPStatus.OK,
                {"code": HTTPStatus.OK, "data": {**get_stats(), "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}},
            )

        if parsed.path.startswith("/api/"):
            return self.send_error_json(HTTPStatus.NOT_FOUND, "API route not found")

        self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        if parsed.path != "/api/reload":
            return self.send_error_json(HTTPStatus.NOT_FOUND, "API route not found")
        try:
            count = load_quotes()
        except (OSError, ValueError, json.JSONDecodeError) as error:
            return self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"code": 500, "error": str(error)})
        self.send_json(HTTPStatus.OK, {"code": HTTPStatus.OK, "message": "数据已重新加载", "data": {"total_quotes": count}})

    def serve_static(self, pathname: str) -> None:
        requested = "index.html" if pathname == "/" else unquote(pathname.lstrip("/"))
        candidate = (PUBLIC_DIR / requested).resolve()
        try:
            candidate.relative_to(PUBLIC_DIR.resolve())
        except ValueError:
            return self.send_error_json(HTTPStatus.FORBIDDEN, "Forbidden")
        if not candidate.is_file():
            return self.send_error_json(HTTPStatus.NOT_FOUND, "File Not Found")
        payload = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self._headers(mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[Python Server] {self.address_string()} - {format % args}")


def start_server(host: str = "127.0.0.1", port: int = 3000) -> ThreadingHTTPServer:
    count = load_quotes()
    server = ThreadingHTTPServer((host, port), QuoteRequestHandler)
    print(f"Geek Quote API (Python) listening on http://{host}:{server.server_address[1]}")
    print(f"Loaded {count} bilingual quotes from {DATA_FILE}")
    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the zero-dependency Python Geek Quote API")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")))
    args = parser.parse_args()
    with start_server(args.host, args.port) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nPython server stopped")


if __name__ == "__main__":
    main()
