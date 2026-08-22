#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
for file in "$root"/js/*.js; do node --check "$file" >/dev/null; done
python3 - "$root/index.html" <<'PY'
import sys
from collections import Counter
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]
    def handle_starttag(self, tag, attrs): self.ids += [v for k,v in attrs if k == 'id']
p=P(); p.feed(open(sys.argv[1], encoding='utf-8').read())
duplicates=[key for key,value in Counter(p.ids).items() if value > 1]
assert not duplicates, f'duplicate ids: {duplicates}'
print('architecture audit: PASS')
PY
git -C "$root" diff --check
