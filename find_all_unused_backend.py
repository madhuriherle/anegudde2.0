import os
import re

def find_unused_python_files():
    backend_dir = r"D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess\backend"
    app_dir = os.path.join(backend_dir, "app")
    
    # 1. Gather all python files under backend/app (excluding migrations/alembic and .venv)
    py_files = []
    for root, dirs, files in os.walk(app_dir):
        if "__pycache__" in root or ".venv" in root:
            continue
        for f in files:
            if f.endswith(".py") and not f.startswith("__"):
                rel_path = os.path.relpath(os.path.join(root, f), backend_dir)
                py_files.append((rel_path, f))
                
    # 2. Gather contents of all python files in backend (excluding migrations/alembic and .venv)
    all_content = ""
    for root, dirs, files in os.walk(backend_dir):
        if "alembic" in root or ".venv" in root or "__pycache__" in root:
            continue
        for f in files:
            if f.endswith(".py"):
                path = os.path.join(root, f)
                try:
                    with open(path, "r", encoding="utf-8") as file_obj:
                        all_content += "\n" + file_obj.read()
                except Exception:
                    pass
                    
    # 3. Check imports for each file
    unused = []
    for rel_path, filename in py_files:
        name_no_ext = os.path.splitext(filename)[0]
        # Search patterns:
        # e.g. import name_no_ext, from .name_no_ext import, from app...name_no_ext import, etc.
        pattern = r'\b' + re.escape(name_no_ext) + r'\b'
        occurrences = len(re.findall(pattern, all_content))
        
        # Count occurrences in its own file
        full_path = os.path.join(backend_dir, rel_path)
        with open(full_path, "r", encoding="utf-8") as f_self:
            self_content = f_self.read()
        self_occurrences = len(re.findall(pattern, self_content))
        
        external_occurrences = occurrences - self_occurrences
        
        # Special check: is it main.py?
        if filename == "main.py":
            continue
            
        if external_occurrences <= 0:
            unused.append((rel_path, external_occurrences))
            
    print("--- UNUSED PYTHON FILES ---")
    for u, count in sorted(unused):
        print(f"File: {u} (External references: {count})")

if __name__ == "__main__":
    find_unused_python_files()
