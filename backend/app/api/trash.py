from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from datetime import datetime, timezone
from pydantic import BaseModel
from decimal import Decimal

from app.api.deps import get_db, PermissionChecker
from app.db.models import (
    Role, User, Vendor, Unit, DonationType,
    DonationAmountMaster, MenuItem, ItemCategory, Item, Devotee,
    PurchaseEntry, ConsumptionEntry, WastageEntry, DonationEntry, PurchaseReturnEntry
)

router = APIRouter(prefix="/trash", tags=["Trash / Recycle Bin"])

# Models configuration mapping: (SQLAlchemy model class, fallback name column, human-friendly display label)
models_map = {
    "item": (Item, "item_name", "Item"),
    "menu_item": (MenuItem, "dish_name", "Menu Item"),
    "vendor": (Vendor, "vendor_name", "Vendor"),
    "item_category": (ItemCategory, "category_name", "Item Category"),
    "donation_type": (DonationType, "type_name", "Donation Type"),
    "donation_amount_master": (DonationAmountMaster, "title", "Donation Amount Master"),
    "role": (Role, "role_name", "Role"),
    "user": (User, "full_name", "User"),
    "unit": (Unit, "unit_name", "Unit"),
    "devotee": (Devotee, "devotee_name", "Devotee"),
    # Transaction models
    "purchase": (PurchaseEntry, "bill_no", "Purchase"),
    "consumption": (ConsumptionEntry, "remarks", "Daily Usage"),
    "wastage": (WastageEntry, "id", "Wastage"),
    "donation": (DonationEntry, "receipt_display_number", "Donation"),
    "purchase_return": (PurchaseReturnEntry, "remarks", "Purchase Return"),
}

class TrashActionPayload(BaseModel):
    type: str
    id: int
    force: bool = False

def resolve_references_for_force_delete(db: Session, type_key: str, record_id: int):
    # 1. Purchase
    if type_key == "purchase":
        db.execute(
            text("UPDATE purchase_return_entries SET purchase_entry_id = NULL WHERE purchase_entry_id = :rid"),
            {"rid": record_id}
        )
        db.execute(
            text("UPDATE item_prices SET purchase_entry_id = NULL WHERE purchase_entry_id = :rid"),
            {"rid": record_id}
        )
    # 2. Donation Type
    elif type_key == "donation_type":
        fallback_type = db.execute(
            text("SELECT id FROM donation_types WHERE status = 1 AND id != :rid AND is_deleted = false LIMIT 1"),
            {"rid": record_id}
        ).fetchone()
        fallback_id = fallback_type[0] if fallback_type else 1
        db.execute(
            text("UPDATE donation_entries SET donation_type = :fallback WHERE donation_type = :rid"),
            {"fallback": fallback_id, "rid": record_id}
        )
        db.execute(
            text("UPDATE receipt_sequences SET donation_type_id = NULL WHERE donation_type_id = :rid"),
            {"rid": record_id}
        )
    # 3. Item Category
    elif type_key == "item_category":
        db.execute(
            text("UPDATE items SET category_id = NULL WHERE category_id = :rid"),
            {"rid": record_id}
        )
    # 4. Role
    elif type_key == "role":
        db.execute(
            text("UPDATE users SET role_id = NULL WHERE role_id = :rid"),
            {"rid": record_id}
        )
    # 5. User
    elif type_key == "user":
        user_ref_tables = [
            "purchase_entries", "donation_entries", "wastage_entries", "consumption_entries", 
            "purchase_return_entries", "devotees", "items", "menu_items", "vendors", 
            "item_categories", "donation_types", "donation_amount_masters", "roles", 
            "units", "privileges", "role_privileges", "printer_configs", "financial_years", "users"
        ]
        for tbl in user_ref_tables:
            db.execute(
                text(f"UPDATE {tbl} SET created_by = NULL WHERE created_by = :uid"),
                {"uid": record_id}
            )
            db.execute(
                text(f"UPDATE {tbl} SET updated_by = NULL WHERE updated_by = :uid"),
                {"uid": record_id}
            )
            if tbl not in ["privileges", "role_privileges", "printer_configs", "financial_years"]:
                db.execute(
                    text(f"UPDATE {tbl} SET deleted_by_id = NULL WHERE deleted_by_id = :uid"),
                    {"uid": record_id}
                )
    # 6. Vendor
    elif type_key == "vendor":
        db.execute(
            text("DELETE FROM purchase_return_entries WHERE vendor_id = :rid"),
            {"rid": record_id}
        )
        db.execute(
            text("DELETE FROM purchase_entries WHERE vendor_id = :rid"),
            {"rid": record_id}
        )
    # 7. Item
    elif type_key == "item":
        db.execute(text("DELETE FROM stock_ledger WHERE item_id = :rid"), {"rid": record_id})
        db.execute(text("DELETE FROM item_prices WHERE item_id = :rid"), {"rid": record_id})
        db.execute(text("DELETE FROM purchase_items WHERE item_id = :rid"), {"rid": record_id})
        db.execute(text("DELETE FROM consumption_items WHERE item_id = :rid"), {"rid": record_id})
        db.execute(text("DELETE FROM wastage_items WHERE item_id = :rid"), {"rid": record_id})
        db.execute(text("DELETE FROM donation_items WHERE item_id = :rid"), {"rid": record_id})
        db.execute(text("DELETE FROM purchase_return_items WHERE item_id = :rid"), {"rid": record_id})
    # 8. Menu Item
    elif type_key == "menu_item":
        db.execute(
            text("UPDATE wastage_items SET menu_item_id = NULL WHERE menu_item_id = :rid"),
            {"rid": record_id}
        )
        db.execute(
            text("DELETE FROM token_details WHERE menu_item_id = :rid"),
            {"rid": record_id}
        )
    # 9. Devotee
    elif type_key == "devotee":
        db.execute(
            text("UPDATE donation_entries SET devotee_id = NULL WHERE devotee_id = :rid"),
            {"rid": record_id}
        )

