"""Verify retained sources and package public files plus Nginx deployment files."""
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = (
    'index.html', 'favicon.svg', 'styles.css', 'app.js', 'graph.js', 'graph-layout.js',
    'graph-routing.js', 'graph-data.js', 'glossary.js', 'data.js',
    'translations.js', 'i18n.js', 'browser-language.js', 'analytics.js',
)
DEPLOY_FILES = (
    'Dockerfile', 'compose.yaml', '.dockerignore', 'deploy/nginx.conf',
    'deploy/nginx-main.conf', 'deploy/law-pipeline-spain.service',
    'deploy/how-to-create-law-in-spain.caddy',
    'docs/DEPLOYMENT.md',
)


def verify_sources():
    for entry in json.loads((ROOT / 'vendor/manifest.json').read_text(encoding='utf-8')):
        if sha256((ROOT / entry['file']).read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('Vendored dependency hash mismatch: ' + entry['file'])
    for metadata in sorted((ROOT / 'proofs').glob('*/metadata.json')):
        proof = json.loads(metadata.read_text(encoding='utf-8'))
        for source in proof['sources']:
            archived = metadata.parent / (source['key'] + '.html')
            if sha256(archived.read_bytes()).hexdigest() != source['sha256']:
                raise ValueError('Archived proof hash mismatch: ' + str(archived))


def package():
    verify_sources()
    files = [(ROOT / name, 'public/' + name) for name in PUBLIC_FILES]
    for directory in ('vendor', 'proofs'):
        files.extend(
            (path, 'public/' + path.relative_to(ROOT).as_posix())
            for path in sorted((ROOT / directory).rglob('*')) if path.is_file()
        )
    files.extend((ROOT / name, name) for name in DEPLOY_FILES)
    # Validate all inputs before replacing an existing delivery archive.
    for path, _ in files:
        if not path.is_file():
            raise FileNotFoundError('Required server package input is missing: ' + str(path))
    archive = ROOT / 'law-pipeline-spain-server.zip'
    with ZipFile(archive, 'w', compression=ZIP_DEFLATED, compresslevel=9) as output:
        for path, name in files:
            output.write(path, name)
    with ZipFile(archive) as output:
        if output.testzip() is not None:
            raise ValueError('ZIP integrity check failed')
    print(archive.name, archive.stat().st_size, 'bytes;', len(files), 'files')


if __name__ == '__main__':
    package()
