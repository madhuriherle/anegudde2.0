import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.127.173.27', username='root', password='D-apps@123456')
script = """
from app.db.session import SessionLocal
from app.db.models import Module, Privilege, RolePrivilege, Role
import datetime

db = SessionLocal()

# Check if Role Management exists
role_mod = db.query(Module).filter(Module.name == 'Role Management').first()

if not role_mod:
    users_parent = db.query(Module).filter(Module.name == 'Users').first()
    if users_parent:
        role_mod = Module(
            name='Role Management',
            route='/users/roles',
            parent_id=users_parent.id,
            display_order=2,
            icon='Shield'
        )
        db.add(role_mod)
        db.commit()
        db.refresh(role_mod)
        print("Created Role Management module with ID:", role_mod.id)
    else:
        print("Users parent module not found!")

# Ensure privileges exist
if role_mod:
    privs = db.query(Privilege).filter(Privilege.module_id == role_mod.id).all()
    if not privs:
        # Check if users.privileges.read exists anywhere else
        read_priv = db.query(Privilege).filter(Privilege.name == 'users.privileges.read').first()
        if read_priv:
            # Maybe it's linked to User Privileges, which is fine, we just want the module to be accessible.
            # Actually, the sidebar uses module structure to show links. It only shows if user has privileges for it.
            # So if Role Management has no privileges assigned, it might not check properly, or it checks route.
            print("Role Management module has no specific privileges assigned.")
"""
stdin, stdout, stderr = ssh.exec_command(f'sudo -u postgres psql -d anegudde_inventory -c "INSERT INTO modules (name, route, parent_id, display_order, created_at, updated_at) VALUES (\'Role Management\', \'/users/roles\', 5, 2, now(), now()) ON CONFLICT DO NOTHING;"')
print("STDOUT:", stdout.read().decode())
print("STDERR:", stderr.read().decode())
ssh.close()
