from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import timedelta, timezone

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import ActivityLog, ConsumptionEntry, DonationEntry, PurchaseEntry, PurchaseReturnEntry, User
from app.schemas.audit import ActivityLogOut
from app.schemas.base import PaginatedResponse
import math

router = APIRouter()

PAGE_ACTIVITY_CONFIG = {
    "donations": {
        "permission": "donations.read",
        "label": "donation",
        "endpoints": (
            "/donations/create_donation",
            "/donations/update_donation",
            "/donations/delete_donation",
        ),
    },
    "purchases": {
        "permission": "purchases.read",
        "label": "purchase",
        "endpoints": (
            "/purchases/create_purchase",
            "/purchases/update_purchase",
            "/purchases/delete_purchase",
        ),
    },
    "purchase_returns": {
        "permission": "purchase_returns.read",
        "label": "purchase return",
        "endpoints": (
            "/purchases/create_return",
            "/purchases/update_return",
            "/purchases/delete_return",
        ),
    },
    "daily_usage": {
        "permission": "consumptions.read",
        "label": "usage entry",
        "endpoints": (
            "/daily-usage/create_consumption",
            "/daily-usage/update_consumption",
            "/daily-usage/delete_consumption",
        ),
    },
    "items": {
        "permission": "items.read",
        "label": "item",
        "endpoints": (
            "/items/create_item",
            "/items/update_item",
            "/items/delete_item",
        ),
    },
    "vendors": {
        "permission": "vendors.read",
        "label": "vendor",
        "endpoints": (
            "/vendors/create_vendor",
            "/vendors/update_vendor",
            "/vendors/delete_vendor",
        ),
    },
    "users": {
        "permission": "users.management.read",
        "label": "user",
        "endpoints": (
            "/users/create_user",
            "/users/update_user",
            "/users/delete_user",
        ),
    },
    "devotees": {
        "permission": "devotees.read",
        "label": "devotee",
        "endpoints": (
            "/donations/create_devotee",
            "/donations/update_devotee",
            "/donations/delete_devotee",
        ),
    },
    "menu_items": {
        "permission": "menu_items.read",
        "label": "menu item",
        "endpoints": (
            "/menu-items/create_menu_item",
            "/menu-items/update_menu_item",
            "/menu-items/delete_menu_item",
        ),
    },
    "tokens": {
        "permission": "tokens.read",
        "label": "token",
        "endpoints": (
            "/tokens/create_token",
            "/tokens/update_token",
            "/tokens/delete_token",
        ),
    },
}


def _extract_endpoint_id(endpoint: str | None) -> int | None:
    if not endpoint:
        return None
    last_part = endpoint.rstrip("/").split("/")[-1]
    return int(last_part) if last_part.isdigit() else None


def _enrich_donation_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    # Prioritize snapshot metadata if available
    if "devotee_name" in meta:
        return meta

    donation_id = _extract_endpoint_id(log.endpoint)
    donation = None

    if donation_id:
        donation = db.query(DonationEntry).filter(DonationEntry.id == donation_id).first()
    elif log.method == "POST" and log.user_id:
        window_start = log.activity_at - timedelta(seconds=10)
        window_end = log.activity_at + timedelta(seconds=10)
        donation = (
            db.query(DonationEntry)
            .filter(DonationEntry.created_by == log.user_id)
            .filter(DonationEntry.created_at >= window_start)
            .filter(DonationEntry.created_at <= window_end)
            .order_by(DonationEntry.created_at.desc(), DonationEntry.id.desc())
            .first()
        )

    if donation:
        meta["donation_id"] = donation.id
        meta["devotee_name"] = donation.devotee_name
        meta["receipt_display_number"] = donation.receipt_display_number

    return meta


