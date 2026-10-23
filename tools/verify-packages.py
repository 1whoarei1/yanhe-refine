from pathlib import Path
import hashlib,json,zipfile

root=Path(__file__).resolve().parents[1]
report=[]
for personal in (False,True):
 name='yanhe-desk-0.4.0'+('-personal' if personal else '')
 folder=root/'dist'/name
 archive=folder.parent/(name+'.zip')
 with zipfile.ZipFile(archive) as z:
  names=z.namelist()
  assert len(names)==len(set(names))
  assert z.testzip() is None
  assert all(not n.startswith(('/', '../')) and '..' not in Path(n).parts for n in names)
  assert ('private-catalog.json' in names)==personal
  manifest=json.loads(z.read('manifest.json'))
  assert manifest['version']=='0.4.0' and manifest['name']=='延河学习台'
  info=json.loads(z.read('build-info.json'))
  assert bool(info['catalog'])==personal
  if personal:
   seed=z.read('private-catalog.json')
   assert hashlib.sha256(seed).hexdigest()==info['catalog']['sha256']
   assert len(json.loads(seed)['courses'])==106933
  for n in names:
   assert z.read(n)==(folder/n).read_bytes(),n
  for n in ['README.md','THIRD_PARTY_NOTICES.md','LICENSE','licenses/fflate.LICENSE','licenses/saxes.LICENSE','licenses/xmlchars.LICENSE','licenses/BIT_yanhe_download.LICENSE','watch/vendor/hls.LICENSE','watch/vendor/md5.LICENSE','watch/vendor/mpegts.LICENSE','watch/vendor/mpegts.NOTICE.txt']:
   assert n in names,n
  assert not any(any(p in n.lower() for p in ['.sqlite','.env','session.json','node_modules/','test-results/','local-data/']) for n in names)
 report.append({'archive':str(archive),'personal':personal,'files':len(names),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
(root/'test-results'/'package-report.json').write_text(json.dumps({'ok':True,'packages':report},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'ok':True,'packages':report},ensure_ascii=False))
