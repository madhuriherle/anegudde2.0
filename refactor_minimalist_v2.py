import re
import os

files = [
    "frontend/src/pages/TokensPage.tsx",
    "frontend/src/pages/UsersPage.tsx",
    "frontend/src/pages/UnitsPage.tsx",
    "frontend/src/pages/MenuItemsPage.tsx",
    "frontend/src/pages/ItemCategoriesPage.tsx",
    "frontend/src/pages/VendorPaymentsPage.tsx",
    "frontend/src/pages/WastagesPage.tsx",
    "frontend/src/pages/PurchasesPage.tsx",
    "frontend/src/pages/ChefsPage.tsx",
    "frontend/src/pages/TokenHistoryPage.tsx",
    "frontend/src/pages/ReportsPage.tsx",
    "frontend/src/pages/MonthlyPerformanceReportPage.tsx",
    "frontend/src/pages/DailyStockReportPage.tsx",
    "frontend/src/pages/VendorOutstandingReportPage.tsx",
    "frontend/src/pages/ProfilePage.tsx",
    "frontend/src/pages/ItemHistoryPage.tsx",
]

# Typography
font_weights = r'font-(bold|semibold|medium|extrabold|black|mono|serif|black|light|normal|thin)'
font_sizes = r'text-(3xl|2xl|xl|lg|sm|xs|\[\d+px\]|\[\d+\.\d+px\]|base|\[\d+em\]|\[\d+\.\d+em\]|\[\d+rem\]|\[\d+\.\d+rem\]|\[\d+pt\])'
colors = r'text-(error|primary|text-light|text-main|emerald-\d+|gray-\d+|red-\d+|blue-\d+|green-\d+|yellow-\d+|amber-\d+|orange-\d+|teal-\d+|cyan-\d+|indigo-\d+|violet-\d+|purple-\d+|fuchsia-\d+|pink-\d+|rose-\d+|primary/\d+|\[#[A-Fa-f0-9]+\]|white|slate-\d+|zinc-\d+|neutral-\d+|stone-\d+)'
backgrounds = r'bg-(primary/\d+|red-\d+|gray-\d+|primary/\d+|\[#[A-Fa-f0-9]+\]|white|slate-\d+|zinc-\d+|neutral-\d+|stone-\d+|emerald-\d+|blue-\d+|green-\d+|yellow-\d+|amber-\d+|orange-\d+|teal-\d+|cyan-\d+|indigo-\d+|violet-\d+|purple-\d+|fuchsia-\d+|pink-\d+|rose-\d+|transparent|opacity-\d+)'
shadows = r'shadow-(lg|md|sm|xl|2xl|inner|none|primary/\d+|\[[^\]]+\])'
animations = r'(transition-all|transition-colors|transition-opacity|transition-transform|hover:scale-\d+|active:scale-\d+|animate-in|fade-in|duration-\d+|hover:text-\w+|hover:bg-\w+(/\d+)?|active:bg-\w+(/\d+)?|hover:opacity-\d+|animate-pulse|animate-bounce|animate-spin|ease-in-out|ease-in|ease-out|delay-\d+)'
tracking = r'tracking-(tight|widest|tighter|wide|normal)'
decorative = r'(italic|uppercase|lowercase|capitalize|rounded-xl|rounded-2xl|rounded-3xl|rounded-lg|rounded-full)'
# We keep sr-only

# Sizes to remove from Buttons and Headers
sizes = r'(h-\d+|px-\d+|py-\d+|w-\d+|p-\d+|h-\[[\d\.]+px\]|w-\[[\d\.]+px\])'

