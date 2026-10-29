from pathlib import Path
O=Path(r'F:\coding_projects\ai-tour-guide-device\modeling/v03');f=O/'scripts/build_print_v03.py';s=f.read_text(encoding='utf-8-sig');s=s.replace('import sys,json,math,struct,time','import sys,json,math,struct,time,subprocess')
start=s.index(" data=path.read_bytes();num=struct.unpack_from('<I',data,80)[0];rt=")
end=s.index(" np.savez(O/f'reports/{name}.npz'",start)
new=''' def reimport():
  data=path.read_bytes();num=struct.unpack_from('<I',data,80)[0];rt=np.frombuffer(data,dt,count=num,offset=84)['v'].copy();verts,inv=np.unique(rt.reshape(-1,3),axis=0,return_inverse=True);ff=np.ascontiguousarray(inv.reshape(-1,3),np.uint32);mm=M.Manifold(M.Mesh(np.ascontiguousarray(verts,np.float32),ff));return mm,verts,ff
 mm,verts,ff=reimport()
 if str(mm.status())!='Error.NoError':
  result=subprocess.run([r'D:\\mapping software\\blender\\blender.exe','--background','--factory-startup','--python',str(O/'scripts/repair_stl_tjunction.py'),'--',str(path)],capture_output=True,text=True,encoding='utf8',errors='replace');log(result.stdout.strip());assert result.returncode==0,result.stderr
  mm,verts,ff=reimport()
 assert str(mm.status())=='Error.NoError',(name,'reimport',mm.status());assert len(mm.decompose())==1
 checks[name]['reimport_dimensions_mm']=np.ptp(verts,axis=0).tolist();checks[name]['reimport_manifold_status']=str(mm.status());checks[name]['actual_readback_triangles']=len(ff);checks[name]['print_translation_mm']=[-(bb[0]+bb[3])/2,-(bb[1]+bb[4])/2,-bb[2]]
 v=verts;f=ff
'''
s=s[:start]+new+s[end:];f.write_text(s,encoding='utf8')
