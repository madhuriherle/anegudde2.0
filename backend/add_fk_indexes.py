import re

with open('backend/app/db/models.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Check if line has a ForeignKey but no index=True
    if 'ForeignKey(' in line and 'index=True' not in line:
        # Find the last closing parenthesis of the Column call before any trailing comment
        # Usually Column(..., ForeignKey(...), ...)
        # We want to insert , index=True before the last )
        
        # Regex to find the end of the Column constructor
        # This is a bit tricky if it spans multiple lines, but in this file they seem to be single lines mostly.
        if 'Column(' in line and line.strip().endswith(')'):
            idx = line.rfind(')')
            new_line = line[:idx] + ', index=True' + line[idx:]
            new_lines.append(new_line)
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open('backend/app/db/models.py', 'w') as f:
    f.writelines(new_lines)
