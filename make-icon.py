#!/usr/bin/env python3
"""
Cria car-icon.png: ícone PWA estilo painel de carro — fundo escuro, RAM em vermelho.
Se você tiver a foto do carro salva como public/car-raw.png, ele usa ela automaticamente.
"""
from PIL import Image, ImageDraw, ImageFont
import os, math

SIZE = 512
BG   = (13, 13, 13)       # #0d0d0d
RED  = (204, 0, 0)        # #cc0000
WHITE = (255, 255, 255)
GRAY  = (60, 60, 60)

img = Image.new('RGBA', (SIZE, SIZE), BG + (255,))
draw = ImageDraw.Draw(img)

# ── Se o usuário tiver salvo a foto do carro, usa ela ─────────────────────────
raw_path = 'public/car-raw.png'
if os.path.exists(raw_path):
    car = Image.open(raw_path).convert('RGBA')

    # Remove fundo branco (limiar 240)
    data = car.getdata()
    new_data = []
    for r, g, b, a in data:
        if r > 240 and g > 240 and b > 240:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append((r, g, b, a))
    car.putdata(new_data)

    # Centraliza e redimensiona
    car.thumbnail((SIZE - 40, SIZE - 160), Image.LANCZOS)
    x = (SIZE - car.width) // 2
    y = (SIZE - car.height) // 2 - 30
    img.paste(car, (x, y), car)
    label = 'Foto do carro aplicada!'
else:
    # ── Ícone minimalista com grelha RAM e texto ──────────────────────────────
    label = 'Ícone padrão (coloque a foto em public/car-raw.png para customizar)'

    # Grelha (grade frontal do RAM)
    gx, gy = SIZE // 2, SIZE // 2 - 40
    gw, gh = 280, 160
    x0, y0 = gx - gw // 2, gy - gh // 2
    draw.rectangle([x0, y0, x0 + gw, y0 + gh], outline=GRAY, width=2)

    cols, rows = 7, 4
    for c in range(1, cols):
        cx = x0 + c * gw // cols
        draw.line([(cx, y0), (cx, y0 + gh)], fill=GRAY, width=2)
    for r in range(1, rows):
        ry = y0 + r * gh // rows
        draw.line([(x0, ry), (x0 + gw, ry)], fill=GRAY, width=2)

    # Faróis
    for fx in [x0 - 50, x0 + gw + 14]:
        draw.ellipse([fx, y0 + 10, fx + 36, y0 + gh - 10], outline=WHITE, width=2)

# ── Barra vermelha inferior ───────────────────────────────────────────────────
draw.rectangle([0, SIZE - 90, SIZE, SIZE], fill=RED + (255,))

# ── Texto RAM ─────────────────────────────────────────────────────────────────
try:
    font_big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 62)
    font_sub = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
except:
    font_big = ImageFont.load_default()
    font_sub = font_big

# "RAM" centralizado na barra vermelha
bbox = draw.textbbox((0, 0), 'RAM', font=font_big)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
tx = (SIZE - tw) // 2
ty = SIZE - 90 + (90 - th) // 2 - 4
draw.text((tx, ty), 'RAM', font=font_big, fill=WHITE)

# "CONNECT" pequeno acima da barra
bbox2 = draw.textbbox((0, 0), 'CONNECT', font=font_sub)
tw2 = bbox2[2] - bbox2[0]
draw.text(((SIZE - tw2) // 2, SIZE - 105), 'CONNECT', font=font_sub, fill=GRAY)

# ── Salva em todos os tamanhos necessários ────────────────────────────────────
os.makedirs('public/icons', exist_ok=True)

# Ícone principal
img_rgb = img.convert('RGB')
img_rgb.save('public/car-icon.png')
print('✓ public/car-icon.png')

for size in [180, 167, 152]:
    resized = img_rgb.resize((size, size), Image.LANCZOS)
    resized.save(f'public/icons/icon-{size}x{size}-car.png')
    print(f'✓ public/icons/icon-{size}x{size}-car.png')

print(f'\n{label}')
print('\nSe quiser usar a foto real do carro:')
print('  1. Salve a foto como: public/car-raw.png')
print('  2. Rode novamente: python3 make-icon.py')
