from fastapi import HTTPException
from sqlalchemy import func


def period_expr(group_by: str, date_col):
    if group_by == "day":
        return func.to_char(date_col, "YYYY-MM-DD")
    if group_by == "month":
        return func.to_char(date_col, "YYYY-MM")
    if group_by == "year":
        return func.to_char(date_col, "YYYY")
    raise HTTPException(status_code=400, detail="group_by must be day, month, or year")