@router.get("/")
def get_trash_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recycle_bin.read"))
):
    trash_items = []
    for type_key, (model_cls, name_col, display_label) in models_map.items():
        query = db.query(model_cls).filter(model_cls.is_deleted == True)
        
        # Load related items/details for transaction display or loading deleted_by relation
        rows = query.options(joinedload(model_cls.deleted_by)).all()
            
        for row in rows:
            # Generate descriptive readable name for transactions
            if type_key == "purchase":
                name = f"Bill {row.bill_no}" if row.bill_no else f"Purchase Entry #{row.id}"
            elif type_key == "consumption":
                name = f"Usage Entry #{row.id} - {row.remarks[:30]}" if row.remarks else f"Usage Entry #{row.id}"
            elif type_key == "wastage":
                name = f"Wastage Entry #{row.id} ({row.wastage_date})"
            elif type_key == "donation":
                name = f"Donation {row.receipt_display_number} - {row.devotee_name}" if row.receipt_display_number else f"Donation #{row.id} - {row.devotee_name}"
            elif type_key == "purchase_return":
                name = f"Purchase Return #{row.id} - {row.remarks[:30]}" if row.remarks else f"Purchase Return #{row.id}"
            else:
                name = getattr(row, name_col, "Unknown")

            trash_items.append({
                "id": row.id,
                "type": type_key,
                "type_label": display_label,
                "name": name,
                "deleted_at": row.deleted_at,
                "deleted_by": row.deleted_by.full_name if row.deleted_by else "System",
            })

    # Sort by deleted_at descending safely using ISO strings
    trash_items.sort(
        key=lambda x: x["deleted_at"].isoformat() if x["deleted_at"] else "",
        reverse=True
    )
    return trash_items

