#!/usr/bin/env python3
"""Todo server that serves the app, inbox updates, and shared UI state."""

import base64
import ipaddress
import json
import os
import re
import shutil
import http.server
import threading
import zipfile
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

# Serializes reads/writes of the JSON files now that requests run in parallel.
FILE_LOCK = threading.Lock()

PORT = 8080

# Only the machine itself and devices on the Tailscale tailnet may connect.
# Blocks the local Wi-Fi/LAN (and anything else that can route to this Mac).
ALLOWED_NETS = [
    ipaddress.ip_network("127.0.0.0/8"),      # loopback
    ipaddress.ip_network("::1/128"),          # loopback v6
    ipaddress.ip_network("100.64.0.0/10"),    # Tailscale
]

# Browser pages allowed to call the API cross-origin.
ALLOWED_ORIGINS = {
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://100.85.141.2:8080",
    "http://roberts-macbook-pro-2.tail7fe537.ts.net:8080",
    "https://roberts-macbook-pro-2.tail7fe537.ts.net",  # tailscale serve (TLS, port 443)
}


def ip_allowed(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str.split("%")[0])
    except ValueError:
        return False
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        ip = mapped
    return any(ip in net for net in ALLOWED_NETS)
DIR = os.path.dirname(os.path.abspath(__file__))
INBOX = os.path.join(DIR, "todo-inbox.json")
STATE = os.path.join(DIR, "todo-state.json")
FILES_INDEX = os.path.join(DIR, "todo-files.json")
UPLOADS = os.path.join(DIR, "uploads")

MAX_UPLOAD = 50 * 1024 * 1024     # 50 MB per file
TEXT_CAP = 200_000                # cap extracted text stored for search
TEXT_EXTS = {
    "txt", "md", "markdown", "csv", "tsv", "log", "json", "xml", "html", "htm",
    "js", "ts", "jsx", "tsx", "css", "scss", "py", "rb", "go", "rs", "java",
    "c", "h", "cpp", "sh", "bash", "zsh", "yml", "yaml", "toml", "ini", "sql", "rtf",
}


def _strip_xml(data):
    # crude but dependency-free: drop tags, unescape the common entities
    text = re.sub(r"<[^>]+>", " ", data.decode("utf-8", "ignore"))
    for a, b in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")):
        text = text.replace(a, b)
    return text


def extract_text(path, ext):
    """Best-effort text extraction for in-file content search. Returns "" if not feasible."""
    ext = (ext or "").lower()
    try:
        if ext in TEXT_EXTS:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read(TEXT_CAP)
        if ext == "docx":
            with zipfile.ZipFile(path) as z:
                return _strip_xml(z.read("word/document.xml"))[:TEXT_CAP]
        if ext == "xlsx":
            with zipfile.ZipFile(path) as z:
                names = [n for n in z.namelist() if n.startswith("xl/") and n.endswith(".xml")]
                return " ".join(_strip_xml(z.read(n)) for n in names)[:TEXT_CAP]
        if ext == "pptx":
            with zipfile.ZipFile(path) as z:
                names = [n for n in z.namelist() if n.startswith("ppt/slides/") and n.endswith(".xml")]
                return " ".join(_strip_xml(z.read(n)) for n in names)[:TEXT_CAP]
        if ext == "pdf":
            try:
                from pypdf import PdfReader
                reader = PdfReader(path)
                out = []
                for page in reader.pages:
                    out.append(page.extract_text() or "")
                    if sum(len(x) for x in out) > TEXT_CAP:
                        break
                return "\n".join(out)[:TEXT_CAP]
            except Exception:
                return ""
    except Exception:
        return ""
    return ""


def safe_name(name):
    name = os.path.basename(str(name or "")).strip() or "file"
    return re.sub(r'[^A-Za-z0-9._()\-]', "_", name)[:160]

DEFAULT_STATE = {
    "completed": {},
    "edits": {},
    "notes": {},
    "deleted": {},
    "personalNotes": "",
    "personalItems": [],
    "projectItems": [],
    "project2Groups": [],
    "routedInbox": {},
}


def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def normalize_state(data):
    if not isinstance(data, dict):
        return DEFAULT_STATE.copy()

    normalized = {}
    for key, empty in DEFAULT_STATE.items():
        value = data.get(key, empty)
        if isinstance(empty, dict):
            normalized[key] = value if isinstance(value, dict) else {}
        elif isinstance(empty, list):
            normalized[key] = value if isinstance(value, list) else []
        else:
            normalized[key] = value if isinstance(value, str) else empty
    return normalized


