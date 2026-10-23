from pathlib import Path
import json,zipfile,sys,shutil
root=Path(__file__).resolve().parents[1]
source=root/'extension';manifest=json.loads((source/'manifest.json').read_text(encoding='utf8'))
personal='--personal' in sys.argv
with_catalog='--with-catalog' in sys.argv
if personal and with_catalog:raise SystemExit('Use --with-catalog for a public release, or --personal for a private seeded build.')
catalog_file=root/'local-data'/'release-catalog.json'
if with_catalog and not catalog_file.exists():raise SystemExit('Prepare local-data/release-catalog.json first; catalogue data must stay outside Git.')
if personal and not json.loads((source/'build-info.json').read_text(encoding='utf8'))['catalog']:
 raise SystemExit('A personal package requires local-data/catalog.json. Build the public package without --personal.')
name=f'yanhe-refine-{manifest["version"]}'+('-personal' if personal else '')
folder=(root/'dist'/name).resolve()
assert folder.parent==(root/'dist').resolve() and folder.name==name
if folder.exists():shutil.rmtree(folder)
folder.mkdir(parents=True)
files=[]
for file in source.rglob('*'):
 if not file.is_file():continue
 rel=file.relative_to(source)
 if rel.as_posix()=='private-catalog.json' and not personal:continue
 target=folder/rel;target.parent.mkdir(parents=True,exist_ok=True)
 if rel.as_posix()=='build-info.json' and not personal:target.write_text(json.dumps({'version':manifest['version'],'catalog':None}),encoding='utf8')
 else:shutil.copy2(file,target)
 files.append(rel)
for name in ['README.md','THIRD_PARTY_NOTICES.md']:
 if (root/name).exists():shutil.copy2(root/name,folder/name);files.append(Path(name))
if with_catalog:
 catalog=json.loads(catalog_file.read_text(encoding='utf8'));counts=catalog['counts']
 assert counts['total']==len(catalog['courses']) and catalog_file.stat().st_size<=32*1024*1024
 directory=Path('课程目录');(folder/directory).mkdir()
 shutil.copy2(catalog_file,folder/directory/'课程目录.json');files.append(directory/'课程目录.json')
 instructions=f'''课程目录 · {catalog['snapshot_date']}

在插件中打开「设置」→「导入课程表」，选择本文件夹内的「课程目录.json」。
导入后可离线检索目录，观看仍需登录课堂。文件不会自动导入。

共 {counts['total']:,} 条：新版 {counts['modern']:,} 条，旧版 {counts['legacy']:,} 条。
全校课程界面继续只显示新版课程，旧版数据仍保留在目录中。
同名课程的不同年份、教学班和新旧平台分别保留；这是已收集的目录快照，不代表实时课程总量。

仅含课程 ID、平台、名称、教师、学期、学院、课程代码等课程元数据。
不含登录信息、选课关系、收藏、观看进度、成绩、作业或视频地址。
目录只随发布包分发，不提交源码仓库。
'''
 (folder/directory/'导入说明.txt').write_text(instructions,encoding='utf8');files.append(directory/'导入说明.txt')
archive=folder.parent/(folder.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for rel in files:z.write(folder/rel,rel.as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and 'manifest.json' in z.namelist()
 if not personal:assert 'private-catalog.json' not in z.namelist()
print(json.dumps({'folder':str(folder),'zip':str(archive),'personal':personal,'importableCatalog':with_catalog,'files':len(files)},ensure_ascii=False))