@router.post("/restore")
def restore_trash_item(
    payload: TrashActionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recycle_bin.write"))
):
    model_info = models_map.get(payload.type)
    if not model_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid type: {payload.type}"
        )

    model_cls, _, display_label = model_info
    
    # Eager load items for transactions to apply stock updates
    query = db.query(model_cls).filter(model_cls.id == payload.id, model_cls.is_deleted == True)
    if payload.type in ["purchase", "consumption", "wastage", "donation", "purchase_return"]:
        row = query.options(joinedload(model_cls.items)).first()
    else:
        row = query.first()
        
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{display_label} not found in Recycle Bin."
        )

    # Re-apply transaction state and stock adjustments if it is a transaction
    if payload.type == "purchase":
        row.status = 1
        for item in row.items:
            raw_item = db.query(Item).filter(Item.id == item.item_id).first()
            if raw_item:
                raw_item.current_stock = Decimal(raw_item.current_stock or 0) + Decimal(item.quantity or 0)
        db.execute(
            text("UPDATE stock_ledger SET status = 1 WHERE ref_table = 'purchase_entries' AND ref_id = :rid"),
            {"rid": row.id}
        )
    elif payload.type == "consumption":
        row.status = 1
        for line in row.items:
            item = db.query(Item).filter(Item.id == line.item_id).first()
            if item:
                item.current_stock = Decimal(item.current_stock or 0) - Decimal(line.net_quantity or 0)
        db.execute(
            text("UPDATE stock_ledger SET status = 1 WHERE ref_table LIKE 'consumption_entries%' AND ref_id = :rid"),
            {"rid": row.id}
        )
    elif payload.type == "wastage":
        row.status = 1
        for w_item in row.items:
            if w_item.item_id:
                item = db.query(Item).filter(Item.id == w_item.item_id).first()
                if item:
                    item.current_stock = Decimal(item.current_stock or 0) - Decimal(str(w_item.quantity))
        db.execute(
            text("UPDATE stock_ledger SET status = 1 WHERE ref_table = 'wastage_items' AND ref_id = :rid"),
            {"rid": row.id}
        )
    elif payload.type == "donation":
        row.status = 1
        for donation_item in row.items:
            item = db.query(Item).filter(Item.id == donation_item.item_id).first()
            if item:
                item.current_stock = Decimal(item.current_stock or 0) + Decimal(donation_item.quantity or 0)
        db.execute(
            text("UPDATE stock_ledger SET status = 1 WHERE ref_table = 'donation_entries' AND ref_id = :rid"),
            {"rid": row.id}
        )
    elif payload.type == "purchase_return":
        row.status = 1
        for it in row.items:
            item = db.query(Item).filter(Item.id == it.item_id).first()
            if item:
                item.current_stock = Decimal(item.current_stock or 0) - Decimal(it.quantity or 0)
        db.execute(
            text("UPDATE stock_ledger SET status = 1 WHERE ref_table = 'purchase_return_entries' AND ref_id = :rid"),
            {"rid": row.id}
        )

    # Restore the record
    row.is_deleted = False
    row.deleted_at = None
    row.deleted_by_id = None

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot restore this {display_label} because it violates a database unique constraint."
        )

    return {"status": "success", "message": f"{display_label} restored successfully."}

@router.post("/delete_permanent")
def permanently_delete_item(
    payload: TrashActionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recycle_bin.delete"))
):
    model_info = models_map.get(payload.type)
    if not model_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid type: {payload.type}"
        )

    model_cls, _, display_label = model_info
    row = (
        db.query(model_cls)
        .filter(model_cls.id == payload.id, model_cls.is_deleted == True)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{display_label} not found in Recycle Bin."
        )

    if payload.force:
        resolve_references_for_force_delete(db, payload.type, payload.id)

    # Delete related stock ledger rows if it is a transaction
    if payload.type == "purchase":
        db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'purchase_entries' AND ref_id = :rid"), {"rid": payload.id})
    elif payload.type == "consumption":
        db.execute(text("DELETE FROM stock_ledger WHERE ref_table LIKE 'consumption_entries%' AND ref_id = :rid"), {"rid": payload.id})
    elif payload.type == "wastage":
        db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'wastage_items' AND ref_id = :rid"), {"rid": payload.id})
    elif payload.type == "donation":
        db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'donation_entries' AND ref_id = :rid"), {"rid": payload.id})
    elif payload.type == "purchase_return":
        db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'purchase_return_entries' AND ref_id = :rid"), {"rid": payload.id})

    db.delete(row)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot permanently delete this {display_label} because other active records in the system depend on it."
        )

    return {"status": "success", "message": f"{display_label} permanently deleted."}

