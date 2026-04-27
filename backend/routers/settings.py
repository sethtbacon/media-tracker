from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from database import get_db
from models import SystemSetting
from schemas import SettingOut, SettingUpdate

router = APIRouter()

_FAVICON_PATH  = Path("/app/data/favicon_custom")
_FAVICON_MIME  = Path("/app/data/favicon_custom.mimetype")
_ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/gif",
    "image/webp", "image/x-icon", "image/svg+xml",
}


@router.post("/settings/favicon")
async def upload_favicon(file: UploadFile = File(...)):
    ct = file.content_type or "image/png"
    if ct not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported type: {ct}")
    _FAVICON_PATH.write_bytes(await file.read())
    _FAVICON_MIME.write_text(ct)
    return {"ok": True}


@router.get("/settings/favicon")
def get_favicon():
    if not _FAVICON_PATH.exists():
        return RedirectResponse(url="/favicon.svg", status_code=302)
    ct = _FAVICON_MIME.read_text() if _FAVICON_MIME.exists() else "image/png"
    return Response(
        content=_FAVICON_PATH.read_bytes(),
        media_type=ct,
        headers={"Cache-Control": "no-cache"},
    )


@router.delete("/settings/favicon")
def delete_favicon():
    for p in (_FAVICON_PATH, _FAVICON_MIME):
        if p.exists():
            p.unlink()
    return {"ok": True}


def _get_setting(db: Session, key: str, default: str = "") -> str:
    """Internal helper: fetch a setting value by key, with a fallback default."""
    s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return s.value if s and s.value is not None else default


@router.get("/settings/", response_model=List[SettingOut])
def get_all_settings(db: Session = Depends(get_db)):
    return db.query(SystemSetting).all()


@router.get("/settings/{key}", response_model=SettingOut)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    return setting


@router.put("/settings/{key}", response_model=SettingOut)
def upsert_setting(key: str, data: SettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        setting.value = data.value
    else:
        setting = SystemSetting(key=key, value=data.value)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting
