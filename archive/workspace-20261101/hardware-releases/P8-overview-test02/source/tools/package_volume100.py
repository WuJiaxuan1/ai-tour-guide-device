"""Package a volume-only update of overview01, with exact firmware source guards."""
import json, shutil, sys
from package_p1 import ROOT, BUILD, digest, run, validate_assets
from test_wake_assets import verify_build

STAGE='P8-overview-test02'
VERSION='2.2.6-p8-overview02'

def main():
    previous=ROOT/'releases/P8-overview-test01'
    out=ROOT/'releases'/STAGE
    assert not (out/'acceptance.json').exists(), 'Accepted release is immutable'
    old=json.loads((previous/'build-report.json').read_text('utf-8'))
    checked=0
    for relative,expected in old['source_files_sha256'].items():
        frozen=previous/'source'/relative
        assert digest(frozen.read_bytes())==expected,relative
        if not relative.startswith('firmware/'):continue
        current=(ROOT/relative).read_text('utf-8') if relative in ('firmware/main/application.cc','firmware/CMakeLists.txt') else None
        if current is not None:
            baseline=frozen.read_text('utf-8')
            before,after=('SetOutputVolume(85);','SetOutputVolume(100);') if relative.endswith('application.cc') else ('2.2.6-p8-overview01',VERSION)
            assert baseline.count(before)==1
            assert current==baseline.replace(before,after),relative
        else:assert digest((ROOT/relative).read_bytes())==expected,relative
        checked+=1
    for key in ('app','assets','apk'):
        assert digest((previous/old[key]['filename']).read_bytes())==old[key]['sha256']
    table=(BUILD/'partition_table/partition-table.bin').read_bytes()
    sector=digest(table.ljust(0x1000,b'\xff'))
    assert len(table)<=0x1000 and sector==old['partition_table_sector_sha256']
    app=(BUILD/'xiaozhi.bin').read_bytes();descriptor=app.find(bytes.fromhex('3254cdab'),0,4096)
    assert descriptor>=0 and app[descriptor+16:descriptor+48].split(b'\0')[0]==VERSION.encode()
    assets=(BUILD/'generated_assets.bin').read_bytes();assert digest(assets)==old['assets']['sha256']
    logs={f'{STAGE}-firmware-build.log':'Project build complete',f'{STAGE}-voice-tests.log':'boot overrides saved volume to 100'}
    for name,marker in logs.items():assert marker in (ROOT/'logs'/name).read_text('utf-8'),name
    out.mkdir(parents=True,exist_ok=True)
    report={'stage':STAGE,'firmware_version':VERSION,'boot_volume':100,'hardware_function_test':'pending',
        'baseline':'P8-overview-test01; source changes restricted to startup volume and version',
        'rollback':'P8-overview-test01 (startup volume 85)',
        'android':'Use existing P8-overview-test01 APK; no APK update required',
        'android_apk_sha256':old['apk']['sha256'],'firmware_source_guards':checked,
        'partition_table_sector_sha256':sector,'wake_validation':verify_build(),'assets_validation':validate_assets(assets),
        'source_files_sha256':{},'validation':{'build':'passed','existing_voice_tests':'passed including startup volume 100','device_flash':'not performed','hardware':'pending'}}
    for key,source,name in (
        ('app',BUILD/'xiaozhi.bin','p8-overview02-xiaozhi-app.bin'),
        ('assets',BUILD/'generated_assets.bin','p8-overview02-xiaozhi-assets.bin'),
        ('restore_app',previous/old['app']['filename'],'restore-P8-overview-test01-app.bin'),
        ('restore_assets',previous/old['assets']['filename'],'restore-P8-overview-test01-assets.bin')):
        data=source.read_bytes();assert 0<len(data)<(0x800000 if 'assets' in key else 0x3f0000)
        shutil.copy2(source,out/name);report[key]={'filename':name,'bytes':len(data),'sha256':digest(data)}
    helper=(previous/'flash_p8.py').read_text('utf-8').replace('P8-overview01 program','P8-overview02 program').replace('P8-avatar-test11 program','P8-overview-test01 program')
    (out/'flash_p8.py').write_text(helper,encoding='utf-8')
    relatives=[p for p in old['source_files_sha256'] if p.startswith('firmware/')]
    relatives+=['tests/p5host/voice_test.cc','tools/test_voice_pages.py','tools/test_release_guards.py','tools/package_volume100.py','tools/build.ps1','docs/P8-overview-test02-验收.md']
    for relative in relatives:
        source=ROOT/relative;target=out/'source'/relative
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
        report['source_files_sha256'][relative]=digest(source.read_bytes())
    shutil.copytree(previous/'third-party',out/'third-party',dirs_exist_ok=True)
    shutil.copy2(ROOT/'docs/P8-overview-test02-验收.md',out/'README-验收.md')
    for name in logs:shutil.copy2(ROOT/'logs'/name,out/name)
    guard=ROOT/'logs'/f'{STAGE}-release-guards.log'
    if guard.exists():
        assert 'Ran 7 tests' in guard.read_text('utf-8') and '\nOK\n' in guard.read_text('utf-8')
        shutil.copy2(guard,out/guard.name);report['validation']['release_guards']='7 passed'
    report['package_support_sha256']={p.name:digest(p.read_bytes()) for p in out.iterdir() if p.is_file() and p.suffix in ('.py','.md','.log')}
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(run([sys.executable,out/'flash_p8.py','--check-files']))
    print(f'PASS: {VERSION}, startup volume 100; {checked} firmware source guards; hardware pending')

if __name__=='__main__':main()