def _enrich_purchase_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    # Prioritize snapshot
    if "vendor_name" in meta:
        return meta

    purchase_id = _extract_endpoint_id(log.endpoint)
    purchase = None

    if purchase_id:
        purchase = (
            db.query(PurchaseEntry)
            .options(joinedload(PurchaseEntry.vendor))
            .filter(PurchaseEntry.id == purchase_id)
            .first()
        )
    elif log.method == "POST" and log.user_id:
        window_start = log.activity_at - timedelta(seconds=10)
        window_end = log.activity_at + timedelta(seconds=10)
        purchase = (
            db.query(PurchaseEntry)
            .options(joinedload(PurchaseEntry.vendor))
            .filter(PurchaseEntry.created_by == log.user_id)
            .filter(PurchaseEntry.created_at >= window_start)
            .filter(PurchaseEntry.created_at <= window_end)
            .order_by(PurchaseEntry.created_at.desc(), PurchaseEntry.id.desc())
            .first()
        )

    if purchase:
        meta["purchase_id"] = purchase.id
        meta["vendor_name"] = purchase.vendor.vendor_name if purchase.vendor else None
        meta["bill_no"] = purchase.bill_no

    return meta


def _enrich_purchase_return_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    # Prioritize snapshot
    if "vendor_name" in meta:
        return meta

    return_id = _extract_endpoint_id(log.endpoint)
    return_entry = None

    if return_id:
        return_entry = (
            db.query(PurchaseReturnEntry)
            .options(
                joinedload(PurchaseReturnEntry.vendor),
                joinedload(PurchaseReturnEntry.purchase_entry),
            )
            .filter(PurchaseReturnEntry.id == return_id)
            .first()
        )
    elif log.method == "POST" and log.user_id:
        window_start = log.activity_at - timedelta(seconds=10)
        window_end = log.activity_at + timedelta(seconds=10)
        return_entry = (
            db.query(PurchaseReturnEntry)
            .options(
                joinedload(PurchaseReturnEntry.vendor),
                joinedload(PurchaseReturnEntry.purchase_entry),
            )
            .filter(PurchaseReturnEntry.created_by == log.user_id)
            .filter(PurchaseReturnEntry.created_at >= window_start)
            .filter(PurchaseReturnEntry.created_at <= window_end)
            .order_by(PurchaseReturnEntry.created_at.desc(), PurchaseReturnEntry.id.desc())
            .first()
        )

    if return_entry:
        meta["purchase_return_id"] = return_entry.id
        meta["vendor_name"] = return_entry.vendor.vendor_name if return_entry.vendor else None
        meta["bill_no"] = return_entry.purchase_entry.bill_no if return_entry.purchase_entry else None
        meta["return_date"] = return_entry.return_date.isoformat() if return_entry.return_date else None

    return meta


def _enrich_daily_usage_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    # Prioritize snapshot metadata if available
    if "usage_date" in meta:
        return meta

    consumption_id = _extract_endpoint_id(log.endpoint)
    consumption = None

    if consumption_id:
        consumption = db.query(ConsumptionEntry).filter(ConsumptionEntry.id == consumption_id).first()
    elif log.method == "POST" and log.user_id:
        window_start = log.activity_at - timedelta(seconds=10)
        window_end = log.activity_at + timedelta(seconds=10)
        consumption = (
            db.query(ConsumptionEntry)
            .filter(ConsumptionEntry.created_by == log.user_id)
            .filter(ConsumptionEntry.created_at >= window_start)
            .filter(ConsumptionEntry.created_at <= window_end)
            .order_by(ConsumptionEntry.created_at.desc(), ConsumptionEntry.id.desc())
            .first()
        )

    if consumption:
        meta["consumption_id"] = consumption.id
        meta["usage_date"] = consumption.usage_date.isoformat() if consumption.usage_date else None

    return meta


def _enrich_devotee_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    # Prioritize snapshot
    if "devotee_name" in meta:
        return meta

    devotee_id = _extract_endpoint_id(log.endpoint)
    if devotee_id:
        from app.db.models import Devotee
        devotee = db.query(Devotee).filter(Devotee.id == devotee_id).first()
        if devotee:
            meta["devotee_id"] = devotee.id
            meta["devotee_name"] = devotee.devotee_name

    return meta


def _enrich_item_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    if "item_name" in meta:
        return meta

    item_id = _extract_endpoint_id(log.endpoint)
    if item_id:
        from app.db.models import Item
        item = db.query(Item).filter(Item.id == item_id).first()
        if item:
            meta["item_id"] = item.id
            meta["item_name"] = item.item_name

    return meta


