"""Verify retained dependencies and proof copies, then package the local site."""
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT=Path(__file__).resolve().parents[1]

if __name__=='__main__':
    for entry in json.loads((ROOT/'vendor/manifest.json').read_text(encoding='utf-8')):
        if sha256((ROOT/entry['file']).read_bytes()).hexdigest()!=entry['sha256']:
            raise ValueError('Vendored dependency hash mismatch: '+entry['file'])
    for metadata in (ROOT/'proofs').glob('*/metadata.json'):
        proof=json.loads(metadata.read_text(encoding='utf-8'))
        for source in proof['sources']:
            if sha256((metadata.parent/(source['key']+'.html')).read_bytes()).hexdigest()!=source['sha256']:
                raise ValueError('Archived proof hash mismatch: '+str(metadata))
    files=[ROOT/name for name in ['index.html','styles.css','app.js','graph.js','graph-layout.js','glossary.js','glossary.json','data.js','data.json','graph.json','graph-data.js','README.md','AGENTS.md']]
    for directory in ['proofs','sources','scripts','vendor','tests']:
        files.extend(path for path in (ROOT/directory).rglob('*') if path.is_file() and '__pycache__' not in path.parts)
    archive=ROOT/'law-pipeline-spain.zip'
    with ZipFile(archive,'w',compression=ZIP_DEFLATED,compresslevel=9) as output:
        for path in files: output.write(path,path.relative_to(ROOT).as_posix())
    with ZipFile(archive) as output:
        if output.testzip() is not None: raise ValueError('ZIP integrity check failed')
    print(archive.name,archive.stat().st_size,'bytes;',len(files),'files')
