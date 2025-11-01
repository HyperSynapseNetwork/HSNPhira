from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import time
import uuid
import threading
import httpx
import psutil

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(ROOT, "..", ".."))
CONFIGS_DIR = os.path.join(PROJECT_ROOT, "configs")
TEMP_DIR = os.path.join(PROJECT_ROOT, "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

CONFIG_PATH = os.path.join(CONFIGS_DIR, "base-plane.json")
MANIFEST_PATH = os.path.join(ROOT, "manifest.json")
TOKEN_FILE = os.path.join(TEMP_DIR, "base-plane-token.json")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_config():
    if not os.path.exists(CONFIG_PATH):
        # create default (old flat format for compatibility)
        # 默认将鉴权请求发送到 phira.htadiy.cc
        default = {"user_system_url": "https://phira.htadiy.cc", "loader_url": "http://127.0.0.1:19999", "token_expiry_seconds": 3600, "sse_interval_seconds": 1}
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(default, f, indent=2)
        return default
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # if new meta+config[] format, convert to flat dict
    if isinstance(raw, dict) and "config" in raw and isinstance(raw["config"], list):
        cfg = {}
        for item in raw["config"]:
            k = item.get("key")
            default = item.get("default")
            # try to convert numeric strings
            if isinstance(default, str):
                s = default.strip()
                if s.isdigit():
                    default = int(s)
                else:
                    try:
                        f = float(s)
                        default = f
                    except Exception:
                        # keep as string
                        pass
            cfg[k] = default
        return cfg
    return raw


CFG = load_config()


def clear_token_file():
    try:
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
    except Exception:
        pass


@app.on_event("startup")
def startup():
    # per spec, clear temp token storage on each start
    clear_token_file()


def save_token_record(token: str, expiry: int, user_info: dict):
    rec = {"token": token, "expiry": expiry, "user": user_info}
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(rec, f, ensure_ascii=False)


def load_token_record():
    if not os.path.exists(TOKEN_FILE):
        return None
    with open(TOKEN_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.post("/api/login")
async def login(payload: dict):
    username = payload.get("username")
    password = payload.get("password")
    remember = payload.get("remember", False)
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")

    # If user_system_url configured, forward request; else use simple local mock for demo
    user_system_url = CFG.get("user_system_url")
    user_info = None
    if user_system_url:
        # prefer explicit configured user_system_url; default is phira.htadiy.cc
        auth_url = user_system_url.rstrip("/") + "/api/auth/login"
        try:
            async with httpx.AsyncClient() as c:
                r = await c.post(auth_url, json={"username": username, "password": password, "remember": remember}, timeout=8.0)
                if r.status_code != 200:
                    # propagate failure as unauthorized
                    raise HTTPException(status_code=401, detail=f"authentication failed (status {r.status_code})")
                # assume response body contains user info JSON
                try:
                    user_info = r.json()
                except Exception:
                    raise HTTPException(status_code=502, detail="invalid response from user system")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"failed to reach user system: {e}")
    else:
        # mock: accept admin/password
        if username == "admin" and password == "password":
            user_info = {"id": 1, "group_id": 2, "username": "admin", "phira_id": 0, "phira_username": "", "phira_rks": 0.0, "phira_avatar": "", "register_time": "", "last_login_time": "", "last_sync_time": ""}
        else:
            raise HTTPException(status_code=401, detail="authentication failed (mock)")

    token = uuid.uuid4().hex
    expiry = int(time.time()) + int(CFG.get("token_expiry_seconds", 3600))
    save_token_record(token, expiry, user_info)

    return {"ok": True, "token": token, "expiry": expiry, "user": user_info}


@app.get("/api/me")
def me(request: Request):
    # check Authorization header or token file
    auth = request.headers.get("Authorization")
    rec = load_token_record()
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(None, 1)[1].strip()
        if rec and rec.get("token") == token and rec.get("expiry", 0) > int(time.time()):
            return rec.get("user")
        raise HTTPException(status_code=401, detail="invalid or expired token")
    if rec and rec.get("expiry", 0) > int(time.time()):
        return rec.get("user")
    raise HTTPException(status_code=401, detail="not authenticated")


def sse_format(event: Optional[str] = None, data: Optional[str] = None) -> str:
    s = ""
    if event:
        s += f"event: {event}\n"
    if data is not None:
        for line in data.splitlines():
            s += f"data: {line}\n"
    s += "\n"
    return s


def collect_stats_once():
    cpu = psutil.cpu_percent(interval=None)
    vm = psutil.virtual_memory()
    disks = []
    for p in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(p.mountpoint)
            disks.append({"mount": p.mountpoint, "total": usage.total, "used": usage.used, "percent": usage.percent})
        except Exception:
            continue
    net = psutil.net_io_counters()
    return {"cpu_percent": cpu, "memory": {"total": vm.total, "available": vm.available, "percent": vm.percent}, "disks": disks, "net": {"bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv}}


@app.get("/api/sse/stats")
def sse_stats():
    interval = float(CFG.get("sse_interval_seconds", 1))

    def gen():
        try:
            while True:
                stats = collect_stats_once()
                payload = json.dumps(stats, ensure_ascii=False)
                yield sse_format(event="stats", data=payload)
                time.sleep(interval)
        except GeneratorExit:
            return

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.post("/stop")
def stop():
    def _exit():
        time.sleep(0.2)
        os._exit(0)

    threading.Thread(target=_exit, daemon=True).start()
    return {"ok": True}


if __name__ == "__main__":
    # run with uvicorn; in normal operation the loader will set the working dir and port
    import uvicorn
    manifest = {}
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception:
        pass
    port = manifest.get("port") or 0
    if not port:
        print("no port assigned, exiting")
        raise SystemExit(1)
    print(f"base-plane starting on port {port}")
    uvicorn.run(app, host="127.0.0.1", port=port)
