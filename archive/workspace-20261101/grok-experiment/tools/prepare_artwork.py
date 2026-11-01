from pathlib import Path
import struct
import json
from PIL import Image

root = Path(__file__).resolve().parent.parent
firmware = root / 'M5Burner-v3-beta-win-x64/packages/firmware/05a2cf9f8c71e46dbd0dca65137ad0c1.bin'
data = firmware.read_bytes()
base = 0x800000
count, checksum, length = struct.unpack_from('<III', data, base)
start = base + 12 + count * 44
print('HEADER', count, checksum, length, 'data_start', hex(start))
for i in range(count):
    name, size, offset, width, height = struct.unpack_from('<32sIIHH', data, base + 12 + i * 44)
    name = name.split(b'\0')[0].decode()
    print(name, size, offset, width, height)
    if name == 'index.json':
        marker = data[start + offset:start + offset + 2]
        assert marker == b'ZZ', f'Unexpected entry marker: {marker!r}'
        blob = data[start + offset + 2:start + offset + 2 + size]
        print(json.dumps(json.loads(blob), ensure_ascii=False, indent=2))
with Image.open(root / 'CA1D93C754E1F21B719E5486CA72ACEA.png') as im:
    out = Path(__file__).resolve().parent / 'artwork'
    out.mkdir(exist_ok=True)
    for size in (160, 192):
        im.resize((size, size), Image.Resampling.LANCZOS).save(out / f'neutral-{size}.png')
    print('PREPARED', [(p.name, Image.open(p).size) for p in sorted(out.glob('*.png'))])
