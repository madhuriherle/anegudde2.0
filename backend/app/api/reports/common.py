from fastapi import HTTPException
from sqlalchemy import func


def period_expr(group_by: str, date_col):
    # Detect dialect at runtime if possible, or use a more portable approach.
    # Since detecting dialect here is tricky without a session, we'll use a try/except style approach in the query 
    # OR better, use the standard SQL 'extract' if supported, but to_char is more specific for formatting.
    
    # We will assume Postgres for now as it was the original intent, 
    # but I will add a detail to the error if it fails in the route.
    
    if group_by == "day":
        return func.to_char(date_col, "YYYY-MM-DD")
    if group_by == "month":
        return func.to_char(date_col, "YYYY-MM")
    if group_by == "year":
        return func.to_char(date_col, "YYYY")
    raise HTTPException(status_code=400, detail=f"Invalid group_by value: '{group_by}'. Must be day, month, or year.")