def _enrich_vendor_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    if "vendor_name" in meta:
        return meta

    vendor_id = _extract_endpoint_id(log.endpoint)
    if vendor_id:
        from app.db.models import Vendor
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if vendor:
            meta["vendor_id"] = vendor.id
            meta["vendor_name"] = vendor.vendor_name

    return meta


def _enrich_item_category_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    if "category_name" in meta:
        return meta

    category_id = _extract_endpoint_id(log.endpoint)
    if category_id:
        from app.db.models import ItemCategory
        cat = db.query(ItemCategory).filter(ItemCategory.id == category_id).first()
        if cat:
            meta["category_id"] = cat.id
            meta["category_name"] = cat.category_name

    return meta


def _enrich_menu_item_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")

    if "dish_name" in meta:
        return meta

    item_id = _extract_endpoint_id(log.endpoint)
    if item_id:
        from app.db.models import MenuItem
        mi = db.query(MenuItem).filter(MenuItem.id == item_id).first()
        if mi:
            meta["menu_item_id"] = mi.id
            meta["dish_name"] = mi.dish_name

    return meta


def _enrich_generic_activity_meta(log: ActivityLog, db: Session) -> dict:
    meta = dict(log.meta or {})
    meta["actor_name"] = log.user.full_name if log.user and log.user.full_name else (log.user.username if log.user else "System")
    return meta


def _activity_log_out(log: ActivityLog, db: Session | None = None) -> ActivityLogOut:
    meta = log.meta or {}
    if db and log.endpoint:
        if "/donations/" in log.endpoint:
            if any(p in log.endpoint for p in ("devotee",)):
                 meta = _enrich_devotee_activity_meta(log, db)
            else:
                 meta = _enrich_donation_activity_meta(log, db)
        elif any(path in log.endpoint for path in ("/purchases/create_return", "/purchases/update_return", "/purchases/delete_return")):
            meta = _enrich_purchase_return_activity_meta(log, db)
        elif "/purchases/" in log.endpoint:
            meta = _enrich_purchase_activity_meta(log, db)
        elif "/daily-usage/" in log.endpoint:
            meta = _enrich_daily_usage_activity_meta(log, db)
        elif "/items/" in log.endpoint:
            meta = _enrich_item_activity_meta(log, db)
        elif "/vendors/" in log.endpoint:
            meta = _enrich_vendor_activity_meta(log, db)
        elif "/item-categories/" in log.endpoint:
            meta = _enrich_item_category_activity_meta(log, db)
        elif "/menu-items/" in log.endpoint:
            meta = _enrich_menu_item_activity_meta(log, db)
        else:
            meta = _enrich_generic_activity_meta(log, db)
    elif log.user:
        meta = dict(meta)
        meta["actor_name"] = log.user.full_name or log.user.username

    return ActivityLogOut(**{
        "id": log.id,
        "user_id": log.user_id,
        "username": log.user.username if log.user else "System",
        "activity_at": log.activity_at.replace(tzinfo=timezone.utc) if log.activity_at.tzinfo is None else log.activity_at,
        "method": log.method,
        "endpoint": log.endpoint,
        "action": log.action,
        "activity_status": log.activity_status,
        "reason": log.reason,
        "http_status_code": log.http_status_code,
        "ip_address": log.ip_address,
        "duration_ms": log.duration_ms,
        "meta": meta
    })

