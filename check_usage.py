import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import ConsumptionEntry, ConsumptionItem, Item

db = SessionLocal()
entries = db.query(ConsumptionEntry).order_by(ConsumptionEntry.id.desc()).limit(5).all()
print(f"Latest consumption entries:")
for e in entries:
    items = db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == e.id).all()
    for it in items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        print(f"  usage_id={e.id} date={e.usage_date} item={item.item_name if item else '?'} used={float(it.quantity_used)} returned={float(it.qty_returned)}")
db.close()
