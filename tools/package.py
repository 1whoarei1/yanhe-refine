from pathlib import Path
import json,zipfile,sys,shutil
root=Path(__file__).resolve().parents[1]
source=root/'extension';manifest=json.loads((source/'manifest.json').read_text(encoding='utf8'))
personal='--personal' in sys.argv
with_imports='--with-imports' in sys.argv or not personal
with_catalog='--with-catalog' in sys.argv or with_imports
with_sessions='--with-session-index' in sys.argv
if with_sessions:
 snapshot=json.loads((source/'legacy-session-index.json').read_text(encoding='utf8'))
 assert snapshot['format']=='yanhekt-session-index/v1' and snapshot['source']['kind']=='self-collected'
if personal and with_catalog:raise SystemExit('Use --with-catalog for a public release, or --personal for a private seeded build.')
catalog_file=root/'local-data'/'release-catalog.json'
if with_catalog and not catalog_file.exists():raise SystemExit('Prepare local-data/release-catalog.json first; catalogue data must stay outside Git.')
if personal and not json.loads((source/'build-info.json').read_text(encoding='utf8'))['catalog']:
 raise SystemExit('A personal package requires local-data/catalog.json. Build the public package without --personal.')
development=manifest.get('version_name')==manifest['version']+'-dev'
name=f'yanhe-refine-{manifest["version"]}'+('-dev' if development else '')+('-personal' if personal else '')+('-session-test' if with_sessions else '')
folder=(root/'dist'/name).resolve()
assert folder.parent==(root/'dist').resolve() and folder.name==name
if folder.exists():shutil.rmtree(folder)
folder.mkdir(parents=True)
files=[]
for file in source.rglob('*'):
 if not file.is_file():continue
 rel=file.relative_to(source)
 if rel.as_posix()=='legacy-session-index.json' and not with_sessions:continue
 if rel.as_posix()=='private-catalog.json' and not personal:continue
 target=folder/rel;target.parent.mkdir(parents=True,exist_ok=True)
 if rel.as_posix()=='build-info.json' and not personal:target.write_text(json.dumps({'version':manifest['version'],'catalog':None}),encoding='utf8')
 else:shutil.copy2(file,target)
 files.append(rel)
for name in ['README.md','CHANGELOG.md','THIRD_PARTY_NOTICES.md']:
 if (root/name).exists():
  if name=='README.md':
   text=(root/name).read_text(encoding='utf8').replace('(docs/screenshots/','(https://raw.githubusercontent.com/1whoarei1/yanhe-refine/main/docs/screenshots/')
   (folder/name).write_text(text,encoding='utf8')
  else:shutil.copy2(root/name,folder/name)
  files.append(Path(name))
if with_catalog:
 catalog=json.loads(catalog_file.read_text(encoding='utf8'));counts=catalog['counts']
 assert counts['total']==len(catalog['courses']) and catalog_file.stat().st_size<=32*1024*1024
 assert counts=={'total':len(catalog['courses']),'modern':sum(row['platform']=='modern' for row in catalog['courses']),'legacy':sum(row['platform']=='legacy' for row in catalog['courses'])}
 assert counts['legacy']==0 and all(row['platform']=='modern' for row in catalog['courses'])
 directory=Path('课程目录');(folder/directory).mkdir(exist_ok=True)
 shutil.copy2(catalog_file,folder/directory/'课程目录.json');files.append(directory/'课程目录.json')
 instructions=f"""新版课程目录已内置，首次打开插件自动可用，无需手动导入。
本目录收录 {counts['modern']:,} 门新版课程。观看仍需登录课堂。
这份 JSON 也可在设置中手动导入其它兼容插件。
"""
 (folder/directory/'导入说明.txt').write_text(instructions,encoding='utf8');files.append(directory/'导入说明.txt')
if with_imports:
 session_file=root/'local-data/release-session-index.json'
 snapshot=json.loads(session_file.read_text(encoding='utf8'))
 assert snapshot['format']=='yanhekt-session-index/v1' and snapshot['source']['kind']=='self-collected'
 assert session_file.stat().st_size<=32*1024*1024
 shutil.copy2(session_file,folder/directory/'旧版课次目录.json');files.append(directory/'旧版课次目录.json')
 collection_status='持续采集中' if snapshot.get('partial',True) else '本轮扫描已完成'
 instructions=f"""新版和旧版课程目录已内置，首次打开插件自动可用，无需手动导入。
新版：{len(catalog['courses']):,} 门课程。
旧版：{len(snapshot['courses']):,} 门课程、{sum(len(c['sessions']) for c in snapshot['courses']):,} 个课次。
观看仍需登录课堂。已手动导入的更新目录会保留。
两份 JSON 也可用于回放助手的「全校课程 → 导入目录」。
"""
 (folder/directory/'导入说明.txt').write_text(instructions,encoding='utf8')
archive=folder.parent/(folder.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for rel in sorted(set(files)):z.write(folder/rel,rel.as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and 'manifest.json' in z.namelist()
 if not personal:assert 'private-catalog.json' not in z.namelist()
 assert ('legacy-session-index.json' in z.namelist())==with_sessions
print(json.dumps({'folder':str(folder),'zip':str(archive),'personal':personal,'importableCatalog':with_catalog,'files':len(set(files))},ensure_ascii=False))
