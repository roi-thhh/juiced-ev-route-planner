import os
from PIL import Image, ImageDraw

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(PROJECT_ROOT, "public", "juiced_logo.png")
RES_DIR = os.path.join(PROJECT_ROOT, "android", "app", "src", "main", "res")

# Load logo
logo = Image.open(LOGO_PATH).convert("RGBA")

# 1. Update ic_launcher_background.xml to Volt Yellow
bg_xml = """<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#FEE209"
        android:pathData="M0,0h108v108h-108z" />
</vector>
"""
with open(os.path.join(RES_DIR, "drawable", "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
    f.write(bg_xml)

# 2. Update ic_launcher.xml and ic_launcher_round.xml (NO monochrome tag!)
adaptive_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
for name in ["ic_launcher.xml", "ic_launcher_round.xml"]:
    xml_path = os.path.join(RES_DIR, "mipmap-anydpi-v26", name)
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(adaptive_xml)

# 3. Generate foreground and legacy icons for each density
densities = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432)
}

YELLOW = (254, 226, 9, 255)
BLACK = (12, 13, 16, 255)

for folder, (legacy_size, fg_canvas_size) in densities.items():
    folder_path = os.path.join(RES_DIR, folder)
    os.makedirs(folder_path, exist_ok=True)

    # --- Adaptive Foreground ---
    # Centered logo taking 60% of the canvas so it safely fits within circular masks
    fg_canvas = Image.new("RGBA", (fg_canvas_size, fg_canvas_size), (0, 0, 0, 0))
    fg_logo_size = int(fg_canvas_size * 0.60)
    resized_logo = logo.resize((fg_logo_size, fg_logo_size), Image.Resampling.LANCZOS)
    pos_fg = ((fg_canvas_size - fg_logo_size) // 2, (fg_canvas_size - fg_logo_size) // 2)
    fg_canvas.paste(resized_logo, pos_fg, resized_logo)
    fg_canvas.save(os.path.join(folder_path, "ic_launcher_foreground.png"), format="PNG")

    # --- Legacy Square Icon (ic_launcher.png) ---
    sq_canvas = Image.new("RGBA", (legacy_size, legacy_size), (0, 0, 0, 0))
    draw_sq = ImageDraw.Draw(sq_canvas)
    radius = int(legacy_size * 0.22)
    draw_sq.rounded_rectangle([0, 0, legacy_size - 1, legacy_size - 1], radius=radius, fill=YELLOW, outline=BLACK, width=2)
    
    sq_inner_size = int(legacy_size * 0.78)
    sq_inner_logo = logo.resize((sq_inner_size, sq_inner_size), Image.Resampling.LANCZOS)
    pos_sq = ((legacy_size - sq_inner_size) // 2, (legacy_size - sq_inner_size) // 2)
    sq_canvas.paste(sq_inner_logo, pos_sq, sq_inner_logo)
    sq_canvas.save(os.path.join(folder_path, "ic_launcher.png"), format="PNG")

    # --- Legacy Round Icon (ic_launcher_round.png) ---
    rd_canvas = Image.new("RGBA", (legacy_size, legacy_size), (0, 0, 0, 0))
    draw_rd = ImageDraw.Draw(rd_canvas)
    draw_rd.ellipse([0, 0, legacy_size - 1, legacy_size - 1], fill=YELLOW, outline=BLACK, width=2)
    
    rd_inner_size = int(legacy_size * 0.72)
    rd_inner_logo = logo.resize((rd_inner_size, rd_inner_size), Image.Resampling.LANCZOS)
    pos_rd = ((legacy_size - rd_inner_size) // 2, (legacy_size - rd_inner_size) // 2)
    rd_canvas.paste(rd_inner_logo, pos_rd, rd_inner_logo)
    rd_canvas.save(os.path.join(folder_path, "ic_launcher_round.png"), format="PNG")

    print(f"Generated icons for {folder}")

print("All Android launcher icons successfully updated!")
