from app.db.session import SessionLocal
from app.db.models import TokenGeneration, TokenDetail, User
from datetime import datetime, time, timezone, timedelta
from sqlalchemy import func

def seed_test_tokens():
    db = SessionLocal()
    try:
        # 1. Clear existing token data for these dates to start fresh
        db.query(TokenDetail).delete()
        db.query(TokenGeneration).delete()
        db.commit()
        print("Cleared old token data.")

        admin = db.query(User).filter(User.username == "admin").first()
        staff = db.query(User).filter(User.username == "madhuri").first()
        
        admin_id = admin.id if admin else 1
        staff_id = staff.id if staff else admin_id

        # Dates to seed
        dates = [
            (datetime(2026, 5, 5).date(), [
                (time(9, 30), 500, admin_id),
                (time(11, 15), 1000, admin_id),
                (time(14, 45), 673, staff_id)
            ]),
            (datetime(2026, 5, 6).date(), [
                (time(10, 0), 50, staff_id),
                (time(11, 30), 50, staff_id),
                (time(14, 0), 100, admin_id)
            ]),
            (datetime(2026, 5, 7).date(), [
                (time(8, 0), 20, admin_id),
                (time(11, 12), 110, admin_id),
                (time(15, 6), 10, admin_id),
                (time(15, 7), 10, admin_id)
            ])
        ]

        max_detail_id = 0
        for target_date, batches in dates:
            total_for_day = sum(count for _, count, _ in batches)
            
            # Create Generation
            gen = TokenGeneration(
                date=target_date,
                total_tokens=total_for_day,
                created_at=datetime.combine(target_date, time(8,0)).replace(tzinfo=timezone.utc),
                updated_at=datetime.combine(target_date, batches[-1][0]).replace(tzinfo=timezone.utc),
                created_by=admin_id,
                updated_by=admin_id
            )
            db.add(gen)
            db.flush()

            for t, count, user_id in batches:
                max_detail_id += 1
                dt = datetime.combine(target_date, t).replace(tzinfo=timezone.utc)
                detail = TokenDetail(
                    id=max_detail_id,
                    generation_id=gen.id,
                    token_count=count,
                    created_at=dt,
                    updated_at=dt,
                    created_by=user_id,
                    updated_by=user_id
                )
                db.add(detail)
            
            print(f"Seeded {len(batches)} entries for {target_date} (Total: {total_for_day})")

        db.commit()
        print("Successfully seeded test token history.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_tokens()
