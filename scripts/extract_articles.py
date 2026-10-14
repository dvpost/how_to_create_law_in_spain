"""Extract BOE article blocks; named LOREG headings cover the selected glossary articles."""
import json
import re
from download_sources import ROOT, Text

def articles(key):
    raw = (ROOT / 'sources' / key / 'official.html').read_text(encoding='utf-8')
    result = {}
    for match in re.finditer(r'<div class="bloque" id="([^"]+)">(.*?)(?=<hr class="bloque"|\Z)', raw, re.S):
        anchor, markup = match.groups()
        parser = Text(); parser.feed(markup)
        text = '\n'.join(' '.join(line.split()) for line in ''.join(parser.parts).splitlines() if line.strip())
        heading = re.search(r'^Artículo\s+(\d+)(?:\s+(bis|ter|quater)(?:\s+(\d+))?)?', text, re.M)
        words = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo', 'undécimo', 'duodécimo', 'decimotercero', 'decimocuarto', 'decimoquinto']
        if heading:
            number = heading.group(1) + ((' ' + heading.group(2)) if heading.group(2) else '') + ((' ' + heading.group(3)) if heading.group(3) else '')
        else:
            named = re.search(r'^Artículo\s+([^\n.]+)', text, re.M)
            ordinals = {word: str(index + 1) for index, word in enumerate(words)}
            ordinals.update({'veintinueve':'29', 'treinta y uno':'31'})
            if not named or named.group(1) not in ordinals: continue
            number = ordinals[named.group(1)]
        result[number] = dict(anchor=anchor, text=text)
    return result

if __name__ == '__main__':
    result = {key: articles(key) for key in ('constitution', 'congress', 'senate', 'ilp', 'publication', 'civil', 'government', 'electoral', 'valencia-statute', 'basque-statute', 'local-regime')}
    (ROOT / 'sources' / 'articles.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    selected = {'senate':['107','115','120','122','133'], 'publication':['3','17']}
    for key, numbers in selected.items():
        for number in numbers:
            print(key, number, result[key][number]['text'])
