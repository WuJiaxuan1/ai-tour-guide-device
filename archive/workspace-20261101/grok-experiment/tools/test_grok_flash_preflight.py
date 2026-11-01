import binascii,importlib.util,struct,unittest
from pathlib import Path
path=Path(__file__).resolve().parent/'grok-v4/flash_grok_v4.py'
spec=importlib.util.spec_from_file_location('grok_flash',path)
flash=importlib.util.module_from_spec(spec);spec.loader.exec_module(flash)

def ota(*entries):
    data=bytearray(b'\xff'*8192)
    for slot,(seq,state) in enumerate(entries):
        offset=slot*4096
        struct.pack_into('<I',data,offset,seq)
        crc=binascii.crc32(data[offset:offset+4],0xffffffff)&0xffffffff
        struct.pack_into('<II',data,offset+24,state,crc)
    return data

class FlashPreflightTests(unittest.TestCase):
    def test_factory_slot_zero(self):self.assertEqual(flash.select_app_slot(ota((1,2))),(0x20000,1))
    def test_later_ota_selects_other_slot(self):self.assertEqual(flash.select_app_slot(ota((1,2),(2,2))),(0x410000,2))
    def test_invalid_update_is_ignored(self):self.assertEqual(flash.select_app_slot(ota((1,2),(2,3))),(0x20000,1))
    def test_pending_or_undefined_update_stops_before_write(self):
        for state in [0,1,0xffffffff]:
            with self.assertRaises(ValueError):flash.select_app_slot(ota((1,2),(2,state)))
    def test_corrupt_and_empty_data_rejected(self):
        corrupt=ota((1,2));corrupt[28]^=1
        for data in [corrupt,ota(),ota((0,2))]:
            with self.assertRaises(ValueError):flash.select_app_slot(data)
    def test_truncation_rejected(self):
        with self.assertRaises(ValueError):flash.select_app_slot(ota((1,2))[:-1])

if __name__=='__main__':unittest.main(verbosity=2)
