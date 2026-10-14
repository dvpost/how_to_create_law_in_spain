"""Build the pinned libavoid browser script with embedded WASM for file:// use."""
import base64
from datetime import datetime, timezone
from hashlib import sha256, sha512
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.5.0-beta.5'
URL = f'https://registry.npmjs.org/libavoid-js/-/libavoid-js-{VERSION}.tgz'
INTEGRITY = 'sha512-jHkn6A10815TgFhZ1paUD/NDnQkg4C66qJc2Juj1NpmO/+QXnJ4UjIdKQarkXLmI/QgXhEO3RWDxMi3i+uHPwA=='

if __name__ == '__main__':
    with urlopen(URL, timeout=30) as response:
        archive = response.read()
    if 'sha512-' + base64.b64encode(sha512(archive).digest()).decode() != INTEGRITY:
        raise ValueError('libavoid npm integrity mismatch')
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as package:
        source = package.extractfile('package/dist/index.js').read().decode()
        wasm = package.extractfile('package/dist/libavoid.wasm').read()
        license_text = package.extractfile('package/LICENSE').read()
    # Supply bytes directly: the runtime never fetches a WASM file or URL.
    replacements = {'import.meta.url': ('moduleURL', 2),
                    'le({locateFile:ce})': ('le({wasmBinary})', 1),
                    'export{Br as AvoidLib};': ('window.AvoidLib=Br;', 1)}
    for old, (new, count) in replacements.items():
        if source.count(old) != count:
            raise ValueError('Unexpected pinned libavoid entry point: ' + old)
        source = source.replace(old, new)
    source = source.split('//# sourceMappingURL=')[0]
    bundle = ('// libavoid-js ' + VERSION + '; LGPL-2.1-or-later. Built by scripts/vendor_libavoid.py.\n'
              '(()=>{const moduleURL=document.currentScript.src;\n'
              'const wasmBinary=Uint8Array.from(atob("' + base64.b64encode(wasm).decode() + '"),c=>c.charCodeAt(0));\n'
              + source + '\n})();\n').encode()
    (ROOT/'vendor/libavoid.js').write_bytes(bundle)
    (ROOT/'vendor/libavoid.LICENSE').write_bytes(license_text)
    path = ROOT/'vendor/manifest.json'
    entries = json.loads(path.read_text(encoding='utf-8'))
    entries = [entry for entry in entries if entry['package'] != 'libavoid-js']
    entries.append({'package':'libavoid-js','version':VERSION,'file':'vendor/libavoid.js',
                    'sha256':sha256(bundle).hexdigest(),'tarball':URL,'npm_integrity':INTEGRITY,
                    'license':'LGPL-2.1-or-later','wasm_sha256':sha256(wasm).hexdigest(),
                    'build':'scripts/vendor_libavoid.py: classic browser script, embedded WASM bytes',
                    'retrieved_at_utc':datetime.now(timezone.utc).isoformat()})
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Built pinned libavoid with embedded WASM:', len(bundle), 'bytes')
