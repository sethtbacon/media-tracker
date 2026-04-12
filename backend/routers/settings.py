from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import SystemSetting
from schemas import SettingOut, SettingUpdate

router = APIRouter()


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
