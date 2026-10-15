# Публикация на Dedirock

Адрес карты: `https://how-to-create-law-in-spain.criteriascout.xyz/`.
Размещение: Dedirock `192.3.205.61`. DNS A поддомена указывает на VPS;
AAAA не создаётся, поскольку публичный IPv6 хоста не настроен.
DNS управляется владельцем в Spaceship. Рабочее имя содержит дефисы:
подчёркивания в имени для публичного TLS-сертификата недопустимы.

## Разделение сервисов и HTTPS

Host Caddy принимает 80/443, перенаправляет HTTP на HTTPS, получает сертификат
Let's Encrypt по HTTP-01 и автоматически продлевает его. Certbot и отдельный
cron не нужны. Постоянное хранилище сертификатов —
`/var/lib/caddy/.local/share/caddy/`, вне продукта и Git. DNS и порты 80/443
должны оставаться доступными для продления. Единственный ACME issuer задан
явно, как у HA; запасной issuer не добавлен.

`/etc/caddy/Caddyfile` сохраняет HA-блок с backend `127.0.0.1:8123` и импортирует
`/etc/caddy/sites-enabled/*.caddy`. Карта подключена отдельным файлом
`how-to-create-law-in-spain.caddy` из `deploy/`, upstream `127.0.0.1:8087`.
Для следующих доменов добавляются свои файлы и свои upstream. Применение
общего прокси — validate, затем reload. HA, его контейнер, данные и сеть
при публикации карты не перезапускаются и не перенастраиваются.
Хостом и общим прокси владеет `home_infra`, приложением — этот проект.

Отдельный Compose project `law-pipeline-spain` обслуживает статические файлы
через Nginx на 8080, наружу опубликован только `127.0.0.1:8087`.
Официальный image закреплён digest в Dockerfile. Контейнер работает как
`nginx` (UID/GID 101), без capabilities, с read-only rootfs и временными tmpfs.
Лимиты: 64 MiB памяти, 0,5 CPU, 64 PID; журналы — 3 × 5 MiB.
Базы данных и постоянных пользовательских данных на сервере нет. Карта и страницы пруфов подключают Google Analytics `G-ZBZX7NP7HV` через `analytics.js`; измерительный ID публичный, ключей доступа для него нет. Google tag загружается асинхронно. file:// и loopback preview исключены из статистики.

`law-pipeline-spain.service` запускает подготовленный Compose при загрузке
сервера, без сборки и скачивания образов. Автоматический restart после сбоя
выключен в Compose и systemd. Состояние контейнера проверяется отдельно от
oneshot unit. Сбой требует диагностики и явного действия оператора.
Автобэкапы VPS не включаются.

## Файлы и доставка

- Релизы: `/opt/law-pipeline-spain/releases/<release>/`.
- Активный релиз: `/opt/law-pipeline-spain/current` (symlink).
- Публичные файлы: `current/public/`; только они копируются в image.
- Unit: `/etc/systemd/system/law-pipeline-spain.service`.
- Домен: `/etc/caddy/sites-enabled/how-to-create-law-in-spain.caddy`.
- Архив: `law-pipeline-spain-server.zip`, с public/, Dockerfile, Compose,
  файлами deploy/ и этой инструкцией.

Из корня подпроекта:

```sh
python scripts/package_server.py
```

Упаковщик проверяет SHA-256 библиотек и оригиналов пруфов, наличие файлов
и целостность ZIP. После изменения данных/переводов сначала нужен
`python scripts/build_proofs.py`; для готовой карты повторная генерация
не нужна. Исходники, тесты и исследовательские материалы не входят в public/;
архивные оригиналы пруфов и лицензии библиотек входят.

Администрирование: key-only SSH как ops, штатный sudo с паролем.
Для установки распакуйте архив в новый каталог релиза. Перед сборкой явно
скачайте ровно закреплённый образ из FROM Dockerfile:

```sh
sudo docker pull nginx:stable-alpine@sha256:ed84151ed2d47ef93c0939eb9b9754c6990db6092cd2081e11988a47a83d47ea
cd /opt/law-pipeline-spain/releases/<release>
sudo docker compose config --quiet
sudo env COMPOSE_BAKE=false docker compose build --pull=false
sudo docker compose run --rm --no-deps site -t
```

При первой установке создайте current symlink на проверенный релиз, установите
deploy/law-pipeline-spain.service как root:root 644, выполните
`sudo systemctl daemon-reload` и
`sudo systemctl enable --now law-pipeline-spain.service`.
Сначала проверьте внутренний HTTP, затем установите доменный файл как
root:caddy 640 и примените Caddy:

```sh
curl --fail http://127.0.0.1:8087/ -o /dev/null
sudo -u caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Перед reload проверьте DNS A и отсутствие ошибочной AAAA. Не запускайте
получение сертификата до готовности DNS.

## Проверка и обслуживание

```sh
sudo systemctl status law-pipeline-spain caddy --no-pager
cd /opt/law-pipeline-spain/current
sudo docker compose ps -a
sudo docker compose logs --tail=100 site
sudo journalctl -u caddy --since today --no-pager
curl --fail -H 'Accept-Language: en-US,en;q=0.9,es;q=0.8' https://how-to-create-law-in-spain.criteriascout.xyz/browser-language.js
curl --fail -I https://ha.criteriascout.xyz/
```

Проверьте HTTPS извне с проверкой сертификата, HTTP → HTTPS, отсутствие
публичного listener 8087, карту с каждым ?lang=es|ru|en, раскрытие ветвей,
словарь, описания и пруфы. Отсутствующий файл должен возвращать 404.
Перезагрузка VPS ради публикации не требуется; проверяется enabled unit
и его зависимости. Полный reboot проверяется в отдельное окно с учётом HA.

Обновление: подготовьте и проверьте новый релиз, остановите только
law-pipeline-spain.service, замените current на выбранный релиз и запустите
unit. При неизменном домене reload Caddy не нужен. Для отката выберите
прежний релиз, пересоберите его image без pull и переключите так же;
автоматического отката нет.

Снятие сайта: удалите только его доменный файл, validate/reload Caddy, затем
`sudo systemctl disable --now law-pipeline-spain`. HA-блок остаётся на месте.
При сбое Nginx сначала прочитайте logs, исправьте пакет/конфигурацию и
пересоберите выбранный релиз; явный запуск —
`sudo systemctl restart law-pipeline-spain`. При сбое TLS сначала прочитайте
Caddy journal, исправьте DNS/доступность HTTP-01 и выполните validate/reload.

## Языки и ссылка для YouTube

Ссылка без параметров выбирает язык из Accept-Language с учётом q,
региональных вариантов и q=0; без подходящего языка используется испанский.
?lang=es, ?lang=ru или ?lang=en фиксирует язык и имеет приоритет.
В описании YouTube можно использовать основной адрес без параметров.

Caddy передаёт заголовок без подмены. Nginx ограничивает его алфавит и длину
512 символами перед вставкой в JS. /browser-language.js имеет
Cache-Control: no-store и Vary: Accept-Language. Локальное открытие index.html
использует navigator.languages. Оригиналы норм не переводятся.

Справочники: [Caddy import](https://caddyserver.com/docs/caddyfile/directives/import),
[автоматический HTTPS](https://caddyserver.com/docs/automatic-https),
[Nginx map](https://nginx.org/en/docs/http/ngx_http_map_module.html).
