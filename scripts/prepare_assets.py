import os
import shutil
from PIL import Image

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
ANDROID_MAIN = os.path.join(PROJECT_ROOT, "android", "app", "src", "main")
ASSETS_DIR = os.path.join(ANDROID_MAIN, "assets")
RES_DIR = os.path.join(ANDROID_MAIN, "res")

os.makedirs(ASSETS_DIR, exist_ok=True)

# Copy public files to android assets
for fname in os.listdir(PUBLIC_DIR):
    src = os.path.join(PUBLIC_DIR, fname)
    dst = os.path.join(ASSETS_DIR, fname)
    if os.path.isfile(src):
        shutil.copy2(src, dst)
        print(f"Copied {fname} -> assets/")

# Call generate_perfect_icons
gen_icons_path = os.path.join(PROJECT_ROOT, "scripts", "generate_perfect_icons.py")
if os.path.exists(gen_icons_path):
    os.system(f'python "{gen_icons_path}"')

print("Asset preparation completed successfully.")
