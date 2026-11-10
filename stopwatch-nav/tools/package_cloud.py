"""Package the server-navigation increment with overview02 rollback and source guards."""
import json,shutil,sys
from package_p1 import ROOT,BUILD,digest,run,validate_assets
from test_wake_assets import verify_build

def main():
    previous=ROOT/'releases/P8-overview-test02';out=ROOT/'releases/P9-cloud01'
    assert not (out/'acceptance.json').exists(),'Accepted release is immutable'
    old=json.loads((previous/'build-report.json').read_text('utf-8'))
    changed={'firmware/CMakeLists.txt','firmware/main/CMakeLists.txt','firmware/main/boards/m5stack-stopwatch/local_link_server.cc','firmware/main/boards/m5stack-stopwatch/local_link_server.h'}
    checked=0
    for relative,expected in old['source_files_sha256'].items():
        assert digest((previous/'source'/relative).read_bytes())==expected,relative
        if relative.startswith('firmware/') and relative not in changed:
            assert digest((ROOT/relative).read_bytes())==expected,relative
            checked+=1
    app=(BUILD/'xiaozhi.bin').read_bytes();descriptor=app.find(bytes.fromhex('3254cdab'),0,4096)
    assert descriptor>=0 and app[descriptor+16:descriptor+48].split(b'\0')[0]==b'2.2.6-p9-cloud01'
    assets=(BUILD/'generated_assets.bin').read_bytes();assert digest(assets)==old['assets']['sha256']
    table=(BUILD/'partition_table/partition-table.bin').read_bytes();sector=digest(table.ljust(0x1000,b'\xff'));assert sector==old['partition_table_sector_sha256']
    for key in ('app','assets'):assert digest((previous/old[key]['filename']).read_bytes())==old[key]['sha256']
    logs={'P9-cloud01-build.log':'Project build complete','P9-cloud01-protocol.log':'PASS: overview Kotlin/firmware','P9-cloud01-pages.log':'PASS: overview actual LVGL','P9-cloud01-voice.log':'boot overrides saved volume to 100','P9-cloud01-server-wire.log':'PASS: real server QMAP/QRTE'}
    for name,marker in logs.items():assert marker in (ROOT/'logs'/name).read_text('utf-8'),name
    out.mkdir(parents=True,exist_ok=True)
    report={'stage':'P9-cloud01','firmware_version':'2.2.6-p9-cloud01','baseline':'P8-overview-test02','rollback':'P8-overview-test02','hardware_function_test':'pending','partition_table_sector_sha256':sector,'source_files_sha256':{},'firmware_source_guards':checked,'wake_validation':verify_build(),'assets_validation':validate_assets(assets),'validation':{'build':'passed','protocol':'passed','lvgl':'passed','voice':'passed','server_wire':'passed','device_flash':'not performed','physical_test':'pending'}}
    for key,source,name in [('app',BUILD/'xiaozhi.bin','p9-cloud01-app.bin'),('assets',BUILD/'generated_assets.bin','p9-cloud01-assets.bin'),('restore_app',previous/old['app']['filename'],'restore-overview02-app.bin'),('restore_assets',previous/old['assets']['filename'],'restore-overview02-assets.bin')]:
        shutil.copy2(source,out/name);data=source.read_bytes();report[key]={'filename':name,'bytes':len(data),'sha256':digest(data)}
    helper=(previous/'flash_p8.py').read_text('utf-8').replace('P8-overview02 program','P9-cloud01 program').replace('P8-overview-test01 program','P8-overview-test02 program')
    (out/'flash_p9.py').write_text(helper,encoding='utf-8')
    relatives=[p for p in old['source_files_sha256'] if p.startswith('firmware/')]
    relatives+=['firmware/main/boards/m5stack-stopwatch/cloud_navigation.cc','firmware/main/boards/m5stack-stopwatch/cloud_navigation.h','tools/configure_cloud.py','tools/package_cloud.py','tests/host/cloud_wire_test.cc','docs/P9-cloud01-验收.md']
    for relative in relatives:
        target=out/'source'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/relative,target);report['source_files_sha256'][relative]=digest(target.read_bytes())
    shutil.copy2(ROOT/'tools/configure_cloud.py',out/'configure_cloud.py');shutil.copy2(ROOT/'docs/P9-cloud01-验收.md',out/'README-验收.md')
    shutil.copytree(previous/'third-party',out/'third-party',dirs_exist_ok=True)
    for name in logs:shutil.copy2(ROOT/'logs'/name,out/name)
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(run([sys.executable,out/'flash_p9.py','--check-files']))
    print(f'PASS: P9-cloud01 package; {checked} unchanged firmware source guards; hardware pending')
if __name__=='__main__':main()
