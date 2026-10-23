from pathlib import Path
import json,zipfile,sys,shutil
root=Path(__file__).resolve().parents[1]
source=root/'extension';manifest=json.loads((source/'manifest.json').read_text(encoding='utf8'))
personal='--personal' in sys.argv
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
archive=folder.parent/(folder.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for rel in files:z.write(folder/rel,rel.as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and 'manifest.json' in z.namelist()
 if not personal:assert 'private-catalog.json' not in z.namelist()
print(json.dumps({'folder':str(folder),'zip':str(archive),'personal':personal,'files':len(files)},ensure_ascii=False))
