from pathlib import Path
import hashlib,json,zipfile,sys

root=Path(__file__).resolve().parents[1]
report=[]
expected=json.loads((root/'src/manifest.json').read_text(encoding='utf8'))
with_sessions='--with-session-index' in sys.argv
for personal in ([False,True] if '--personal' in sys.argv else [False]):
 name='yanhe-refine-'+expected['version']+('-personal' if personal else '')+('-session-test' if with_sessions else '')
 folder=root/'dist'/name
 archive=folder.parent/(name+'.zip')
 with zipfile.ZipFile(archive) as z:
  names=z.namelist()
  assert len(names)==len(set(names))
  assert z.testzip() is None
  assert all(not n.startswith(('/', '../')) and '..' not in Path(n).parts for n in names)
  assert ('private-catalog.json' in names)==personal
  manifest=json.loads(z.read('manifest.json'))
  assert manifest==expected
  info=json.loads(z.read('build-info.json'))
  assert bool(info['catalog'])==personal
  assert ('legacy-session-index.json' in names)==with_sessions
  if with_sessions:
   snapshot=z.read('legacy-session-index.json')
   assert snapshot==(root/'local-data/legacy-session-index.json').read_bytes()
   data=json.loads(snapshot)
   assert data['format']=='yanhekt-session-index/v1' and data['source']['kind']=='self-collected'
   assert len(data['courses'])==data['coverage']['courses']
   assert sum(len(row['sessions']) for row in data['courses'])==data['coverage'].get('exportedSessions',data['coverage']['sessions'])
  has_import_catalog='课程目录/课程目录.json' in names
  if not personal and '--with-catalog' in sys.argv:assert has_import_catalog
  if has_import_catalog:
   assert not personal and '课程目录/导入说明.txt' in names
   payload=z.read('课程目录/课程目录.json');catalog=json.loads(payload)
   assert len(payload)<=32*1024*1024
   allowed={'platform','id','tenant','title','teacher','term','college','code'}
   records=catalog['courses'];identities=set()
   for row in records:
    assert set(row)<=allowed and row['platform']=='modern'
    assert row['id'].isdigit() and 1<=len(row['id'])<=12 and row['title'].strip()
    key=(row['platform'],row.get('tenant','21'),row['id']);assert key not in identities;identities.add(key)
   assert catalog['counts']=={'total':len(records),'modern':sum(r['platform']=='modern' for r in records),'legacy':sum(r['platform']=='legacy' for r in records)}
   assert payload==(root/'local-data/release-catalog.json').read_bytes()
  if '--with-imports' in sys.argv:
   assert '课程目录/旧版课次目录.json' in names and has_import_catalog
   snapshot=z.read('课程目录/旧版课次目录.json');assert snapshot==(root/'local-data/release-session-index.json').read_bytes()
   data=json.loads(snapshot);assert data['format']=='yanhekt-session-index/v1' and data['source']['kind']=='self-collected'
   assert len(data['courses'])==data['coverage']['courses']
   assert sum(len(row['sessions']) for row in data['courses'])==data['coverage'].get('exportedSessions',data['coverage']['sessions'])
  if personal:
   seed=z.read('private-catalog.json')
   assert hashlib.sha256(seed).hexdigest()==info['catalog']['sha256']
   assert len(json.loads(seed)['courses'])==info['catalog']['count']
   assert all(row['platform']=='modern' for row in json.loads(seed)['courses'])
  for n in names:
   assert z.read(n)==(folder/n).read_bytes(),n
  for n in ['README.md','THIRD_PARTY_NOTICES.md','LICENSE','licenses/fflate.LICENSE','licenses/saxes.LICENSE','licenses/xmlchars.LICENSE','licenses/parse5.LICENSE','licenses/entities.LICENSE','licenses/BIT_yanhe_download.LICENSE','watch/vendor/hls.LICENSE','watch/vendor/md5.LICENSE','watch/vendor/mpegts.LICENSE','watch/vendor/mpegts.NOTICE.txt']:
   assert n in names,n
  assert not any(any(p in n.lower() for p in ['.sqlite','.env','session.json','node_modules/','test-results/','local-data/']) for n in names)
 report.append({'archive':str(archive),'personal':personal,'importableCatalog':has_import_catalog,'files':len(names),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
(root/'test-results'/('session-package-report.json' if with_sessions else 'package-report.json')).write_text(json.dumps({'ok':True,'packages':report},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'ok':True,'packages':report},ensure_ascii=False))
