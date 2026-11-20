"""Motion Atlas — local classroom server. Python 3.10+, no pip install."""

import argparse
import contextlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import uuid
import webbrowser
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from pipeline.features import SAFE_INPUT, frame_rows, invoke, probe, summarize
from recommender import EVENTS, rank

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
RUNTIME = Path(os.environ.get("MOTION_DATA", ROOT / ".runtime")).resolve()
TOPICS = ["Biển & nước", "Hoang dã", "Thể thao", "Đô thị", "Khác"]
FORMATS = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


@contextlib.contextmanager
def database():
    with contextlib.closing(sqlite3.connect(RUNTIME / "atlas.db", timeout=20)) as db:
        db.row_factory = sqlite3.Row
        with db:
            yield db


def initialize():
    (RUNTIME / "uploads").mkdir(exist_ok=True, parents=True)
    with database() as db:
        db.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,record TEXT NOT NULL,owner TEXT);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,viewer TEXT,item TEXT,action TEXT,at TEXT);
        CREATE INDEX IF NOT EXISTS events_by_viewer ON events(viewer,at);
        CREATE TABLE IF NOT EXISTS state(viewer TEXT,item TEXT,opened INT DEFAULT 0,completed INT DEFAULT 0,
           liked INT DEFAULT 0,skipped INT DEFAULT 0,PRIMARY KEY(viewer,item));
        CREATE INDEX IF NOT EXISTS state_by_item ON state(item,opened);
        """)
        # Retire the old bundled catalog while keeping uploaded items and their events.
        legacy = "SELECT id FROM media WHERE owner IS NULL AND json_extract(record, '$.src') LIKE '/media/%'"
        db.execute(f"DELETE FROM events WHERE item IN ({legacy})")
        db.execute(f"DELETE FROM state WHERE item IN ({legacy})")
        db.execute(f"DELETE FROM media WHERE id IN ({legacy})")


def event(db, viewer, payload):
    eid = str(uuid.UUID(payload["id"]))
    mid, action = payload["item"], payload["action"]
    if (
        action not in EVENTS
        or not db.execute("SELECT 1 FROM media WHERE id=?", (mid,)).fetchone()
    ):
        raise ValueError("Sự kiện không hợp lệ.")
    created = db.execute(
        "INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)",
        (eid, viewer, mid, action, datetime.now(timezone.utc).isoformat()),
    ).rowcount
    if created:
        field, value = {
            "open": ("opened", 1),
            "complete": ("completed", 1),
            "like": ("liked", 1),
            "unlike": ("liked", 0),
            "skip": ("skipped", 1),
        }[action]
        db.execute(
            f"INSERT INTO state(viewer,item,{field}) VALUES(?,?,?) ON CONFLICT(viewer,item) DO UPDATE SET {field}=excluded.{field}",
            (viewer, mid, value),
        )


def feed(db, viewer):
    db.execute("BEGIN")
    rows = db.execute(
        "SELECT record,owner FROM media ORDER BY owner IS NULL,CASE WHEN owner IS NULL THEN rowid ELSE -rowid END"
    ).fetchall()
    items = [{**json.loads(r["record"]), "mine": r["owner"] == viewer} for r in rows]
    states = {
        r["item"]: dict(r)
        for r in db.execute("SELECT * FROM state WHERE viewer=?", (viewer,))
    }
    views = dict(db.execute("SELECT item,SUM(opened) FROM state GROUP BY item"))
    counts = dict(db.execute("SELECT action,COUNT(*) FROM events GROUP BY action"))
    return {
        "items": rank(items, states, views),
        "topics": TOPICS,
        "stats": {
            "analyzedFrames": sum(m["frames"] for m in items),
            "events": counts,
            "viewers": db.execute(
                "SELECT COUNT(DISTINCT viewer) FROM events"
            ).fetchone()[0],
        },
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def viewer(self):
        jar = SimpleCookie()
        jar.load(self.headers.get("Cookie", ""))
        value = jar.get("atlas_viewer")
        if value and re.fullmatch("[a-f0-9]{32}", value.value):
            return value.value
        self.new_cookie = uuid.uuid4().hex
        return self.new_cookie

    def respond(self, obj, status=200):
        encoded = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        if getattr(self, "new_cookie", None):
            self.send_header(
                "Set-Cookie",
                f"atlas_viewer={self.new_cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000",
            )
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def translate_path(self, path):
        url = unquote(urlsplit(path).path)
        if url.startswith("/uploads/"):
            if re.fullmatch(
                r"/uploads/[0-9a-f]{32}/(poster\.jpg|file\.(mp4|webm|jpg|png|webp))",
                url,
            ):
                return str(RUNTIME / url.lstrip("/"))
            return str(WEB / "missing")
        return super().translate_path(path)

    def send_head(self):
        path = Path(self.translate_path(self.path))
        requested = self.headers.get("Range")
        self.byte_count = None
        if not requested or path.suffix != ".mp4" or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested)
        if match and any(match.groups()):
            left, right = match.groups()
            first = int(left) if left else max(0, size - int(right))
            last = min(int(right), size - 1) if left and right else size - 1
            if first <= last:
                handle = path.open("rb")
                handle.seek(first)
                self.byte_count = last - first + 1
                self.send_response(206)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Range", f"bytes {first}-{last}/{size}")
                self.send_header("Content-Length", str(self.byte_count))
                self.end_headers()
                return handle
        self.send_response(416)
        self.send_header("Content-Range", f"bytes */{size}")
        self.end_headers()
        return None

    def copyfile(self, source, output):
        try:
            if self.byte_count is None:
                return super().copyfile(source, output)
            left = self.byte_count
            while left:
                chunk = source.read(min(left, 65536))
                if not chunk:
                    break
                output.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if urlsplit(self.path).path == "/api/feed":
            with database() as db:
                self.respond(feed(db, self.viewer()))
        else:
            super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path)
        try:
            # Cross-origin browser posts cannot add the required header without CORS.
            if self.headers.get("X-Atlas") != "1":
                return self.respond({"error": "Yêu cầu không hợp lệ."}, 403)
            size = int(self.headers.get("Content-Length", "0"))
            viewer = self.viewer()
            if path.path == "/api/events":
                if not 0 < size <= 4096:
                    raise ValueError("Kích thước yêu cầu không hợp lệ.")
                payload = json.loads(self.rfile.read(size))
                with database() as db:
                    event(db, viewer, payload)
                self.respond({"ok": True})
            elif path.path == "/api/media":
                self.upload(viewer, size, parse_qs(path.query))
            else:
                self.respond({"error": "Không tìm thấy."}, 404)
        except (
            ValueError,
            KeyError,
            IndexError,
            TypeError,
            subprocess.SubprocessError,
        ):
            self.respond(
                {
                    "error": "Dữ liệu không hợp lệ. Chọn tệp ảnh hoặc video đọc được, tối đa 90 giây."
                },
                400,
            )
        except FileNotFoundError:
            self.respond(
                {
                    "error": "Cài FFmpeg và ffprobe vào PATH của máy chủ để xử lý bài đăng."
                },
                503,
            )
        except (sqlite3.Error, OSError):
            self.respond({"error": "Không lưu được dữ liệu trên máy chủ."}, 500)

    def upload(self, viewer, size, query):
        if not 0 < size <= 32 * 1024 * 1024:
            return self.respond({"error": "Chọn tệp từ 1 byte đến 32 MB."}, 413)
        mime = self.headers.get_content_type()
        if mime not in FORMATS:
            return self.respond({"error": "Hỗ trợ MP4, WebM, JPG, PNG và WebP."}, 415)
        title = query.get("title", [""])[0].strip()
        topic = query.get("topic", [""])[0]
        tags = [
            s.strip().casefold()
            for s in query.get("tags", [""])[0].split(",")
            if s.strip()
        ]
        if (
            not title
            or len(title) > 100
            or topic not in TOPICS
            or len(tags) > 8
            or any(len(t) > 40 for t in tags)
        ):
            raise ValueError()
        mid = uuid.uuid4().hex
        dest = RUNTIME / "uploads" / mid
        with tempfile.TemporaryDirectory(dir=RUNTIME) as tmp:
            folder = Path(tmp) / "media"
            folder.mkdir()
            path = folder / ("file" + FORMATS[mime])
            with path.open("wb") as out:
                left = size
                while left:
                    chunk = self.rfile.read(min(left, 65536))
                    if not chunk:
                        raise ValueError()
                    out.write(chunk)
                    left -= len(chunk)
            info = probe(path)
            kind = "video" if mime.startswith("video/") else "image"
            if (
                info["width"] * info["height"] > 16000000
                or info["seconds"] > 90
                or (kind == "video" and info["seconds"] <= 0)
            ):
                raise ValueError()
            formats = {".jpg": {"mjpeg"}, ".png": {"png"}, ".webp": {"webp"}}
            if path.suffix in formats and info["codec"] not in formats[path.suffix]:
                raise ValueError()
            # Normalize uploads into browser-friendly JPEG / H.264 and limit frame rate for reproducible cost.
            normalized = folder / (
                "normalized.mp4" if kind == "video" else "normalized.jpg"
            )
            output = (
                [
                    "-t",
                    "90",
                    "-an",
                    "-vf",
                    "fps=20,scale='min(960,iw)':-2",
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                ]
                if kind == "video"
                else ["-frames:v", "1", "-vf", "scale='min(1200,iw)':-2"]
            )
            invoke(
                "ffmpeg",
                "-nostdin",
                "-v",
                "error",
                *SAFE_INPUT,
                "-i",
                str(path),
                *output,
                "-threads",
                "2",
                str(normalized),
            )
            path.unlink()
            path = folder / ("file" + normalized.suffix)
            normalized.rename(path)
            if kind == "image":
                shutil.copy(path, folder / "poster.jpg")
            else:
                invoke(
                    "ffmpeg",
                    "-v",
                    "error",
                    "-i",
                    str(path),
                    "-frames:v",
                    "1",
                    str(folder / "poster.jpg"),
                )
            item = {
                "id": mid,
                "title": title,
                "topic": topic,
                "tags": list(dict.fromkeys(tags)),
                "kind": kind,
                "source": "Provider",
                "src": f"/uploads/{mid}/{path.name}",
                "cover": f"/uploads/{mid}/poster.jpg",
                "original": info,
                **probe(path),
                **summarize(frame_rows(path)),
            }
            folder.rename(dest)
            try:
                with database() as db:
                    db.execute(
                        "INSERT INTO media VALUES(?,?,?)",
                        (mid, json.dumps(item), viewer),
                    )
            except Exception:
                shutil.rmtree(dest)
                raise
        self.respond({"id": mid}, 201)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")))
    parser.add_argument("--open", action="store_true", help="Mở trình duyệt mặc định")
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    initialize()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    if args.open:
        webbrowser.open(f"http://127.0.0.1:{args.port}")
    print(f"Motion Atlas: http://{args.host}:{args.port}", flush=True)
    httpd.serve_forever()