class TodoHandler(http.server.SimpleHTTPRequestHandler):
    # Drop connections that go quiet (e.g. browser preconnects) instead of
    # letting them hold a thread open forever.
    timeout = 30

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        # The HTML and API responses must never be cached, so code edits and
        # data changes show up on the next refresh (esp. on iOS home-screen
        # web apps). Static assets (logo, favicons, JS) rarely change, so let
        # them cache for a day — re-downloading the 138KB logo on every load
        # made the app slow over cellular.
        path = urlparse(self.path).path
        if path.endswith(".html") or path.endswith(".json") or path.startswith("/api/") or path == "/":
            self.send_header("Cache-Control", "no-store, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()

    def cors_origin(self):
        origin = self.headers.get("Origin", "")
        return origin if origin in ALLOWED_ORIGINS else None

    def send_json(self, status_code, payload):
        body = json.dumps(payload).encode()
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        origin = self.cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_request_json(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        return json.loads(body) if body else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            with FILE_LOCK:
                state = normalize_state(read_json(STATE, DEFAULT_STATE.copy()))
            self.send_json(200, state)
            return

        if parsed.path == "/api/projects":
            with FILE_LOCK:
                state = normalize_state(read_json(STATE, DEFAULT_STATE.copy()))
            projects = [
                {"name": p.get("name", ""), "status": p.get("status", "Active"), "ai": bool(p.get("ai"))}
                for p in state["projectItems"]
                if isinstance(p, dict) and not p.get("isTemplate") and p.get("name")
            ]
            self.send_json(200, projects)
            return

        if parsed.path == "/api/files":
            with FILE_LOCK:
                records = read_json(FILES_INDEX, [])
            q = (parse_qs(parsed.query).get("q", [""])[0] or "").strip().lower()
            pid = (parse_qs(parsed.query).get("project", [""])[0] or "").strip()
            nid = (parse_qs(parsed.query).get("note", [""])[0] or "").strip()
            out = []
            for r in records:
                if not isinstance(r, dict):
                    continue
                if pid and str(r.get("projectId", "")) != pid:
                    continue
                if nid and str(r.get("noteId", "")) != nid:
                    continue
                if q and q not in (r.get("name", "").lower() + " " + r.get("text", "").lower()):
                    continue
                out.append({k: r[k] for k in r if k != "text"})  # never ship the big text blob
            out.sort(key=lambda r: r.get("uploadedAt", ""), reverse=True)
            self.send_json(200, out)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/add-task":
            try:
                data = self.read_request_json()
                task = data.get("task", "").strip()
                priority = data.get("priority", "normal").strip()
                project = str(data.get("project", "") or "").strip()
                task_notes = str(data.get("notes", "") or "").strip()
            except json.JSONDecodeError:
                self.send_json(400, {"error": "invalid json"})
                return

            if not task:
                self.send_json(400, {"error": "task is required"})
                return

            item = {
                "task": task,
                "priority": priority,
                "added": datetime.now().strftime("%Y-%m-%d %I:%M %p")
            }
            if project:
                item["project"] = project
            if task_notes:
                item["notes"] = task_notes
            with FILE_LOCK:
                items = read_json(INBOX, [])
                items.append(item)
                write_json(INBOX, items)
            self.send_json(200, {"ok": True, "count": len(items)})
            return

        if parsed.path == "/api/upload-file":
            try:
                data = self.read_request_json()
            except json.JSONDecodeError:
                self.send_json(400, {"error": "invalid json"})
                return
            name = safe_name(data.get("name"))
            b64 = data.get("dataBase64", "")
            if not b64:
                self.send_json(400, {"error": "no file data"})
                return
            try:
                raw = base64.b64decode(b64)
            except Exception:
                self.send_json(400, {"error": "bad base64"})
                return
            if len(raw) > MAX_UPLOAD:
                self.send_json(413, {"error": "file too large (max 50MB)"})
                return
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            fid = "f_" + base64.urlsafe_b64encode(os.urandom(9)).decode().rstrip("=")
            folder = os.path.join(UPLOADS, fid)
            os.makedirs(folder, exist_ok=True)
            disk_path = os.path.join(folder, name)
            with open(disk_path, "wb") as f:
                f.write(raw)
            record = {
                "id": fid,
                "name": name,
                "ext": ext,
                "size": len(raw),
                "mime": str(data.get("mime", "") or ""),
                "projectId": str(data.get("projectId", "") or ""),
                "projectName": str(data.get("projectName", "") or ""),
                "noteId": str(data.get("noteId", "") or ""),
                "noteTitle": str(data.get("noteTitle", "") or ""),
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
                "url": "/uploads/" + fid + "/" + name,
                "text": extract_text(disk_path, ext),
            }
            with FILE_LOCK:
                records = read_json(FILES_INDEX, [])
                records.append(record)
                write_json(FILES_INDEX, records)
            meta = {k: record[k] for k in record if k != "text"}
            meta["searchable"] = bool(record["text"].strip())
            self.send_json(200, {"ok": True, "file": meta})
            return

        if parsed.path == "/api/delete-file":
            try:
                data = self.read_request_json()
            except json.JSONDecodeError:
                self.send_json(400, {"error": "invalid json"})
                return
            fid = str(data.get("id", "") or "")
            removed = False
            with FILE_LOCK:
                records = read_json(FILES_INDEX, [])
                kept = [r for r in records if isinstance(r, dict) and r.get("id") != fid]
                removed = len(kept) != len(records)
                if removed:
                    write_json(FILES_INDEX, kept)
            # only touch a folder that is actually one of ours
            if removed and re.fullmatch(r"f_[A-Za-z0-9_\-]+", fid):
                shutil.rmtree(os.path.join(UPLOADS, fid), ignore_errors=True)
            self.send_json(200, {"ok": removed})
            return

        if parsed.path == "/api/delete-files-for":
            # cascade-delete every file attached to a project or note (on owner deletion)
            try:
                data = self.read_request_json()
            except json.JSONDecodeError:
                self.send_json(400, {"error": "invalid json"})
                return
            pid = str(data.get("projectId", "") or "")
            nid = str(data.get("noteId", "") or "")
            if not pid and not nid:
                self.send_json(400, {"error": "projectId or noteId required"})
                return
            doomed = []
            with FILE_LOCK:
                records = read_json(FILES_INDEX, [])
                kept = []
                for r in records:
                    if isinstance(r, dict) and ((pid and str(r.get("projectId", "")) == pid) or (nid and str(r.get("noteId", "")) == nid)):
                        doomed.append(r.get("id", ""))
                    else:
                        kept.append(r)
                if doomed:
                    write_json(FILES_INDEX, kept)
            for fid in doomed:
                if re.fullmatch(r"f_[A-Za-z0-9_\-]+", str(fid)):
                    shutil.rmtree(os.path.join(UPLOADS, fid), ignore_errors=True)
            self.send_json(200, {"ok": True, "deleted": len(doomed)})
            return

        if parsed.path == "/api/state":
            try:
                data = self.read_request_json()
            except json.JSONDecodeError:
                self.send_json(400, {"error": "invalid json"})
                return

            # Merge over existing state: only overwrite keys the client actually
            # sent, so an older client that doesn't know about a field (e.g.
            # project2Groups) can't wipe it back to the default.
            with FILE_LOCK:
                existing = normalize_state(read_json(STATE, DEFAULT_STATE.copy()))
                if isinstance(data, dict):
                    for key in DEFAULT_STATE:
                        if key in data:
                            existing[key] = data[key]
                state = normalize_state(existing)
                write_json(STATE, state)
            self.send_json(200, {"ok": True})
            return

        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        origin = self.cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


class TodoServer(http.server.ThreadingHTTPServer):
    # One thread per connection, so an idle browser preconnect can't
    # block everyone else (single-threaded HTTPServer froze under Chrome).
    daemon_threads = True

    def verify_request(self, request, client_address):
        # Drop connections from anywhere outside loopback/Tailscale.
        return ip_allowed(client_address[0])


if __name__ == "__main__":
    server = TodoServer(("", PORT), TodoHandler)
    print(f"Todo server running on http://localhost:{PORT}")
    print(f"Dashboard: http://localhost:{PORT}/todo-app.html")
    print(f"API: POST http://localhost:{PORT}/api/add-task")
    print(f"State: GET/POST http://localhost:{PORT}/api/state")
    server.serve_forever()
