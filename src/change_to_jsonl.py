import json

INPUT_DATASET_NAME="your_json_file_name.json"
OUTPUT_DATASET_NAME="your_jsonl_file_name.jsonl"

# Kendi dosya adını buraya yaz
with open(INPUT_DATASET_NAME, 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(OUTPUT_DATASET_NAME, 'w', encoding='utf-8') as f:
    for entry in data:
        json.dump(entry, f, ensure_ascii=False)
        f.write('\n')