from pathlib import Path
import json,zipfile,sys,shutil
root=Path(__file__).resolve().parents[1]
source=root/'extension';manifest=json.loads((source/'manifest.json').read_text(encoding='utf8'))
personal='--personal' in sys.argv
with_imports='--with-imports' in sys.argv
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
name=f'yanhe-refine-{manifest["version"]}'+('-personal' if personal else '')+('-session-test' if with_sessions else '')
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
 if (root/name).exists():shutil.copy2(root/name,folder/name);files.append(Path(name))
if with_catalog:
 catalog=json.loads(catalog_file.read_text(encoding='utf8'));counts=catalog['counts']
 assert counts['total']==len(catalog['courses']) and catalog_file.stat().st_size<=32*1024*1024
 assert counts=={'total':len(catalog['courses']),'modern':sum(row['platform']=='modern' for row in catalog['courses']),'legacy':sum(row['platform']=='legacy' for row in catalog['courses'])}
 assert counts['legacy']==0 and all(row['platform']=='modern' for row in catalog['courses'])
 directory=Path('课程目录');(folder/directory).mkdir()
 shutil.copy2(catalog_file,folder/directory/'课程目录.json');files.append(directory/'课程目录.json')
 instructions=f'''课程目录 · {catalog['snapshot_date']}

在插件中打开「设置」→「导入课程表」，选择本文件夹内的「课程目录.json」。
导入后可离线检索目录，观看仍需登录课堂。文件不会自动导入。

共 {counts['modern']:,} 条新版课程；本包不包含旧版课程表。
同名课程的不同年份、教学班分别保留；这是已收集的目录快照，不代表实时课程总量。
旧版 session 目录待后续接入，现在可直接粘贴旧站 session 链接观看回放。

仅含课程 ID、平台、名称、教师、学期、学院、课程代码等课程元数据。
不含登录信息、选课关系、收藏、观看进度、成绩、作业或视频地址。
目录只随发布包分发，不提交源码仓库。
'''
 (folder/directory/'导入说明.txt').write_text(instructions,encoding='utf8');files.append(directory/'导入说明.txt')
if with_imports:
 session_file=root/'local-data/release-session-index.json'
 snapshot=json.loads(session_file.read_text(encoding='utf8'))
 assert snapshot['format']=='yanhekt-session-index/v1' and snapshot['source']['kind']=='self-collected'
 assert session_file.stat().st_size<=32*1024*1024
 shutil.copy2(session_file,folder/directory/'旧版课次目录.json');files.append(directory/'旧版课次目录.json')
 instructions=f"""在「设置 → 导入课程表」中，分别导入本文件夹的两个 JSON。

新版：课程目录.json（{len(catalog['courses']):,} 门课程）
旧版：旧版课次目录.json（{len(snapshot['courses']):,} 门课程、{sum(len(c['sessions']) for c in snapshot['courses']):,} 个课次）
旧版快照：{snapshot['generatedAt']}，持续采集中。

更新目录时重新导入即可。目录可离线检索，观看仍需登录原站。
回放助手可在「全校课程 → 导入目录」中使用这两份文件。
"""
 (folder/directory/'导入说明.txt').write_text(instructions,encoding='utf8')
archive=folder.parent/(folder.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for rel in files:z.write(folder/rel,rel.as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and 'manifest.json' in z.namelist()
 if not personal:assert 'private-catalog.json' not in z.namelist()
 assert ('legacy-session-index.json' in z.namelist())==with_sessions
print(json.dumps({'folder':str(folder),'zip':str(archive),'personal':personal,'importableCatalog':with_catalog,'files':len(files)},ensure_ascii=False))
