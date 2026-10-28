from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
workspace=root.parent
modern=workspace/'延河课堂全部课程/courses-all.json'
courses={}
if modern.exists():
 for r in json.loads(modern.read_text(encoding='utf8'))['courses']:
  id=str(r['id']);courses['modern:'+id]={k:r.get(k,'') for k in ['id','title','teacher','term','college']}|{'platform':'modern'}
out=root/'local-data';out.mkdir(exist_ok=True)
data={'schema':1,'courses':list(courses.values()),'source_files':[modern.name] if modern.exists() else []}
file=out/'catalog.json';file.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({'records':len(courses),'legacy':sum(r['platform']=='legacy' for r in courses.values()),'modern':sum(r['platform']=='modern' for r in courses.values()),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()},ensure_ascii=False))
