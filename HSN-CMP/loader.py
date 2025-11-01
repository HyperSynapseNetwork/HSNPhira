from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import subprocess
import sys
import socket
import threading
import time
from typing import Dict, Optional, List
import httpx

ROOT = os.path.dirname(os.path.abspath(__file__))
PLUGINS_DIR = os.path.join(ROOT, "plugins")
CONFIGS_DIR = os.path.join(ROOT, "configs")
TEMP_DIR = os.path.join(ROOT, "temp")
DATA_DIR = os.path.join(ROOT, "data")
BACKUPS_DIR = os.path.join(ROOT, "backups")

os.makedirs(PLUGINS_DIR, exist_ok=True)
os.makedirs(CONFIGS_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(BACKUPS_DIR, exist_ok=True)

APP = FastAPI()
# enable CORS so static pages can call loader API during development
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@APP.get("/api/loader/config/{fname:path}")
def api_get_config(fname: str):
    # prevent path traversal
    if ".." in fname or fname.startswith("/") or "\\" in fname:
        raise HTTPException(status_code=400, detail="invalid filename")
    path = os.path.join(CONFIGS_DIR, fname)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="config not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@APP.get("/api/loader/configs")
def api_list_configs():
    out = []
    for root, dirs, files in os.walk(CONFIGS_DIR):
        for fn in files:
            rel = os.path.relpath(os.path.join(root, fn), CONFIGS_DIR).replace('\\', '/')
            out.append(rel)
    return {"configs": out}


@APP.post("/api/loader/scan")
def api_scan_plugins(start: bool = False):
    """重新扫描 plugins 目录，分配端口并可选择按优先级启动插件。

    请求参数：
      start (bool) - 若为 true，按 priority 从低到高（0 为最高）启动插件。
    """
    try:
        discover_plugins()
        assign_ports()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    results = {"assigned_ports": {k: v.get('port') for k, v in manifests.items()}, "started": {}}
    if start:
        # sort by priority ascending (0 highest)
        items = sorted(manifests.values(), key=lambda x: (x.get('priority', 9), x.get('id')))
        for m in items:
            pid = m.get('id')
            if not pid:
                continue
            try:
                if get_plugin_status(str(pid)) != 'running':
                    start_plugin_process(str(pid))
                    results['started'][pid] = 'started'
                else:
                    results['started'][pid] = 'already_running'
            except Exception as e:
                results['started'][pid] = f'error: {e}'
    return results


def load_loader_config():
    cfg_path = os.path.join(CONFIGS_DIR, "loader.json")
    if not os.path.exists(cfg_path):
        # default config
        default = {"api_port_range": [20000, 20100], "loader_api_port": 19999, "auto_start_plugins": True}
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(default, f, indent=2)
        return default
    with open(cfg_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # support new meta+config[] format
    if isinstance(raw, dict) and "config" in raw and isinstance(raw["config"], list):
        cfg = {}
        for item in raw["config"]:
            k = item.get("key")
            default = item.get("default")
            # try to parse JSON-like defaults
            if isinstance(default, str):
                s = default.strip()
                if s.startswith("[") or s.startswith("{"):
                    try:
                        default = json.loads(s)
                    except Exception:
                        pass
                else:
                    # try numeric
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
    # fallback: old flat format
    return raw


LOADER_CONFIG = load_loader_config()


def is_port_free(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False


def find_free_ports(range_start: int, range_end: int) -> List[int]:
    free = []
    for p in range(range_start, range_end + 1):
        if is_port_free(p):
            free.append(p)
    return free


class PluginInfo(BaseModel):
    id: str
    priority: int
    name_cn: str
    description_cn: str
    version: str
    need_dashboard_page: bool
    page_name_cn: Optional[str] = None
    page_filename: Optional[str] = None
    port: Optional[int] = None


processes: Dict[str, subprocess.Popen] = {}
manifests: Dict[str, dict] = {}


def read_manifest(plugin_dir: str) -> Optional[dict]:
    mpath = os.path.join(plugin_dir, "manifest.json")
    if not os.path.exists(mpath):
        return None
    with open(mpath, "r", encoding="utf-8") as f:
        return json.load(f)


def write_manifest(plugin_dir: str, data: dict):
    mpath = os.path.join(plugin_dir, "manifest.json")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def discover_plugins():
    manifests.clear()
    for name in os.listdir(PLUGINS_DIR):
        pdir = os.path.join(PLUGINS_DIR, name)
        if os.path.isdir(pdir):
            m = read_manifest(pdir)
            if m and "id" in m:
                manifests[m["id"]] = m


def assign_ports():
    rng = LOADER_CONFIG.get("api_port_range", [20000, 20100])
    used = set()
    for m in manifests.values():
        if m.get("port"):
            used.add(m.get("port"))
    free = [p for p in range(rng[0], rng[1] + 1) if p not in used and is_port_free(p)]
    it = iter(free)
    changed = False
    for pid, m in manifests.items():
        if m.get("port") in (None, 0):
            try:
                p = next(it)
            except StopIteration:
                raise RuntimeError("no free ports available in range")
            m["port"] = p
            # write back
            write_manifest(os.path.join(PLUGINS_DIR, pid), m)
            changed = True
    return changed


def get_plugin_status(pid: str) -> str:
    if pid in processes:
        proc = processes[pid]
        if proc.poll() is None:
            return "running"
        else:
            return "stopped"
    return "stopped"


@APP.on_event("startup")
def startup_event():
    # discover and assign ports
    discover_plugins()
    try:
        assign_ports()
    except Exception as e:
        print("Port assignment error:", e)
    # optionally auto-start plugins on loader startup
    try:
        if LOADER_CONFIG.get("auto_start_plugins", False):
            def _autostart():
                # start plugins by priority (0 highest)
                items = sorted(manifests.values(), key=lambda x: (x.get('priority', 9), x.get('id')))
                for m in items:
                    pid = m.get('id')
                    if not pid:
                        continue
                    try:
                        if get_plugin_status(str(pid)) != 'running':
                            print(f"autostart: starting plugin {pid}")
                            start_plugin_process(str(pid))
                            time.sleep(0.1)
                    except Exception as e:
                        print(f"autostart: failed to start {pid}: {e}")

            threading.Thread(target=_autostart, daemon=True).start()
    except Exception as e:
        print("auto-start plugins error:", e)


@APP.get("/api/loader/plugins")
def api_list_plugins():
    out = []
    for pid, m in manifests.items():
        out.append({
            "id": m.get("id"),
            "name_cn": m.get("name_cn"),
            "priority": m.get("priority"),
            "description_cn": m.get("description_cn"),
            "version": m.get("version"),
            "need_dashboard_page": m.get("need_dashboard_page"),
            "page_info": {"page_name_cn": m.get("page_name_cn"), "page_filename": m.get("page_filename")} if m.get("need_dashboard_page") else None,
            "port": m.get("port"),
            "status": get_plugin_status(pid)
        })
    return {"plugins": out}


@APP.get("/api/loader/ports/available")
def api_ports_available():
    rng = LOADER_CONFIG.get("api_port_range", [20000, 20100])
    free = find_free_ports(rng[0], rng[1])
    return {"available": free}


def start_plugin_process(pid: str) -> None:
    if pid not in manifests:
        raise KeyError(pid)
    m = manifests[pid]
    pdir = os.path.join(PLUGINS_DIR, pid)
    main_py = os.path.join(pdir, "main.py")
    if not os.path.exists(main_py):
        raise FileNotFoundError("main.py not found for plugin %s" % pid)
    log_path = os.path.join(TEMP_DIR, f"{pid}.log")
    # ensure header with id
    with open(log_path, "a", encoding="utf-8") as hf:
        hf.write(f"id:{pid}\n")
    lf = open(log_path, "a", buffering=1, encoding="utf-8")
    # start process
    proc = subprocess.Popen([sys.executable, "main.py"], cwd=pdir, stdout=lf, stderr=subprocess.STDOUT)
    processes[pid] = proc


def stop_plugin_process(pid: str, timeout: float = 5.0) -> bool:
    if pid not in manifests:
        raise KeyError(pid)
    m = manifests[pid]
    port = m.get("port")
    # try HTTP /stop
    if port:
        try:
            with httpx.Client(timeout=3.0) as c:
                r = c.post(f"http://127.0.0.1:{port}/stop")
        except Exception:
            pass
    proc = processes.get(pid)
    if not proc:
        return True
    try:
        proc.wait(timeout=timeout)
        return True
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        return False


@APP.post("/api/loader/plugin/{pid}/start")
def api_start_plugin(pid: str):
    if pid not in manifests:
        raise HTTPException(status_code=404, detail="plugin not found")
    if get_plugin_status(pid) == "running":
        return {"ok": True, "msg": "already running"}
    try:
        start_plugin_process(pid)
        time.sleep(0.2)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@APP.post("/api/loader/plugin/{pid}/stop")
def api_stop_plugin(pid: str):
    if pid not in manifests:
        raise HTTPException(status_code=404, detail="plugin not found")
    ok = stop_plugin_process(pid)
    return {"ok": ok}


@APP.post("/api/loader/plugin/{pid}/restart")
def api_restart_plugin(pid: str):
    if pid not in manifests:
        raise HTTPException(status_code=404, detail="plugin not found")
    stop_plugin_process(pid)
    start_plugin_process(pid)
    return {"ok": True}


@APP.post("/api/loader/stop_all")
def api_stop_all():
    results = {}
    for pid in list(manifests.keys()):
        try:
            results[pid] = stop_plugin_process(pid)
        except Exception as e:
            results[pid] = False
    return {"results": results}


@APP.post("/api/loader/shutdown")
def api_shutdown():
    def do_shutdown():
        for pid in list(manifests.keys()):
            try:
                stop_plugin_process(pid)
            except Exception:
                pass
        # allow response to be returned
        time.sleep(0.5)
        os._exit(0)

    threading.Thread(target=do_shutdown, daemon=True).start()
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    discover_plugins()
    try:
        assign_ports()
    except Exception as e:
        print("assign_ports failed:", e)
    port = LOADER_CONFIG.get("loader_api_port", 19999)
    print(f"Starting loader API on 127.0.0.1:{port}")
    uvicorn.run("loader:APP", host="127.0.0.1", port=port, reload=False)
