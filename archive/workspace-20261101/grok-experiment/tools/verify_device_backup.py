"""Read-only comparison of a local device backup; never print NVS or credentials."""
import struct
from build_static_assets import ROOT, FIRMWARE, OUTPUT, HEADER, inspect_firmware, parse_assets, sha256

backup = ROOT / 'stopwatch-custom/stopwatch-device-backup.bin'
data = backup.read_bytes()
assert len(data) == 0x1000000, 'Device backup is not 16MB'
reference = FIRMWARE.read_bytes()
partition, partitions, info = inspect_firmware(data)
ref_partition, ref_partitions, ref_info = inspect_firmware(reference)
assert partitions == ref_partitions, 'Partition layouts differ'
assert data[0x8000:0x9000] == reference[0x8000:0x9000], 'Partition table sector differs'
base = partition['offset']
_, _, length = HEADER.unpack_from(data, base)
assert length + 12 <= partition['size'], 'Asset length exceeds partition'
assets = data[base:base + 12 + length]
parse_assets(assets)
assert assets == (OUTPUT / 'original-v2.2.6-assets.bin').read_bytes(), 'Device resources differ from baseline'
# Compare the complete factory app image present before the assets region, not NVS.
assert data[0x20000:base] == reference[0x20000:base], 'Application region differs from cached firmware'
custom = (OUTPUT / 'maple-static-v1-assets.bin').read_bytes()
parse_assets(custom)
assert sha256(custom) == '2d1bc1a0b84baf98b33d8763c3f9836ca201916c4db319c7366df468bac48e46', 'Custom output hash differs'
print('PASS: backup size, partition table, application region, original resources, custom package checksum/hash')
print('APP', info)
print('RESOURCE_OFFSET', hex(base), 'RESOURCE_CAPACITY', partition['size'])
print('ORIGINAL_RESOURCE_SHA256', sha256(assets))
print('CUSTOM_RESOURCE_BYTES', len(custom))
print('No device access, writes, or credential output performed.')
