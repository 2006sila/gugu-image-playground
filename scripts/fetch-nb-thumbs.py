# -*- coding: utf-8 -*-
"""下载大香蕉收纳盒预览图并压缩为本地缩略图（约 1428 张，11MB）
运行: python scripts/fetch-nb-thumbs.py
数据源 JSON 已内置在 src/lib/promptsAwesome.json 的 preview 字段（外链）。
"""
import json, os, io, sys
import urllib.request
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed

OUT_DIR = os.path.join('public', 'case-thumbs-nb')
os.makedirs(OUT_DIR, exist_ok=True)

aw = json.load(open('src/lib/promptsAwesome.json', encoding='utf-8'))
targets = [a for a in aw if (a.get('preview') or '').startswith('http')]
print(f'待下载: {len(targets)}')

def work(args):
    idx, a = args
    fname = f'nb{idx}.webp'
    out_path = os.path.join(OUT_DIR, fname)
    if os.path.exists(out_path) and os.path.getsize(out_path) > 500:
        a['preview'] = f'case-thumbs-nb/{fname}'
        return ('skip', a)
    for attempt in range(3):
        try:
            req = urllib.request.Request(a['preview'], headers={'User-Agent': 'Mozilla/5.0'})
            raw = urllib.request.urlopen(req, timeout=20).read()
            img = Image.open(io.BytesIO(raw))
            scale = min(1.0, 200 / max(img.width, img.height))
            small = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)
            small.save(out_path, 'WEBP', quality=72)
            a['preview'] = f'case-thumbs-nb/{fname}'
            return ('ok', a)
        except Exception:
            import time
            if attempt == 2: return ('fail', a)
            time.sleep(0.5)
    return ('fail', a)

ok = fail = skip = 0
with ThreadPoolExecutor(max_workers=24) as ex:
    futures = [ex.submit(work, (i, a)) for i, a in enumerate(targets)]
    for n, fut in enumerate(as_completed(futures), 1):
        st, a = fut.result()
        if st == 'ok': ok += 1
        elif st == 'fail': fail += 1
        else: skip += 1
        if n % 200 == 0: print(f'{n}/{len(targets)} ok={ok} fail={fail}', flush=True)

json.dump(aw, open('src/lib/promptsAwesome.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
print(f'完成 ok={ok} fail={fail} | %.1f MB' % (total / 1048576))