@router.get("/summary", response_model=dict)
def get_activity_summary(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("activity_logs.read")),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    username: str | None = Query(None),
):
    from datetime import datetime, time
    
    query = db.query(ActivityLog)
    
    if username:
        query = query.join(ActivityLog.user).filter(User.username.ilike(f"%{username}%"))
    
    if start_date:
        start_dt = datetime.combine(datetime.fromisoformat(start_date).date(), time.min)
        query = query.filter(ActivityLog.activity_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(datetime.fromisoformat(end_date).date(), time.max)
        query = query.filter(ActivityLog.activity_at <= end_dt)

    total = query.count()
    success = query.filter(ActivityLog.activity_status == "SUCCESS").count()
    failed = query.filter(ActivityLog.activity_status == "FAILED").count()
    
    important = query.filter(
        or_(
            ActivityLog.method.in_(("POST", "PUT", "DELETE")),
            ActivityLog.endpoint.contains("/auth/login")
        )
    ).count()

    return {
        "total": total,
        "success": success,
        "failed": failed,
        "important": important
    }

@router.get("/list_activity_logs", response_model=PaginatedResponse[ActivityLogOut])
def list_activity_logs(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("activity_logs.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    username: str | None = Query(None),
    status: str | None = Query(None),
    activity_type: str | None = Query(None), # 'important', 'all', 'login', 'create', 'edit', 'delete', 'payment', 'stock'
    method: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
):
    from datetime import datetime, time
    query = db.query(ActivityLog).options(joinedload(ActivityLog.user))
    
    if username:
        query = query.join(ActivityLog.user).filter(User.username.ilike(f"%{username}%"))
    if status:
        query = query.filter(ActivityLog.activity_status == status)
    
    if start_date:
        start_dt = datetime.combine(datetime.fromisoformat(start_date).date(), time.min)
        query = query.filter(ActivityLog.activity_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(datetime.fromisoformat(end_date).date(), time.max)
        query = query.filter(ActivityLog.activity_at <= end_dt)

    if method:
        query = query.filter(ActivityLog.method == method)
    elif activity_type:
        if activity_type == 'important':
            query = query.filter(
                or_(
                    ActivityLog.method.in_(("POST", "PUT", "DELETE")),
                    ActivityLog.endpoint.contains("/auth/login")
                )
            )
        elif activity_type == 'login':
            query = query.filter(or_(
                ActivityLog.endpoint.contains("/auth/login"),
                ActivityLog.endpoint.contains("/auth/logout")
            ))
        elif activity_type == 'create':
            query = query.filter(ActivityLog.method == "POST").filter(~ActivityLog.endpoint.contains("/auth/"))
        elif activity_type == 'edit':
            query = query.filter(ActivityLog.method == "PUT")
        elif activity_type == 'delete':
            query = query.filter(ActivityLog.method == "DELETE")
        elif activity_type == 'payment':
            query = query.filter(or_(
                ActivityLog.endpoint.contains("/donations/"),
                ActivityLog.endpoint.contains("/tokens/"),
                ActivityLog.endpoint.contains("/purchases/")
            ))
        elif activity_type == 'stock':
            query = query.filter(or_(
                ActivityLog.endpoint.contains("/items/"),
                ActivityLog.endpoint.contains("/daily-usage/"),
                ActivityLog.endpoint.contains("/wastages/"),
                ActivityLog.endpoint.contains("/stock-adjustments/"),
                ActivityLog.endpoint.contains("/purchases/")
            ))

    query = query.order_by(ActivityLog.activity_at.desc(), ActivityLog.id.desc())
    
    total = query.count()
    offset = (page - 1) * page_size
    logs = query.offset(offset).limit(page_size).all()
    
    res_items = [_activity_log_out(log, db) for log in logs]

    return {
        "items": res_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }


@router.get("/page_activity", response_model=PaginatedResponse[ActivityLogOut])
def list_page_activity_logs(
    page_key: str = Query(..., alias="page"),
    page_size: int = Query(20, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = PAGE_ACTIVITY_CONFIG.get(page_key)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid activity page",
        )

    PermissionChecker(config["permission"])(current_user)

    query = (
        db.query(ActivityLog)
        .options(joinedload(ActivityLog.user))
        .filter(ActivityLog.method.in_(("POST", "PUT", "DELETE")))
        .filter(or_(*[ActivityLog.endpoint.contains(endpoint) for endpoint in config["endpoints"]]))
        .order_by(ActivityLog.activity_at.desc())
    )

    total = query.count()
    logs = query.limit(page_size).all()

    return {
        "items": [_activity_log_out(log, db) for log in logs],
        "total": total,
        "page": 1,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }


@router.get("/list", response_model=PaginatedResponse[ActivityLogOut])
def list_activity_logs_legacy(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("activity_logs.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    username: str | None = Query(None),
    status: str | None = Query(None),
):
    return list_activity_logs(db, _, page, page_size, username, status)

