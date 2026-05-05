import requests
import re
import urllib.parse


class AniStarParser:
    def __init__(self):
        self.host = "https://v24.astar.bz"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "Cookie": "3d3b81c3810f50abfa556d8a468c805b=1"
        }

    def search(self, query):
        encoded_query = urllib.parse.quote(query.encode('cp1251'))
        url = f"{self.host}/index.php?do=search&subaction=search&search_start=1&full_search=0&result_from=1&story={encoded_query}"

        response = requests.get(url, headers=self.headers)
        response.encoding = 'cp1251'
        html = response.text

        results = []
        if 'dle-content' not in html: return []

        content = html.split('dle-content')[1]
        # Блоки новостей начинаются с news_header
        items = content.split('news_header')

        for item in items[1:]:
            try:
                # В DLE заголовок обычно в <h2> или первом <a> после news_header
                link_match = re.search(r'href="(https://v24.astar.bz/.*?.html)"', item)
                if not link_match: continue
                link = link_match.group(1)

                # Извлекаем чистое название из тега <a>
                title_match = re.search(r'href=".*?".*?>(.*?)</a>', item)
                title = title_match.group(1) if title_match else "Без названия"
                # Чистим от HTML тегов и лишнего
                title = re.sub(r'<.*?>', '', title).strip()

                results.append({"title": title, "link": link})
            except Exception:
                continue
        return results

    def get_video_links(self, anime_url):
        response = requests.get(anime_url, headers=self.headers)
        response.encoding = 'cp1251'
        html = response.text

        # 1. Проверяем, нет ли плейлиста прямо на странице
        videos = self._parse_playlist(html)
        if videos: return videos

        # 2. Если нет, ищем ссылку на внутренний плеер (логика episodes_from_page из JSON)
        # Ищем что-то вроде src="/test/player2/videoas.php?id=..."
        player_match = re.search(r'src="(/test/player2/.*?)"', html)
        if player_match:
            player_url = self.host + player_match.group(1)
            player_html = requests.get(player_url, headers=self.headers).text
            return self._parse_playlist(player_html)

        return []

    def _parse_playlist(self, html):
        playlist_match = re.search(r'var playlst\s*=\s*(\[.*?\]);', html, re.DOTALL)
        if not playlist_match: return []

        playlist_raw = playlist_match.group(1)
        # На AniStar HD ссылки часто в поле file_h
        links_720 = re.findall(r'file_h:"(.*?)"', playlist_raw)
        titles = re.findall(r'title:"(.*?)"', playlist_raw)

        extracted = []
        for i in range(len(titles)):
            title = titles[i]
            link = links_720[i] if i < len(links_720) else ""
            if not link: continue

            # 1. Базовое декодирование
            url = link.replace('%2F', '/').replace('%3A', ':').replace('%3D', '=').replace('%2C', ',')

            # 2. ПРИМЕНЯЕМ ПРАВИЛА ИЗ JSON ДЛЯ ОБХОДА "Wrong key"
            # Заменяем сервер sfv на sf2
            url = url.replace("sfv.an-media", "sf2.an-media")

            # Удаляем ключ из пути (регулярка из JSON)
            # Ищем ID видео (длинный хеш перед /720.mp4)
            video_id_match = re.search(r'/([^/]+)/720\.mp4', url)
            if video_id_match:
                video_id = video_id_match.group(1)
                # Формируем чистую ссылку без /key=...
                url = f"https://sf2.an-media.org/video/{video_id}/720.mp4"

            # 3. Добавляем суффикс для HLS (если нужно)
            # В JSON есть правило: "sufix": "/index.m3u8"
            if not url.endswith("/index.m3u8"):
                url += "/index.m3u8"

            extracted.append({"episode": title, "url": url})
        return extracted


if __name__ == "__main__":
    parser = AniStarParser()
    query = "Игра лжецов"
    print(f"Поиск '{query}'...")
    results = parser.search(query)

    if results:
        for i, res in enumerate(results[:3]):
            print(f"{i + 1}. {res['title']} -> {res['link']}")

        print(f"\nАнализируем: {results[0]['title']}")
        videos = parser.get_video_links(results[0]['link'])
        for v in videos:
            print(f"{v['episode']}: {v['url']}")
    else:
        print("Ничего не найдено.")
