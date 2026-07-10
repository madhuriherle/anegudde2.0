"""
Seed default menu items (and the units they depend on).

Run from the backend/ directory:
    python scripts/seed_menu_items.py
"""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.models import Unit, MenuItem

UNITS = [
    {"unit_name": "Kilogram", "unit_code": "kg"},
    {"unit_name": "Litre", "unit_code": "ltr"},
]

MENU_ITEMS = [
    {"dish_name": "ಅನ್ನ (Rice)", "unit_code": "kg", "default_approx_amount": "50.00"},
    {"dish_name": "ಸಾರು (Rasam)", "unit_code": "ltr", "default_approx_amount": "100.00"},
    {"dish_name": "ಹುಳಿ (Huli)", "unit_code": "ltr", "default_approx_amount": "100.00"},
    {"dish_name": "ಪಲ್ಯ (Palya)", "unit_code": "kg", "default_approx_amount": None},
    {"dish_name": "ಚಟ್ನಿ (Chatni)", "unit_code": "kg", "default_approx_amount": "0.00"},
    {"dish_name": "ಪಾಯಸ (Payasam)", "unit_code": "ltr", "default_approx_amount": None},
    {"dish_name": "ಮಜ್ಜಿಗೆ (Buttermilk)", "unit_code": "ltr", "default_approx_amount": None},
]


def get_or_create_unit(db, unit_name, unit_code):
    unit = db.query(Unit).filter(Unit.unit_code == unit_code, Unit.is_deleted.is_(False)).first()
    if unit:
        return unit
    unit = Unit(unit_name=unit_name, unit_code=unit_code, status=1)
    db.add(unit)
    db.flush()
    print(f"  created unit: {unit_name} ({unit_code})")
    return unit


def get_or_create_menu_item(db, dish_name, unit_id, default_approx_amount):
    item = db.query(MenuItem).filter(MenuItem.dish_name == dish_name, MenuItem.is_deleted.is_(False)).first()
    if item:
        item.unit_id = unit_id
        item.default_approx_amount = default_approx_amount
        item.status = 1
        print(f"  updated menu item: {dish_name}")
        return item
    item = MenuItem(
        dish_name=dish_name,
        unit_id=unit_id,
        default_approx_amount=default_approx_amount,
        status=1,
    )
    db.add(item)
    print(f"  created menu item: {dish_name}")
    return item


def main():
    db = SessionLocal()
    try:
        units_by_code = {}
        for u in UNITS:
            unit = get_or_create_unit(db, u["unit_name"], u["unit_code"])
            units_by_code[u["unit_code"]] = unit
        db.flush()

        for m in MENU_ITEMS:
            unit = units_by_code[m["unit_code"]]
            get_or_create_menu_item(db, m["dish_name"], unit.id, m["default_approx_amount"])

        db.commit()
        print("Menu items seeded successfully.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
