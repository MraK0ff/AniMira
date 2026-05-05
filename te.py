video_url = "https://sf2.an-media.org/video/f9aeb7478c66886dd59d5bac40458507/720.mp4/index.m3u8"
headers = {
    "Referer": "https://v24.astar.bz",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
}
import requests
response = requests.get(video_url, headers=headers)
print(response.status_code) # Должно быть 200
