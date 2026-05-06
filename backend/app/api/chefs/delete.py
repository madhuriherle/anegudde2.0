from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import Chef, User

router = APIRouter()

@router.delete("/delete_chef/{chef_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chef(
    *,
    db: Session = Depends(get_db),
    chef_id: int,
    _: User = Depends(get_current_user)
):
    chef = db.query(Chef).filter(Chef.id == chef_id).first()
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    
    chef.status = 0
    db.commit()
    return None
