"""Prepare vector resources only; main program must be built separately."""
import hashlib,json
from pathlib import Path
from build_static_assets import parse_assets,pack_assets,inspect_firmware,FIRMWARE
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'grok-v4'
sha=lambda b:hashlib.sha256(b).hexdigest()

def main():
    original=(ROOT/'output/original-v2.2.6-assets.bin').read_bytes()
    firmware=FIRMWARE.read_bytes()
    partition,_,info=inspect_firmware(firmware)
    if original!=firmware[0x800000:0x800000+len(original)]:raise ValueError('Baseline mismatch')
    entries=parse_assets(original)
    model=next(b for n,b,w,h in entries if n=='srmodels.bin')
    vectors=(OUT/'grok-vectors.bin').read_bytes()
    index=json.loads(next(b for n,b,w,h in entries if n=='index.json'))
    index['hide_subtitle']=True
    index['skin']={m:{'text_color':'#ffffff','background_color':'#000000'} for m in ['light','dark']}
    modified=[(n,(json.dumps(index,ensure_ascii=False)+'\n').encode() if n=='index.json' else b,w,h) for n,b,w,h in entries]
    modified.append(('grok-vectors.bin',vectors,0,0))
    result=pack_assets(modified)
    if len(result)>partition['size']:raise ValueError('Partition overflow')
    if pack_assets(parse_assets(result))!=result:raise ValueError('Roundtrip failed')
    current={n:b for n,b,w,h in parse_assets(result)}
    if current['srmodels.bin']!=model:raise ValueError('Voice model changed')
    filename='grok-v4-vector-assets.bin'
    (OUT/filename).write_bytes(result)
    report={'status':'resources_validated_main_firmware_build_pending','baseline':info,
      'source_commit':'356541a94d6ea73f291388eb028a670e6c75f2f3',
      'flash_offset':'0x800000','partition_bytes':partition['size'],
      'assets':{'filename':filename,'bytes':len(result),'sha256':sha(result)},
      'vector_sha256':sha(vectors),'voice_model_sha256':sha(model),
      'requires_custom_main_program':True,'hardware_tested':False,
      'notes':['Do not flash this asset alone over v3: the factory firmware does not read the vector bank.',
               'Original PNGs are retained as fallback data; the custom renderer uses vectors only.',
               'Original voice model and font preserved; no custom wake word.']}
    (OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n','utf-8')
    print(json.dumps(report['assets'],indent=2))

if __name__=='__main__':main()
