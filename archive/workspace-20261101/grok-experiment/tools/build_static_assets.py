"""Build an asset-only image; never connect to a serial port or flash a device."""
from pathlib import Path
import hashlib
import io
import json
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FIRMWARE = ROOT / 'M5Burner-v3-beta-win-x64/packages/firmware/05a2cf9f8c71e46dbd0dca65137ad0c1.bin'
ARTWORK = ROOT / 'stopwatch-custom/artwork/neutral-160.png'
OUTPUT = ROOT / 'stopwatch-custom/output'
ENTRY = struct.Struct('<32sIIHH')
HEADER = struct.Struct('<III')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def parse_assets(data):
    if len(data) < HEADER.size:
        raise ValueError('Truncated asset header')
    count, checksum, length = HEADER.unpack_from(data)
    if not 0 < count <= 1024 or length < count * ENTRY.size:
        raise ValueError('Invalid asset count or length')
    if len(data) != HEADER.size + length:
        raise ValueError('Asset length mismatch')
    if sum(data[HEADER.size:]) & 0xffff != checksum:
        raise ValueError('Asset checksum mismatch')
    content_start = HEADER.size + count * ENTRY.size
    entries = []
    names = set()
    expected_offset = 0
    for i in range(count):
        name_bytes, size, offset, width, height = ENTRY.unpack_from(data, HEADER.size + i * ENTRY.size)
        name = name_bytes.split(b'\0')[0].decode('ascii')
        if not name or name in names or offset != expected_offset:
            raise ValueError('Duplicate name or noncontiguous asset offset')
        names.add(name)
        start = content_start + offset
        end = start + 2 + size
        if end > len(data) or data[start:start + 2] != b'ZZ':
            raise ValueError(f'Invalid asset bounds or marker: {name}')
        entries.append((name, data[start + 2:end], width, height))
        expected_offset += 2 + size
    if content_start + expected_offset != len(data):
        raise ValueError('Unexpected trailing asset bytes')
    index = json.loads(dict((n, b) for n, b, _, _ in entries)['index.json'])
    if index.get('version') != 1:
        raise ValueError('Unsupported index version')
    for item in index.get('emoji_collection', []):
        if item['file'] not in names:
            raise ValueError('Missing indexed image')
    return entries


def pack_assets(entries):
    table = bytearray()
    payload = bytearray()
    for name, blob, width, height in entries:
        encoded = name.encode('ascii')
        if len(encoded) >= 32:
            raise ValueError('Asset name too long')
        table.extend(ENTRY.pack(encoded, len(blob), len(payload), width, height))
        payload.extend(b'ZZ')
        payload.extend(blob)
    combined = bytes(table + payload)
    return HEADER.pack(len(entries), sum(combined) & 0xffff, len(combined)) + combined


def inspect_firmware(data):
    partitions = []
    for offset in range(0x8000, 0x9000, 32):
        if data[offset:offset + 2] == b'\xaa\x50':
            _, kind, subtype, address, size, label, flags = struct.unpack_from('<HBBII16sI', data, offset)
            partitions.append({'name': label.split(b'\0')[0].decode('ascii'), 'offset': address,
                               'size': size, 'type': kind, 'subtype': subtype, 'flags': flags})
    assets = [p for p in partitions if p['name'] == 'assets']
    if len(assets) != 1 or assets[0]['offset'] != 0x800000 or assets[0]['size'] != 0x800000 or assets[0]['flags'] != 0:
        raise ValueError('Unsupported partition layout')
    desc = data.find(struct.pack('<I', 0xabcd5432), 0x20000, 0x21000)
    if desc < 0:
        raise ValueError('Missing app descriptor')
    def field(offset, length):
        return data[desc + offset:desc + offset + length].split(b'\0')[0].decode('ascii')
    info = {key: field(offset, length) for key, offset, length in [
        ('version', 16, 32), ('project', 48, 32), ('time', 80, 16), ('date', 96, 16), ('idf', 112, 32)]}
    if info['version'] != '2.2.6' or info['project'] != 'xiaozhi':
        raise ValueError('Wrong baseline firmware')
    return assets[0], partitions, info


def main():
    firmware = FIRMWARE.read_bytes()
    source_hash = sha256(firmware)
    partition, partitions, info = inspect_firmware(firmware)
    base = partition['offset']
    _, _, length = HEADER.unpack_from(firmware, base)
    if HEADER.size + length > partition['size'] or base + HEADER.size + length > len(firmware):
        raise ValueError('Invalid baseline asset length')
    original = firmware[base:base + HEADER.size + length]
    entries = parse_assets(original)
    if pack_assets(entries) != original:
        raise ValueError('Packer cannot reproduce original byte-for-byte')
    replacement = ARTWORK.read_bytes()
    with Image.open(io.BytesIO(replacement)) as image:
        if image.format != 'PNG' or image.size != (160, 160):
            raise ValueError('Expected a 160x160 PNG')
        image.verify()
    old_map = {n: b for n, b, _, _ in entries}
    with Image.open(io.BytesIO(old_map['neutral.png'])) as old_image:
        original_image_info = {'format': old_image.format, 'width': old_image.width, 'height': old_image.height}
        old_image.verify()
    # Keep index, model, font, ordering and table metadata exactly as provided.
    modified = [(n, replacement if n == 'neutral.png' else b, w, h) for n, b, w, h in entries]
    result = pack_assets(modified)
    parsed = parse_assets(result)
    changed = [n for n, b, _, _ in parsed if old_map[n] != b]
    if changed != ['neutral.png'] or len(result) > partition['size']:
        raise ValueError('Unexpected asset change or partition overflow')
    OUTPUT.mkdir(exist_ok=True)
    outputs = {'maple-static-v1-assets.bin': result, 'original-v2.2.6-assets.bin': original}
    for name, blob in outputs.items():
        path = OUTPUT / name
        path.write_bytes(blob)
        if path.read_bytes() != blob:
            raise ValueError('Output readback mismatch')
    report = {
        'status': 'host_validation_passed_device_test_pending',
        'baseline': {'file': str(FIRMWARE.relative_to(ROOT)), 'sha256': source_hash, **info},
        'flash_offset': hex(base), 'partition_size_bytes': partition['size'],
        'partitions': partitions, 'changed_entries': changed,
        'original_neutral': original_image_info,
        'replacement': {'file': str(ARTWORK.relative_to(ROOT)), 'width': 160, 'height': 160, 'sha256': sha256(replacement)},
        'wake_word': 'original model and configuration unchanged; custom wake word NOT included',
        'original_assets_repacked_byte_identical': True,
        'preserved_entries': [{ 'name': n, 'sha256': sha256(b)} for n, b, _, _ in entries if n != 'neutral.png'],
        'outputs': {name: {'bytes': len(blob), 'sha256': sha256(blob)} for name, blob in outputs.items()},
        'limitations': ['No device readback, flashing, or hardware testing performed.',
                        'Factory cache extraction is not a backup of the device Wi-Fi or NVS.',
                        'Only neutral expression changes; other original expressions remain.',
                        'Artwork white background is preserved; no animation or transparency added.']
    }
    (OUTPUT / 'validation-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if sha256(FIRMWARE.read_bytes()) != source_hash:
        raise ValueError('Baseline firmware was modified')
    for name, metadata in report['outputs'].items():
        print(name, metadata)
    print('PASS: roundtrip, checksum, offsets, PNG, unchanged model/font/index, readback, baseline integrity')


if __name__ == '__main__':
    main()
