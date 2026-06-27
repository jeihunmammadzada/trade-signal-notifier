import asyncio
import contextlib

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.service import SignalService

app = FastAPI(title="Crypto Pre-Signal System", version="1.0.0")
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
service = SignalService()


async def background_runner() -> None:
    while True:
        try:
            await asyncio.to_thread(service.run_cycle)
        except Exception as exc:  # noqa: BLE001
            print(f"Background refresh failed: {exc}")

        await asyncio.sleep(settings.refresh_seconds)


@app.on_event("startup")
async def startup_event() -> None:
    await asyncio.to_thread(service.run_cycle)
    app.state.worker = asyncio.create_task(background_runner())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    worker = getattr(app.state, "worker", None)
    if worker:
        worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/signals")
async def signals() -> dict:
    payload = service.get_all()
    if not payload["signals"]:
        raise HTTPException(status_code=503, detail="Signals are not ready yet")
    return payload
