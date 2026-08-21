import re

with open('src/Purust/CodeGen.purs', 'r') as f:
    lines = f.readlines()

in_binding_group = False
for i in range(len(lines)):
    line = lines[i]
    if 'codegenBindingGroup' in line and 'modNameStr' in line:
        in_binding_group = True
    if 'codegenExpr_' in line and 'currentMod' in line and not in_binding_group:
        # maybe it exited binding group, but let's just do it by line numbers roughly.
        pass
        
    if 298 <= i <= 550:
        lines[i] = lines[i].replace('currentMod', 'modNameStr')

with open('src/Purust/CodeGen.purs', 'w') as f:
    f.writelines(lines)
