import requests
import os
import urllib3
import json
import re

# отключаем предупреждения SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

API_URL = "https://api.anilabx.xyz/v3/repository/list?app=AniLabX&r=search&l=ru&did=DEVICE_ID&lxv=598"
SAVE_DIR = "repos"

os.makedirs(SAVE_DIR, exist_ok=True)


def fix_json(text):
    # убираем лишние запятые перед ] и }
    text = re.sub(r",\s*]", "]", text)
    text = re.sub(r",\s*}", "}", text)
    return text


def extract_items(data):
    result = []

    if isinstance(data, dict):
        result.append(data)
        for v in data.values():
            result.extend(extract_items(v))

    elif isinstance(data, list):
        for i in data:
            result.extend(extract_items(i))

    return result


def download_file(url, filename):
    filepath = os.path.join(SAVE_DIR, filename)

    try:
        print(f"[+] Скачиваю: {filename}")
        response = requests.get(url, stream=True, timeout=15, verify=False)
        response.raise_for_status()

        with open(filepath, "wb") as f:
            for chunk in response.iter_content(8192):
                if chunk:
                    f.write(chunk)

        size = os.path.getsize(filepath)

        if size < 500:
            os.remove(filepath)
            print(f"[!] Удалён (<500 байт): {filename}")
        else:
            print(f"[✓] Готово: {filename} ({size} байт)")

    except Exception as e:
        print(f"[!] Ошибка при скачивании {filename}: {e}")
        if os.path.exists(filepath):
            os.remove(filepath)


def main():
    try:
        print("[*] Получаю JSON...")
        response = requests.get(API_URL, timeout=15, verify=False)
        response.raise_for_status()

        raw_text = response.text
        fixed_text = fix_json(raw_text)

        data = json.loads(fixed_text)

        items = extract_items(data)

        print(f"[*] Всего элементов после распаковки: {len(items)}")

        for item in items:
            if not isinstance(item, dict):
                continue

            link = item.get("link")
            filename = item.get("filename")

            if link and filename:
                download_file(link, filename)

    except Exception as e:
        print(f"[!] Ошибка: {e}")


if __name__ == "__main__":
    main()