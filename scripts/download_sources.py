"""Fetch the specified official texts once; retain exact bytes and hashes."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'constitution': ('Constitución Española', 'https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229'),
    'congress': ('Reglamento del Congreso', 'https://www.boe.es/buscar/act.php?id=BOE-A-1982-5196'),
    'senate': ('Reglamento del Senado', 'https://www.boe.es/buscar/act.php?id=BOE-A-1994-10830'),
    'ilp': ('Ley Orgánica 3/1984 · iniciativa legislativa popular', 'https://www.boe.es/buscar/act.php?id=BOE-A-1984-7249'),
    'publication': ('Real Decreto 181/2008 · BOE', 'https://www.boe.es/buscar/act.php?id=BOE-A-2008-2389'),
    'civil': ('Código Civil', 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763'),
    'royal-comment': ('Congreso · comentario oficial del artículo 91', 'https://constitucion.congreso.es/imprimir-articulo?numero=91'),
    'government': ('Ley 50/1997 · del Gobierno', 'https://www.boe.es/buscar/act.php?id=BOE-A-1997-25336'),
    'electoral': ('Ley Orgánica 5/1985 · régimen electoral general', 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672'),
    'parliament-dictionary': ('Senado · словарь парламентских терминов', 'https://www.senado.es/web/diccionarioterminosparlamentarios/index.html?lang=es'),
    'valencia-statute': ('Ley Orgánica 5/1982 · Estatuto de Autonomía de la Comunidad Valenciana', 'https://www.boe.es/buscar/act.php?id=BOE-A-1982-17235'),
    'basque-statute': ('Ley Orgánica 3/1979 · Estatuto de Autonomía para el País Vasco', 'https://www.boe.es/buscar/act.php?id=BOE-A-1979-30177'),
    'bicameral-guide': ('Senado · El Senado en el sistema bicameral español', 'https://www.senado.es/web/conocersenado/temasclave/sistemabicameral/index.html?lang=es_ES'),
    'local-regime': ('Ley 7/1985 · Bases del Régimen Local', 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-5392'),
}

class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.ignored = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.ignored += 1
        if tag in ('p', 'div', 'h2', 'h3', 'h4', 'h5', 'li', 'br'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.ignored -= 1
        if tag in ('p', 'div', 'li'): self.parts.append('\n')
    def handle_data(self, data):
        if not self.ignored: self.parts.append(data)

def fetch(item):
    key, (title, url) = item
    request = Request(url, headers={'User-Agent': 'Local educational research; official source archive'})
    with urlopen(request, timeout=60) as response:
        raw = response.read()
        resolved = response.url
        content_type = response.headers.get('Content-Type')
    folder = ROOT / 'sources' / key
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'official.html').write_bytes(raw)
    parser = Text()
    parser.feed(raw.decode('utf-8'))
    lines = [' '.join(line.split()) for line in ''.join(parser.parts).splitlines()]
    (folder / 'text.txt').write_text('\n'.join(line for line in lines if line), encoding='utf-8')
    result = dict(title=title, url=url, resolved_url=resolved, retrieved_at_utc=datetime.now(timezone.utc).isoformat(), sha256=sha256(raw).hexdigest(), content_type=content_type, file=f'sources/{key}/official.html')
    (folder / 'metadata.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return key, result

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=7) as pool:
        results = dict(pool.map(fetch, SOURCES.items()))
    (ROOT / 'sources' / 'manifest.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    for key, result in results.items(): print(key, result['sha256'], result['retrieved_at_utc'])
