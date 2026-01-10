#!/usr/bin/env python3
import json
from collections import defaultdict
import os

os.chdir('/Users/julian/Code/nfl-news-tooling')

with open('ai-newspaper-tabloid_03_extracted.json/ai-newspaper-tabloid_03_extracted_structured.json') as f:
    data = json.load(f)

page_x_ranges = defaultdict(lambda: {'min': float('inf'), 'max': float('-inf')})

for article in data.get('articles', []):
    for frame in article.get('frames', []):
        page = int(frame['page'])
        if 'bounds' in frame:
            y1, x1, y2, x2 = frame['bounds']
            page_x_ranges[page]['min'] = min(page_x_ranges[page]['min'], x1, x2)
            page_x_ranges[page]['max'] = max(page_x_ranges[page]['max'], x1, x2)
    for comp in article.get('components', []):
        page = int(comp['page'])
        if 'bounds' in comp:
            y1, x1, y2, x2 = comp['bounds']
            page_x_ranges[page]['min'] = min(page_x_ranges[page]['min'], x1, x2)
            page_x_ranges[page]['max'] = max(page_x_ranges[page]['max'], x1, x2)

print('X coordinate ranges by page (page width ~819):')
for page in sorted(page_x_ranges.keys()):
    r = page_x_ranges[page]
    is_left = r['max'] <= 0
    is_right = r['min'] >= 0
    note = ' (LEFT page - negative x)' if is_left else (' (RIGHT page - positive x)' if is_right else ' (MIXED)')
    print(f'  Page {page:2d}: x from {r["min"]:8.1f} to {r["max"]:8.1f}{note}')