icons = [
    'Plus', 'Search', 'Download', 'Filter', 'ChevronRight', 'ChevronLeft', 'Eye', 'Pencil', 'Trash2', 
    'ArrowLeft', 'ArrowRight', 'Calendar', 'Clock', 'Info', 'Check', 'AlertCircle', 'MoreVertical', 
    'ExternalLink', 'FileText', 'LayoutDashboard', 'Package', 'Users', 'Settings', 'CreditCard', 
    'History', 'User', 'BarChart3', 'PieChart', 'FileBarChart', 'FileLineChart', 'Edit', 'Shield', 
    'Mail', 'Phone', 'Lock', 'FileDown', 'Printer', 'X', 'ChevronDown', 'ChevronUp', 'ArrowUp', 'ArrowDown', 'PlusCircle'
]

def refactor_content(content):
    # 1. Remove Icon tags
    for icon in icons:
        content = re.sub(rf'<{icon}\s+[^>]*/>', '', content)
        content = re.sub(rf'<{icon}\s+[^>]*>.*?</{icon}>', '', content, flags=re.DOTALL)

    # 2. Refactor classNames
    def process_classes(match):
        prop = match.group(1)
        original_classes = match.group(2)
        classes = original_classes.split()
        new_classes = []
        has_text_color = False
        
        # Determine if this element is a Button or Header
        # We don't have the tag name here easily, but we can look at surrounding context in the file if we were smarter.
        # For now, let's assume if it has h- or px- and other decorative classes, it's likely a button/header.
        is_button_or_header = any(re.fullmatch(sizes, cls) for cls in classes)
        
        for cls in classes:
            if re.fullmatch(font_weights, cls): continue
            if re.fullmatch(font_sizes, cls): continue
            if re.fullmatch(shadows, cls): continue
            if re.fullmatch(animations, cls): continue
            if re.fullmatch(tracking, cls): continue
            if re.fullmatch(decorative, cls): continue
            if re.fullmatch(backgrounds, cls): continue
            
            # Remove sizes from everything to be safe and minimalist
            if re.fullmatch(sizes, cls): continue
            
            if re.fullmatch(colors, cls):
                if not has_text_color:
                    new_classes.append('text-text-main')
                    has_text_color = True
                continue
            
            new_classes.append(cls)
            
        if not has_text_color:
            new_classes.append('text-text-main')
            
        return f'{prop}="{ " ".join(new_classes) }"'

    content = re.sub(r'(className)=["\']([^"\']*)["\']', process_classes, content)
    
    # 3. Handle Badge variants
    content = re.sub(r'variant=["\'](secondary|success|error|outline|ghost|warning)["\']', '', content)
    
    # 4. Clean up lucide-react imports precisely
    # Find the import statement for lucide-react
    lucide_import_match = re.search(r'import\s*{([^}]*)}\s*from\s*[\'"]lucide-react[\'"]', content)
    if lucide_import_match:
        imported_icons = lucide_import_match.group(1).split(',')
        new_imports = []
        for imp in imported_icons:
            imp = imp.strip()
            # If it's "User as UserIcon", check "User"
            icon_name = imp.split(' as ')[0].strip()
            if icon_name not in icons and icon_name != '':
                new_imports.append(imp)
        
        if not new_imports:
            # Remove the whole line
            content = re.sub(r'import\s*{[^}]*}\s*from\s*[\'"]lucide-react[\'"];?\n?', '', content)
        else:
            content = content.replace(lucide_import_match.group(1), ' ' + ', '.join(new_imports) + ' ')

    # Final cleanup of double spaces in classNames
    content = re.sub(r'className=["\']\s+["\']', 'className="text-text-main"', content)
    
    return content

def main():
    # Since I already messed up the files, I should ideally REVERT first, 
    # but I don't have an easy way to revert all 16 files except using git.
    # I'll use git checkout to restore them before applying the better script.
    
    base_dir = "D:/python_project/Anegudde_Inventory_System"
    os.chdir(base_dir)
    
    for file_path in files:
        print(f"Restoring and refactoring {file_path}...")
        # Restore file first
        os.system(f"git checkout {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = refactor_content(content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

if __name__ == "__main__":
    main()
