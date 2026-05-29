from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List

from app.db.models import Module, Privilege, User
from app.schemas.module import ModuleCreate, ModuleUpdate, ModuleOut
from app.api.deps import PermissionChecker, get_current_user, get_db

router = APIRouter(prefix="/modules", tags=["modules"])

@router.post("/", response_model=ModuleOut)
def create_module(
    *,
    db: Session = Depends(get_db),
    module_in: ModuleCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new module. Strictly for Rank 1 (Super Admin/Developer).
    """
    if not current_user.role or current_user.role.rank_level != 1:
        raise HTTPException(status_code=403, detail="Strictly reserved for Developer (Rank 1)")
    
    db_obj = Module(
        **module_in.model_dump(),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.get("/menu", response_model=List[ModuleOut])
def get_user_menu(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the menu structure filtered by user permissions and Rank.
    """
    roots = (
        db.query(Module)
        .options(
            selectinload(Module.submodules).selectinload(Module.submodules),
            selectinload(Module.privileges)
        )
        .filter(Module.parent_id == None, Module.status == 1)
        .order_by(Module.display_order)
        .all()
    )
    
    user_privileges = set()
    is_all_access = False
    my_rank = 99
    if current_user.role:
        is_all_access = current_user.role.is_all_access
        my_rank = current_user.role.rank_level
        if not is_all_access:
            user_privileges = {
                rp.privilege.privilege_name
                for rp in current_user.role.privileges
                if rp.status == 1 and rp.privilege and rp.privilege.status == 1
            }
    
    def build_tree(module):
        # Rank-based module restriction check
        if module.min_rank_level is not None and my_rank > module.min_rank_level:
            return None

        has_active_children = any(sm.status == 1 for sm in module.submodules)

        # 1. Filter submodules first
        visible_submodules = []
        visible_child_keys = set()
        for sm in module.submodules:
            if sm.status == 1:
                sub_tree = build_tree(sm)
                if sub_tree:
                    child_key = sub_tree["route"] or f"name:{sub_tree['name'].lower()}"
                    if child_key in visible_child_keys:
                        continue
                    visible_child_keys.add(child_key)
                    visible_submodules.append(sub_tree)
        
        # 2. Check if this module itself should be visible
        should_be_visible = False
        
        module_privs = {
            p.privilege_name
            for p in module.privileges
            if p.status == 1 and p.privilege_name.endswith(".read")
        }

        if is_all_access:
            should_be_visible = bool(visible_submodules or module.route or module.parent_id is None)
        else:
            if visible_submodules:
                should_be_visible = True
            elif module.route and module_privs & user_privileges:
                should_be_visible = True

        if not should_be_visible:
            return None

        return {
            "id": module.id,
            "name": module.name,
            "icon": module.icon,
            "route": module.route,
            "opens_module_id": module.opens_module_id,
            "display_order": module.display_order,
            "min_rank_level": module.min_rank_level,
            "status": module.status,
            "parent_id": module.parent_id,
            "created_at": module.created_at,
            "updated_at": module.updated_at,
            "created_by": module.created_by,
            "updated_by": module.updated_by,
            "submodules": sorted(visible_submodules, key=lambda x: x["display_order"]),
            "privileges": [
                {
                    "id": p.id,
                    "privilege_name": p.privilege_name,
                    "description": p.description,
                    "status": p.status
                } for p in module.privileges if p.status == 1
            ]
        }

    final_menu = []
    for root in roots:
        tree = build_tree(root)
        if tree:
            final_menu.append(tree)
            
    return final_menu

@router.get("/privilege-tree", response_model=List[ModuleOut])
def get_privilege_tree(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the complete active module tree with linked privileges for role assignment.
    Filtered by rank to prevent non-superadmins from seeing Developer modules.
    """
    # Permission check for accessing this tree
    if not (current_user.role and current_user.role.is_all_access):
        # Regular users need specific privilege
        user_privileges = {
            rp.privilege.privilege_name
            for rp in current_user.role.privileges
            if rp.status == 1 and rp.privilege and rp.privilege.status == 1
        }
        if "users.privileges.read" not in user_privileges:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    my_rank = current_user.role.rank_level if current_user.role else 99

    modules = (
        db.query(Module)
        .options(selectinload(Module.privileges))
        .filter(Module.status == 1)
        .order_by(Module.display_order, Module.id)
        .all()
    )

    modules_by_parent = {}
    for module in modules:
        modules_by_parent.setdefault(module.parent_id, []).append(module)

    def build_tree(module):
        # Rank-based module restriction check for the privilege tree
        if module.min_rank_level is not None and my_rank > module.min_rank_level:
            return None

        active_privileges = sorted(
            [privilege for privilege in module.privileges if privilege.status == 1],
            key=lambda privilege: privilege.privilege_name
        )

        submodules = []
        for child in modules_by_parent.get(module.id, []):
            if child.status == 1:
                child_tree = build_tree(child)
                if child_tree:
                    submodules.append(child_tree)

        return {
            "id": module.id,
            "name": module.name,
            "icon": module.icon,
            "route": module.route,
            "opens_module_id": module.opens_module_id,
            "display_order": module.display_order,
            "min_rank_level": module.min_rank_level,
            "status": module.status,
            "parent_id": module.parent_id,
            "created_at": module.created_at,
            "updated_at": module.updated_at,
            "created_by": module.created_by,
            "updated_by": module.updated_by,
            "submodules": submodules,
            "privileges": [
                {
                    "id": privilege.id,
                    "privilege_name": privilege.privilege_name,
                    "description": privilege.description,
                    "status": privilege.status
                }
                for privilege in active_privileges
            ]
        }

    final_tree = []
    for root in modules_by_parent.get(None, []):
        if root.status == 1:
            tree = build_tree(root)
            if tree:
                final_tree.append(tree)
    
    return final_tree

@router.get("/", response_model=List[ModuleOut])
def list_modules(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all root modules with their submodules and privileges for management. Strictly for Rank 1.
    """
    if not current_user.role or current_user.role.rank_level != 1:
        raise HTTPException(status_code=403, detail="Strictly reserved for Developer (Rank 1)")

    modules = (
        db.query(Module)
        .options(
            selectinload(Module.submodules),
            selectinload(Module.privileges)
        )
        .filter(Module.parent_id == None)
        .order_by(Module.display_order)
        .all()
    )
    return modules

@router.get("/{module_id}", response_model=ModuleOut)
def get_module(
    *,
    db: Session = Depends(get_db),
    module_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific module. Rank 1 only.
    """
    if not current_user.role or current_user.role.rank_level != 1:
        raise HTTPException(status_code=403, detail="Unauthorized")

    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module

@router.put("/{module_id}", response_model=ModuleOut)
def update_module(
    *,
    db: Session = Depends(get_db),
    module_id: int,
    module_in: ModuleUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update a module. Rank 1 only.
    """
    if not current_user.role or current_user.role.rank_level != 1:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db_obj = db.query(Module).filter(Module.id == module_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Module not found")
    
    update_data = module_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(db_obj, field, update_data[field])
    
    db_obj.updated_by = current_user.id
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.delete("/{module_id}")
def delete_module(
    *,
    db: Session = Depends(get_db),
    module_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a module. Rank 1 only.
    """
    if not current_user.role or current_user.role.rank_level != 1:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db_obj = db.query(Module).filter(Module.id == module_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Module not found")
    
    if db_obj.submodules:
        raise HTTPException(status_code=400, detail="Cannot delete module with submodules")
    
    db.delete(db_obj)
    db.commit()
    return {"status": "success"}

@router.post("/{module_id}/link-privileges")
def link_privileges(
    *,
    db: Session = Depends(get_db),
    module_id: int,
    privilege_ids: List[int],
    current_user: User = Depends(get_current_user)
):
    """
    Link multiple privileges to a module. Rank 1 only.
    """
    if not current_user.role or current_user.role.rank_level != 1:
        raise HTTPException(status_code=403, detail="Unauthorized")

    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    db.query(Privilege).filter(Privilege.id.in_(privilege_ids)).update(
        {Privilege.module_id: module_id}, synchronize_session=False
    )
    db.commit()
    return {"status": "success"}
