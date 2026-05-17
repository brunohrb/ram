#!/usr/bin/env python3
"""Generate PNG icons for Ram Connect PWA."""
import struct, zlib, os

def crc32(data: bytes) -> int:
    crc = 0xFFFFFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ (0xEDB88320 if crc & 1 else 0)
    return crc ^ 0xFFFFFFFF

def chunk(t: bytes, d: bytes) -> bytes:
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', crc32(t + d) & 0xFFFFFFFF)

def make_png(size: int, r: int, g: int, b: int) -> bytes:
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    row = bytes([r, g, b] * size)
    raw = (b'\x00' + row) * size
    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

os.makedirs('public/icons', exist_ok=True)

# Ram red: #CC0000
R, G, B = 204, 0, 0

for size in [72, 96, 128, 144, 152, 167, 180, 192, 384, 512]:
    path = f'public/icons/icon-{size}x{size}.png'
    with open(path, 'wb') as f:
        f.write(make_png(size, R, G, B))
    print(f'  {path}')

with open('public/icons/apple-touch-icon.png', 'wb') as f:
    f.write(make_png(180, R, G, B))
print('  public/icons/apple-touch-icon.png')
print('Done!')
