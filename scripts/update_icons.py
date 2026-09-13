import os
from PIL import Image

logo_path = 'public/juiced_logo.png'
logo = Image.open(logo_path).convert('RGBA')

# Set background to black
bg_xml = """<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#0C0D10"
        android:pathData="M0,0h108v108h-108z" />
</vector>
"""
with open('android/app/src/main/res/drawable/ic_launcher_background.xml', 'w', encoding='utf-8') as f:
    f.write(bg_xml)

# Remove the default robot foreground
fg_xml_path = 'android/app/src/main/res/drawable/ic_launcher_foreground.xml'
if os.path.exists(fg_xml_path):
    os.remove(fg_xml_path)

# Generate foreground pngs in mipmap folders
fg_sizes = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432
}

for folder, canvas_size in fg_sizes.items():
    folder_path = os.path.join('android/app/src/main/res', folder)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    inner_size = int(canvas_size * 0.72)
    resized = logo.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    pos = ((canvas_size - inner_size) // 2, (canvas_size - inner_size) // 2)
    canvas.paste(resized, pos, resized)
    canvas.save(os.path.join(folder_path, 'ic_launcher_foreground.png'), format='PNG')
    print(f'Saved {folder}/ic_launcher_foreground.png ({canvas_size}x{canvas_size})')

print('Adaptive icons updated successfully!')
