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
# Font size (excluding functional ones like text-left/right/center)
# Matching text-size but NOT text-left, text-right, text-center, text-justify, text-wrap, text-nowrap, text-truncate
font_sizes = r'text-(3xl|2xl|xl|lg|sm|xs|\[\d+px\]|\[\d+\.\d+px\]|base|\[\d+em\]|\[\d+\.\d+em\]|\[\d+rem\]|\[\d+\.\d+rem\]|\[\d+pt\])'
# Colors
colors = r'text-(error|primary|text-light|text-main|emerald-\d+|gray-\d+|red-\d+|blue-\d+|green-\d+|yellow-\d+|amber-\d+|orange-\d+|teal-\d+|cyan-\d+|indigo-\d+|violet-\d+|purple-\d+|fuchsia-\d+|pink-\d+|rose-\d+|primary/\d+|\[#[A-Fa-f0-9]+\]|white|slate-\d+|zinc-\d+|neutral-\d+|stone-\d+)'
# Backgrounds
backgrounds = r'bg-(primary/\d+|red-\d+|gray-\d+|primary/\d+|\[#[A-Fa-f0-9]+\]|white|slate-\d+|zinc-\d+|neutral-\d+|stone-\d+|emerald-\d+|blue-\d+|green-\d+|yellow-\d+|amber-\d+|orange-\d+|teal-\d+|cyan-\d+|indigo-\d+|violet-\d+|purple-\d+|fuchsia-\d+|pink-\d+|rose-\d+|transparent|opacity-\d+)'
# Shadows
shadows = r'shadow-(lg|md|sm|xl|2xl|inner|none|primary/\d+|\[[^\]]+\])'
# Transitions/Animations
animations = r'(transition-all|transition-colors|transition-opacity|transition-transform|hover:scale-\d+|active:scale-\d+|animate-in|fade-in|duration-\d+|hover:text-\w+|hover:bg-\w+(/\d+)?|active:bg-\w+(/\d+)?|hover:opacity-\d+|animate-pulse|animate-bounce|animate-spin|ease-in-out|ease-in|ease-out|delay-\d+)'
# Tracking
tracking = r'tracking-(tight|widest|tighter|wide|normal)'
# Decorative
decorative = r'(italic|uppercase|lowercase|capitalize|sr-only|rounded-xl|rounded-2xl|rounded-3xl|rounded-lg|rounded-full)'

# Button/Header specifics from example: h-11 px-6 were removed
button_sizes = r'(h-\d+|px-\d+|w-\d+|py-\d+|p-\d+)'

# Icons from lucide-react
# We'll look for tags starting with uppercase letter and ending with /> or having no children
# This is a bit risky but we'll focus on common icons
icons = [
    'Plus', 'Search', 'Download', 'Filter', 'ChevronRight', 'ChevronLeft', 'Eye', 'Pencil', 'Trash2', 
    'ArrowLeft', 'ArrowRight', 'Calendar', 'Clock', 'Info', 'Check', 'AlertCircle', 'MoreVertical', 
    'ExternalLink', 'FileText', 'LayoutDashboard', 'Package', 'Users', 'Settings', 'CreditCard', 
    'History', 'User', 'BarChart3', 'PieChart', 'FileBarChart', 'FileLineChart', 'Edit', 'Shield', 
    'Mail', 'Phone', 'Lock', 'FileDown', 'Printer', 'X', 'ChevronDown', 'ChevronUp', 'ArrowUp', 'ArrowDown'
]

def refactor_content(content):
    # 1. Remove Icons
    for icon in icons:
        # Match <Icon ... />
        content = re.sub(rf'<{icon}\s+[^>]*/>', '', content)
        # Match <Icon ... >...</Icon> - though most are self-closing
        content = re.sub(rf'<{icon}\s+[^>]*>.*?</{icon}>', '', content, flags=re.DOTALL)

    # 2. Refactor classNames
    def process_classes(match):
        classes = match.group(2).split()
        new_classes = []
        has_text_color = False
        
        for cls in classes:
            # Check if it should be removed
            if re.fullmatch(font_weights, cls): continue
            if re.fullmatch(font_sizes, cls): continue
            if re.fullmatch(shadows, cls): continue
            if re.fullmatch(animations, cls): continue
            if re.fullmatch(tracking, cls): continue
            if re.fullmatch(decorative, cls): continue
            
            # Special case for backgrounds: remove if decorative
            if re.fullmatch(backgrounds, cls):
                # Keep backgrounds that are likely functional (not yet defined, but let's be conservative)
                # Actually prompt says "Remove ALL decorative background colors from text containers"
                continue
            
            # Colors: replace with text-text-main
            if re.fullmatch(colors, cls):
                if not has_text_color:
                    new_classes.append('text-text-main')
                    has_text_color = True
                continue
                
            # If it's a Button or Header, we might want to remove sizes too as per example
            # But let's be careful. The example showed h-11 px-6 gone.
            # We'll only do this if it's inside a className that also has other removed classes?
            # No, let's stick to the prompt's explicit list first.
            
            new_classes.append(cls)
            
        if not has_text_color:
            # Most elements should have text-text-main now if they had any styling
            # But let's only add it if we removed something or if it's a header/button
            pass
            
        return f'{match.group(1)}="{ " ".join(new_classes) }"'

    # Find className="..." or className={`...`}
    # This is simplified and might miss some template literals
    content = re.sub(r'(className)=["\']([^"\']*)["\']', process_classes, content)
    
    # 3. Handle Badge variants
    content = re.sub(r'variant=["\'](secondary|success|error|outline|ghost|warning)["\']', '', content)
    
    # 4. Clean up double spaces and empty classNames
    content = re.sub(r'className=["\']\s*["\']', 'className="text-text-main"', content) # Default to text-text-main
    
    # 5. Clean up imports
    for icon in icons:
        # Remove from import { ..., Icon, ... } from 'lucide-react'
        # Match the icon in a curly brace import
        content = re.sub(rf',\s*{icon}\b', '', content)
        content = re.sub(rf'\b{icon}\s*,\s*', '', content)
        content = re.sub(rf'{icon}\b', '', content) # if it's the only one
    
    # Remove empty lucide-react imports
    content = re.sub(r"import\s*{\s*}\s*from\s*['\"]lucide-react['\"];?\n", '', content)
    
    return content

def main():
    base_dir = "D:/python_project/Anegudde_Inventory_System"
    for file_path in files:
        full_path = os.path.join(base_dir, file_path)
        if not os.path.exists(full_path):
            print(f"File not found: {full_path}")
            continue
            
        print(f"Refactoring {file_path}...")
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = refactor_content(content)
        
        # Additional manual fixes for specific patterns in the example
        # Headers: remove text-3xl, font-bold, etc. already done by regex
        # But let's ensure text-text-main is there
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

if __name__ == "__main__":
    main()
