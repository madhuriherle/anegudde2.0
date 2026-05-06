from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import Chef, User
from app.schemas.chef import ChefBase, ChefOut

router = APIRouter()

@router.put("/update_chef/{chef_id}", response_model=ChefOut)
def update_chef(
    *,
    db: Session = Depends(get_db),
    chef_id: int,
    chef_in: ChefBase,
    current_user: User = Depends(get_current_user)
):
    chef = db.query(Chef).filter(Chef.id == chef_id).first()
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    
    chef.chef_name = chef_in.chef_name
    chef.phone = chef_in.phone
    chef.status = chef_in.status
    chef.updated_by = current_user.id
    
    db.commit()
    db.refresh(chef)
    return chef