@router.post("/empty")
def empty_trash(
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("recycle_bin.delete"))
):
    # Specific order to respect foreign key dependencies: Transactions first, then child setup, then parent setup tables
    delete_order = [
        ("purchase_return", PurchaseReturnEntry, "Purchase Return"),
        ("purchase", PurchaseEntry, "Purchase"),
        ("consumption", ConsumptionEntry, "Daily Usage"),
        ("wastage", WastageEntry, "Wastage"),
        ("donation", DonationEntry, "Donation"),
        ("item", Item, "Item"),
        ("menu_item", MenuItem, "Menu Item"),
        ("user", User, "User"),
        ("devotee", Devotee, "Devotee"),
        ("item_category", ItemCategory, "Item Category"),
        ("vendor", Vendor, "Vendor"),
        ("donation_amount_master", DonationAmountMaster, "Donation Amount Master"),
        ("donation_type", DonationType, "Donation Type"),
        ("unit", Unit, "Unit"),
        ("role", Role, "Role"),
    ]

    succeeded_count = 0
    failed_items = []

    for type_key, model_cls, display_label in delete_order:
        rows = db.query(model_cls).filter(model_cls.is_deleted == True).all()
        for row in rows:
            # Generate descriptive readable name
            if type_key == "purchase":
                name_val = f"Bill {row.bill_no}" if row.bill_no else f"Purchase Entry #{row.id}"
            elif type_key == "consumption":
                name_val = f"Usage Entry #{row.id}"
            elif type_key == "wastage":
                name_val = f"Wastage Entry #{row.id}"
            elif type_key == "donation":
                name_val = f"Donation {row.receipt_display_number}" if row.receipt_display_number else f"Donation #{row.id}"
            elif type_key == "purchase_return":
                name_val = f"Purchase Return #{row.id}"
            else:
                _, name_col, _ = models_map[type_key]
                name_val = getattr(row, name_col, "Unknown")

            # Try deleting each record in a subtransaction/savepoint
            db.begin_nested()
            try:
                if force:
                    resolve_references_for_force_delete(db, type_key, row.id)

                # Delete related stock ledger rows if it is a transaction
                if type_key == "purchase":
                    db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'purchase_entries' AND ref_id = :rid"), {"rid": row.id})
                elif type_key == "consumption":
                    db.execute(text("DELETE FROM stock_ledger WHERE ref_table LIKE 'consumption_entries%' AND ref_id = :rid"), {"rid": row.id})
                elif type_key == "wastage":
                    db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'wastage_items' AND ref_id = :rid"), {"rid": row.id})
                elif type_key == "donation":
                    db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'donation_entries' AND ref_id = :rid"), {"rid": row.id})
                elif type_key == "purchase_return":
                    db.execute(text("DELETE FROM stock_ledger WHERE ref_table = 'purchase_return_entries' AND ref_id = :rid"), {"rid": row.id})

                db.delete(row)
                db.commit()
                succeeded_count += 1
            except IntegrityError:
                db.rollback()
                failed_items.append({
                    "id": row.id,
                    "type": type_key,
                    "type_label": display_label,
                    "name": name_val,
                    "reason": "Referenced by other active database records."
                })

    # Final commit for the main transaction
    db.commit()

    return {
        "status": "success",
        "succeeded_count": succeeded_count,
        "failed_count": len(failed_items),
        "failed_items": failed_items
    }
