# -*- coding: utf-8 -*-
from decimal import Decimal

from app.db.session import SessionLocal
from app.db.models import Item, ItemCategory, Unit


def main() -> None:
    db = SessionLocal()
    try:
        categories = {c.category_name: c.id for c in db.query(ItemCategory).all()}
        units = {u.unit_code.lower(): u.id for u in db.query(Unit).all()}

        def pick_category(*names: str) -> int | None:
            for name in names:
                if name in categories:
                    return categories[name]
            return None

        kg_id = units.get("kg")
        pkt_id = units.get("pkt")
        if not kg_id or not pkt_id:
            raise RuntimeError("Required units not found: kg/pkt")

        target = [
            # (Kannada Name, English Match Key, Category options, Unit ID)
            ("ಹಿಂಗು", "Hing", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಏಲಕ್ಕಿ", "Cardamom", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಲವಂಗ", "Cloves", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಅರಿಶಿಣ ಪುಡಿ", "Turmeric", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], pkt_id),
            ("ತೊಗರಿ ಬೇಳೆ", "Toor Dal", ["ಬೇಳೆಕಾಳುಗಳು"], kg_id),
            ("ಅವಲಕ್ಕಿ", "Avalaki", ["ಧಾನ್ಯಗಳು"], kg_id),
            ("ಚಹಾ ಪುಡಿ", "Tea Powder", ["ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಕಾಫಿ ಪುಡಿ", "Coffee Powder", ["ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಸಕ್ಕರೆ", "Sugar", ["ಸಿಹಿ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಮೆಂತೆ", "Methi", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಜೀರಿಗೆ", "Jeera", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಸಾಸಿವೆ", "Mustard", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಕೆಂಪು ಮೆಣಸಿನಕಾಯಿ", "Red Chilly", ["ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಹುಣಸೆ ಹಣ್ಣು", "Tamarind", ["ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು"], kg_id),
            ("ಬೆಲ್ಲ", "Jaggery", ["ಸಿಹಿ ಪದಾರ್ಥಗಳು"], kg_id),
            ("ಉಪ್ಪು", "Salt", ["ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು"], pkt_id),
        ]

        all_items = db.query(Item).all()

        def find_existing(kannada_name: str, english_key: str) -> Item | None:
            for item in all_items:
                n = (item.item_name or "").strip()
                if n == kannada_name or n.startswith(f"{kannada_name} ("):
                    return item
            for item in all_items:
                n = (item.item_name or "").strip().lower()
                if english_key.lower() in n:
                    return item
            return None

        updated = 0
        created = 0
        for kannada_name, english_key, category_options, unit_id in target:
            category_id = pick_category(*category_options)
            if not category_id:
                continue

            existing = find_existing(kannada_name, english_key)
            if existing:
                changed = False
                if existing.item_name != kannada_name:
                    existing.item_name = kannada_name
                    changed = True
                if existing.category_id != category_id:
                    existing.category_id = category_id
                    changed = True
                if existing.unit_id != unit_id:
                    existing.unit_id = unit_id
                    changed = True
                if existing.status != 1:
                    existing.status = 1
                    changed = True
                if existing.default_price is None:
                    existing.default_price = Decimal("0")
                    changed = True
                if changed:
                    updated += 1
            else:
                db.add(
                    Item(
                        item_name=kannada_name,
                        category_id=category_id,
                        unit_id=unit_id,
                        opening_stock=Decimal("0"),
                        current_stock=Decimal("0"),
                        default_price=Decimal("0"),
                        min_stock_level=Decimal("0"),
                        max_stock_level=Decimal("0"),
                        status=1,
                    )
                )
                created += 1

        db.commit()
        print(f"UPDATED={updated}")
        print(f"CREATED={created}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

