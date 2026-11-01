from pathlib import Path
import struct
from PIL import Image

root = Path(__file__).resolve().parent.parent
image = root / 'CA1D93C754E1F21B719E5486CA72ACEA.png'
with Image.open(image) as im:
    print('IMAGE', im.size, im.mode, 'frames', getattr(im, 'n_frames', 1))
    print('CORNERS', [im.getpixel(xy) for xy in [(0, 0), (im.width-1, 0), (0, im.height-1), (im.width-1, im.height-1)]])
firmware = root / 'M5Burner-v3-beta-win-x64/packages/firmware/05a2cf9f8c71e46dbd0dca65137ad0c1.bin'
data = firmware.read_bytes()
print('FIRMWARE_BYTES', len(data))
for offset in range(0x8000, min(len(data), 0x9000), 32):
    if data[offset:offset+2] == b'\xaa\x50':
        print('PARTITION', struct.unpack_from('<HBBII16sI', data, offset))
print('ASSETS_HEADER', data[0x800000:0x800040].hex())
magic = struct.pack('<I', 0xABCD5432)
position = data.find(magic, 0x20000, 0x21000)
if position >= 0:
    print('APP_DESCRIPTOR', hex(position))
    for label, offset, size in [('version', 16, 32), ('project', 48, 32), ('time', 80, 16), ('date', 96, 16), ('idf', 112, 32)]:
        value = data[position + offset:position + offset + size].split(b'\0')[0].decode('utf-8', errors='replace')
        print(label, value)
else:
    print('APP_DESCRIPTOR_NOT_FOUND')

