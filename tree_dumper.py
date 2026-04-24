import os
import json

def get_tree(startpath):
    tree = []
    for root, dirs, files in os.walk(startpath):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.venv' in dirs: dirs.remove('.venv')
        if '.git' in dirs: dirs.remove('.git')
        if '__pycache__' in dirs: dirs.remove('__pycache__')
        
        rel_path = os.path.relpath(root, startpath)
        if rel_path == '.':
            rel_path = ''
            
        for f in files:
            tree.append(os.path.join(rel_path, f).replace('\\', '/'))
    return tree

if __name__ == '__main__':
    paths = get_tree('c:/Users/ROHAN/OneDrive/Documents/01_CODE_JOURNEY/Projects/AashaAI')
    with open('c:/Users/ROHAN/OneDrive/Documents/01_CODE_JOURNEY/Projects/AashaAI/project_tree.json', 'w') as f:
        json.dump(paths, f, indent=2)
