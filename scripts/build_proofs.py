"""Build the offline proof readers and a file://-compatible data script."""
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]

def build():
    data = json.loads((ROOT/'data.json').read_text(encoding='utf-8'))
    data['glossary'] = json.loads((ROOT/'glossary.json').read_text(encoding='utf-8'))
    proof_ids={proof['id'] for proof in data['proofs']}
    for term in data['glossary']:
        if not term['loc'] or any(ref not in proof_ids for ref in [term['ref'],*term.get('extraRefs',[])]):
            raise ValueError('Unsourced glossary term: '+term['id'])
        for field in ('examples','sections'):
            for item in term.get(field,[]):
                if not item['text'] or not item['loc'] or any(ref not in proof_ids for ref in [item['ref'],*item.get('extraRefs',[])]):
                    raise ValueError('Unsourced glossary '+field+': '+term['id'])
                if field=='examples' and item['kind'] not in ('fact','illustration'):
                    raise ValueError('Invalid glossary example kind: '+term['id'])
    manifest = json.loads((ROOT/'sources/manifest.json').read_text(encoding='utf-8'))
    articles = json.loads((ROOT/'sources/articles.json').read_text(encoding='utf-8'))
    for proof in data['proofs']:
        folder = ROOT/'proofs'/proof['id']; folder.mkdir(parents=True,exist_ok=True)
        sources = []
        for key, numbers in proof['articles'].items():
            meta = manifest[key]
            text = (ROOT/'sources'/key/'text.txt').read_text(encoding='utf-8')
            version = re.search(r'Texto consolidado: «([^»]+)»',text).group(1)
            entries=[]
            for number in numbers:
                article=articles[key][number]
                body=article['text']
                heading=re.search(r'Artículo[^\n]+',body).group(0)
                entries.append(dict(heading=heading,anchor=article['anchor'],text=body))
            sources.append(dict(meta,key=key,version=version,articles=entries))
        if proof.get('comment'):
            key=proof['comment']; meta=manifest[key]
            text=(ROOT/'sources'/key/'text.txt').read_text(encoding='utf-8')
            sentence='No existe margen para que el Jefe del Estado decida nada porque ello entraría directamente en contradicción con su papel.'
            if sentence not in text: raise ValueError('Official commentary excerpt not found')
            sources.append(dict(meta,key=key,version='Официальный комментарий · обновление Enrique García Ortea, 2026 · не норма',articles=[dict(heading='Комментарий к статье 91 · короткая выдержка',anchor='',text='No existe margen para que el Jefe del Estado decida nada')]))
            paragraph=next(line for line in text.splitlines() if line.startswith('Por su propia naturaleza, el precepto comentado'))
            quotes=['firma por el monarca', 'que guarden y hagan guardar esta Ley']
            if any(quote not in paragraph for quote in quotes): raise ValueError('Royal signature excerpt missing')
            sources[-1]['articles'].append(dict(heading='Оформление санкции и промульгации · короткие выдержки комментария',anchor='',text='[…] '+quotes[0]+' […]\n[…] '+quotes[1]+' […]'))
        for supplement in proof.get('supplements',[]):
            key=supplement['key'];meta=manifest[key]
            text=(ROOT/'sources'/key/'text.txt').read_text(encoding='utf-8')
            entries=[]
            for section in supplement['sections']:
                if section['quote'] not in text: raise ValueError('Supplement excerpt missing: '+section['heading'])
                entries.append(dict(heading=section['heading'],anchor='',text=section['quote']))
            sources.append(dict(meta,key=key,version=supplement['description'],articles=entries))
        proof['sources']=sources
        for source in sources:
            raw=ROOT/source['file']
            if sha256(raw.read_bytes()).hexdigest()!=source['sha256']: raise ValueError('Source hash mismatch')
            shutil.copyfile(raw,folder/(source['key']+'.html'))
        claims=[]
        def collect(value):
            if isinstance(value,dict):
                if value.get('ref')==proof['id'] or proof['id'] in value.get('extraRefs',[]):
                    text=value.get('text',value.get('summary',''))
                    if value.get('kind')=='illustration': text='Условный учебный пример применения правила: '+text
                    if text: claims.append(dict(text=text,locator=value.get('loc','')))
                for child in value.values(): collect(child)
            elif isinstance(value,list):
                for child in value: collect(child)
        collect(data['stages']);collect(data['scope']);collect(data['entities']);collect(data.get('glossary',[]))
        local=dict(id=proof['id'],title=proof['title'],checked_date=data['checked'],claims=claims,sources=sources)
        (folder/'metadata.json').write_text(json.dumps(local,ensure_ascii=False,indent=2),encoding='utf-8')
        chunks=['<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Источник №'+proof['id']+'</title><link rel="stylesheet" href="../../styles.css"></head><body><main style="max-width:1000px;margin:40px auto"><a href="../../index.html">← Вернуться к карте</a><h1>Источник №'+proof['id']+'</h1><h2>'+escape(proof['title'])+'</h2><p class="proof-note">Архив проверки '+data['checked']+'. Консолидированные тексты BOE имеют информационный характер. Ссылки на официальные публикации и изменения находятся в оригиналах.</p><h3>Подтверждаемые пункты</h3><ul>']
        # Keep the example label separate so both the label and the authored claim translate exactly.
        for claim in claims:
            prefix='Условный учебный пример применения правила: '
            text=claim['text']
            label='<span>'+escape(prefix)+'</span>' if text.startswith(prefix) else ''
            if label: text=text[len(prefix):]
            chunks.append('<li>'+label+'<span>'+escape(text)+'</span> <small>'+escape(claim['locator'])+'</small></li>')
        chunks.append('</ul>')
        for source in sources:
            chunks.append('<section class="proof-source"><h3>'+escape(source['title'])+'</h3><p class="proof-meta">'+escape(source['version'])+'<br>Загрузка UTC: '+source['retrieved_at_utc']+'<br>SHA-256: '+source['sha256']+'</p><div class="proof-links"><a target="_blank" rel="noopener" href="'+escape(source['url'])+'">Официальный источник ↗</a><a href="'+source['key']+'.html" download>Сохранённый исходный HTML ↓</a><a href="metadata.json">Метаданные</a></div>')
            for article in source['articles']: chunks.append('<h3>'+escape(article['heading'])+'</h3><pre>'+escape(article['text'])+'</pre>')
            chunks.append('</section>')
        chunks.append('</main><nav class="language-controls" aria-label="Язык сайта"><a data-language="es" href="?lang=es" lang="es">ES</a><a data-language="ru" href="?lang=ru" lang="ru">RU</a><a data-language="en" href="?lang=en" lang="en">EN</a></nav></body></html>')
        chunks[0]=chunks[0].replace('<html lang="ru">', '<html lang="ru" class="proof-document">').replace('<body>', '<body class="proof-page">').replace('<main style="max-width:1000px;margin:40px auto">','<main>')
        chunks[0]=chunks[0].replace('</head>', '<script src="../../analytics.js" async></script><script src="../../browser-language.js" defer></script><script src="../../translations.js" defer></script><script src="../../i18n.js" defer></script></head>')
        (folder/'index.html').write_text(''.join(chunks),encoding='utf-8')
        (folder/'excerpt.txt').write_text('\n\n'.join(source['title']+'\n'+'\n\n'.join(a['text'] for a in source['articles']) for source in sources),encoding='utf-8')
    (ROOT/'data.js').write_text('window.LAW_MAP = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    graph = json.loads((ROOT/'graph.json').read_text(encoding='utf-8'))
    (ROOT/'graph-data.js').write_text('window.LAW_GRAPH = '+json.dumps(graph,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    from build_translations import build as build_translations
    build_translations()
    print(f"Built {len(data['proofs'])} proof folders; {len(data['stages'])} interactive stages")

if __name__=='__main__': build()
