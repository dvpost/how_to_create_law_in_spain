"""Validate complete authored translations and emit a file:// compatible script."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FIELDS = {'title', 'heading', 'description', 'summary', 'note', 'text', 'label', 'organicLabel'}


def content_strings():
    result = []

    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in FIELDS and isinstance(item, str) and re.search('[А-Яа-яЁё]', item):
                    if item not in result:
                        result.append(item)
                elif key != 'aliases':
                    walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    for name in ['data', 'graph', 'glossary']:
        walk(json.loads((ROOT / (name + '.json')).read_text(encoding='utf-8')))
    return result


def build():
    originals = json.loads((ROOT / 'locales/ru.json').read_text(encoding='utf-8'))
    current = content_strings()
    if current != originals:
        raise ValueError('Content changed: update locales/ru.json and its authored translations together')
    translated = {}
    for line in (ROOT / 'locales/content.tsv').read_text(encoding='utf-8').splitlines():
        number, es, en = line.split('\t')
        index = int(number)
        if index in translated or not es.strip() or not en.strip():
            raise ValueError('Duplicate or empty translation: ' + number)
        if re.search('[А-Яа-яЁё]', es + en):
            raise ValueError('Untranslated Cyrillic: ' + number)
        translated[index] = [originals[index], es.replace('\\n', '\n'), originals[index], en.replace('\\n', '\n')]
    if set(translated) != set(range(len(originals))):
        raise ValueError('Incomplete content translations')
    ui = []
    for line in (ROOT / 'locales/ui.tsv').read_text(encoding='utf-8').splitlines():
        ru, es, en = line.split('\t')
        if not all([ru, es, en]):
            raise ValueError('Empty UI translation: ' + ru)
        ui.append([ru, es, ru, en])
    aliases = json.loads((ROOT / 'locales/aliases.json').read_text(encoding='utf-8'))
    locators=[]
    for line in (ROOT / 'locales/locators.tsv').read_text(encoding='utf-8').splitlines():
        ru,es,en=line.split('\t')
        if not es.strip() or not en.strip() or re.search('[А-Яа-яЁё]',es+en):
            raise ValueError('Incomplete locator translation: '+ru)
        locators.append([ru,es,ru,en])
    required_locators=set()
    def collect_locators(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key=='loc' and re.search('[А-Яа-яЁё]',item):required_locators.add(item)
                collect_locators(item)
        elif isinstance(value,list):
            for item in value:collect_locators(item)
    for name in ['data','glossary']:
        collect_locators(json.loads((ROOT/(name+'.json')).read_text(encoding='utf-8')))
    if {row[0] for row in locators}!=required_locators or len(locators)!=len(required_locators):
        raise ValueError('Incomplete or duplicate locator catalog')
    terms = json.loads((ROOT / 'glossary.json').read_text(encoding='utf-8'))
    for lang in ['es', 'en']:
        if set(aliases[lang]) != {term['id'] for term in terms}:
            raise ValueError('Incomplete glossary aliases: ' + lang)
        used = {}
        for term in terms:
            for alias in term['aliases'] + aliases[lang][term['id']]:
                normalized = alias.lower()
                if normalized in used and used[normalized] != term['id']:
                    raise ValueError('Ambiguous alias: ' + lang + ': ' + alias)
                used[normalized] = term['id']
    fragments = ['Источник №', 'Испания · проверено ', 'Загружено: ', 'Загрузка UTC: ', 'Пояснить: ',
                 'Браузер не включил полноэкранный режим: ', 'Не удалось построить карту: ',
                 'Не удалось загрузить сайт: ', ' / органический: ', 'Архив проверки ',
                 '. Консолидированные тексты BOE имеют информационный характер. Ссылки на официальные публикации и изменения находятся в оригиналах.',
                 'Условный учебный пример применения правила: ']
    fragments.extend(row[0] for row in ui if row[0].endswith(': ') and row[0] not in fragments)
    keys = {row[0] for row in ui}
    if not set(fragments).issubset(keys):
        raise ValueError('Missing UI fragments: ' + str(set(fragments) - keys))
    result = dict(content=[translated[i] for i in range(len(originals))], ui=ui, locators=locators, aliases=aliases, fragments=fragments)
    (ROOT / 'translations.js').write_text('window.LAW_TRANSLATIONS = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'Built {len(originals)} content translations and {len(ui)} UI translations in ES/RU/EN')


if __name__ == '__main__':
    build()
