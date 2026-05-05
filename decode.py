import bson
import json
import os

INPUT_DIR = "repos"


def convert_bson_to_json(input_file, output_file):
    try:
        with open(input_file, 'rb') as f:
            data = f.read()

        decoded_data = bson.decode(data)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(decoded_data, f, ensure_ascii=False, indent=4)

        print(f"[✓] {os.path.basename(input_file)} -> {os.path.basename(output_file)}")

    except Exception as e:
        print(f"[!] Ошибка ({os.path.basename(input_file)}): {e}")


def main():
    if not os.path.exists(INPUT_DIR):
        print("[!] Папка repos не найдена")
        return

    files = os.listdir(INPUT_DIR)

    b_files = [f for f in files if f.endswith(".b")]

    print(f"[*] Найдено .b файлов: {len(b_files)}")

    for filename in b_files:
        input_path = os.path.join(INPUT_DIR, filename)
        output_path = os.path.join(INPUT_DIR, filename.replace(".b", ".json"))

        convert_bson_to_json(input_path, output_path)


if __name__ == "__main__":
    main()