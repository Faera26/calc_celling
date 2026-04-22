import json

with open(r'C:\Users\ILYA\.gemini\antigravity\brain\b8a966b9-4f8f-4ae4-94d4-90f366e850fb\.system_generated\steps\145\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

for p in data['projects']:
    print(f"Name: {p['name']}, Title: {p['title']}, Type: {p.get('projectType', 'N/A')}")
