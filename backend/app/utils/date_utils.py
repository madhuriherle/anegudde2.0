from datetime import datetime, timezone, timedelta

def get_today_ist():
    # IST is UTC+5:30
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).date()
