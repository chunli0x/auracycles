"""Aura Cycles — FastAPI web app.

Serves the single-page UI and exposes the deterministic engine at /api/read.
The engine (engine.py) is the source of truth; this file is a thin HTTP shell.
A future "coach" layer (local LLM via Ollama) would hang off a new endpoint
here without touching the engine.
"""

import os
import threading
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

import engine

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")

app = FastAPI(title="Aura Cycles", version="0.1.0")

# Anonymous "calendars generated" social-proof counter. A single integer, no
# personal data. Persists to a volume so it survives deploys/restarts.
COUNTER_FILE = os.environ.get("AURA_COUNTER_FILE", "/data/aura-counter.txt")
_counter_lock = threading.Lock()


def _read_counter() -> int:
    try:
        with open(COUNTER_FILE, "r") as f:
            return max(0, int(f.read().strip() or 0))
    except Exception:
        return 0


def _bump_counter() -> int:
    with _counter_lock:
        n = _read_counter() + 1
        try:
            os.makedirs(os.path.dirname(COUNTER_FILE), exist_ok=True)
            with open(COUNTER_FILE, "w") as f:
                f.write(str(n))
        except Exception:
            pass  # non-fatal — fall back to the in-memory count for this run
        return n


class Profile(BaseModel):
    age: int = 35
    stage: str = "auto"  # auto | regular | perimenopause | menopause
    peri_symptoms: List[str] = []  # CEMCOR early-perimenopause checklist keys
    period_starts: List[str] = []  # ISO dates, any order
    period_length: int = 5
    cycle_length: Optional[int] = None  # blank = auto-compute from starts
    training: str = "mix"  # heavy | moderate | light | cardio | mix
    workout_frequency: str = "3x"  # daily | 5x | 3x | 1x
    diet: str = "balanced"  # balanced | low-carb | high-protein | plant-based | if
    social: str = "weekly"  # daily | weekly | monthly | rarely
    relationship: str = "single"  # single | relationship
    ttc: str = "no"  # no | yes — "yes" shows a fertile-window calculation
    hrt: str = "no"  # no | yes | considering
    glp1: str = "no"  # no | yes | starting
    first_time: bool = False  # true on a fresh setup (drives the social-proof counter)
    today: Optional[str] = None  # blank = today in Pacific time


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC, "index.html"))


@app.get("/app")
def app_page():
    return FileResponse(os.path.join(STATIC, "app.html"))


@app.get("/how-it-works")
def how_it_works():
    return FileResponse(os.path.join(STATIC, "how-it-works.html"))


@app.get("/about")
def about_page():
    return FileResponse(os.path.join(STATIC, "about.html"))


@app.get("/contact")
def contact_page():
    return FileResponse(os.path.join(STATIC, "contact.html"))


@app.post("/api/read")
def read(profile: Profile):
    result = engine.read(profile.model_dump())
    # Only a real cycling calendar counts; increment once per first-time setup
    # (a returning visitor's auto-restore does not re-count).
    if result.get("calendar"):
        result["social_proof"] = _bump_counter() if profile.first_time else _read_counter()
    return result


@app.get("/health")
def health():
    return {"status": "ok"}


# In-memory ICS store: client POSTs generated calendar text, gets a short
# token, then navigates to /ics/<token>.ics. iOS Safari only hands a .ics to
# the Calendar app on a plain GET navigation to a URL ending in ".ics" — a
# form-submit POST or a blob/data URL does NOT trigger it (and shows the
# "This file can't be processed" error). Token -> ICS survives in this dict.
_ICS_STORE: dict[str, str] = {}
_ics_lock = threading.Lock()


@app.post("/api/export/ics")
async def export_ics(request: Request):
    """Store a client-generated ICS and return a token. iOS then navigates to
    GET /ics/<token>.ics which returns it as text/calendar."""
    body = await request.body()
    ics = ""
    ctype = request.headers.get("content-type", "")
    if "application/json" in ctype:
        import json as _json
        try:
            data = _json.loads(body)
            ics = data.get("ics", "") if isinstance(data, dict) else ""
        except Exception:
            ics = ""
    else:
        # form submit sends application/x-www-form-urlencoded (ics=...)
        from urllib.parse import parse_qs
        try:
            parsed = parse_qs(body.decode("utf-8"))
            ics = parsed.get("ics", [""])[0]
        except Exception:
            ics = ""

    token = uuid.uuid4().hex[:16]
    with _ics_lock:
        _ICS_STORE[token] = ics
    # Redirect (303) to the .ics URL — the form submit follows it as one
    # navigation, and iOS Safari triggers the Calendar "Add All" flow when the
    # final URL ends in ".ics" with text/calendar. Returning JSON here is what
    # previously made the raw {"token": ...} show up in the browser.
    return RedirectResponse(f"/ics/{token}.ics", status_code=303)


@app.get("/ics/{filename}")
def get_ics(filename: str):
    """Return a stored ICS with a URL ending in .ics — the only path iOS Safari
    reliably opens in the Calendar app (Add All flow)."""
    token = filename[:-4] if filename.endswith(".ics") else filename
    with _ics_lock:
        ics = _ICS_STORE.pop(token, "")
    if not ics:
        return Response("Not found", status_code=404)
    return Response(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="aura-cycles.ics"'},
    )


@app.get("/sw.js")
def service_worker():
    return FileResponse(os.path.join(STATIC, "sw.js"), media_type="application/javascript")


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(os.path.join(STATIC, "manifest.webmanifest"), media_type="application/manifest+json")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
