# Builds scripts/data/steo-vintages.json: every archived edition of EIA's
# Short-Term Energy Outlook since 2016, trimmed to the five months the model can
# reach from that edition (the month before through three months after).
# backtest.mjs uses it to test the outlook anchor with only the forecast that
# existed on each date. One-off tool — the site and the data job never run it.
#
#   pip install openpyxl
#   python scripts/data/build-steo-vintages.py
#
# Source: https://www.eia.gov/outlooks/steo/archives/ (<mon><yy>_base.xlsx).
# Older editions use plain series ids in cents/gal; newer ones end in "_$" and
# use dollars/gal. Output is dollars/gal.

import io, json, os, urllib.request
import openpyxl

SERIES = {'MGRARUS', 'MGRARP1', 'MGRARP2', 'MGRARP3', 'MGRARP4', 'MGRARP5', 'DSRTUUS'}
MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
FIRST = (2016, 1)
OUT = os.path.join(os.path.dirname(__file__), 'steo-vintages.json')


def shift(y, m, k):
    i = y * 12 + (m - 1) + k
    return f'{i // 12}-{i % 12 + 1:02d}'


def edition(y, m):
    url = f'https://www.eia.gov/outlooks/steo/archives/{MON[m - 1]}{str(y)[2:]}_base.xlsx'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (fuelcast)'})
    try:
        raw = urllib.request.urlopen(req, timeout=60).read()
    except Exception as e:
        print('skip', url, e)
        return None
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    lo = shift(y, m, -1)
    found = {'start': lo}
    for sheet in ('2tab', '4ctab'):
        rows = list(wb[sheet].iter_rows(max_row=60, values_only=True))
        years, cur = [], None
        for c in rows[2]:                      # year header, merged across months
            cur = c if isinstance(c, int) else cur
            years.append(cur)
        months = [MON.index(str(c).strip()[:3].lower()) + 1 if str(c).strip()[:3].lower() in MON else None
                  for c in rows[3]]   # col A may hold the forecast date
        for row in rows:
            if not isinstance(row[0], str):
                continue
            sid = row[0].split('_')[0]
            if sid not in SERIES or sid in found:
                continue
            scale = 1 if row[0].endswith('_$') else 0.01
            pts = {f'{years[j]}-{months[j]:02d}': row[j] * scale for j in range(2, len(row))
                   if isinstance(row[j], (int, float)) and years[j] and months[j]}
            found[sid] = [round(pts[shift(y, m, k)], 4) for k in range(-1, 4)]
    missing = SERIES - found.keys()
    if missing:
        raise SystemExit(f'{y}-{m:02d}: missing {sorted(missing)}')
    return found


def main():
    out, (y, m) = {}, FIRST
    while True:
        e = edition(y, m)
        if e is None and out:
            break                              # reached the latest published edition
        if e:
            out[f'{y}-{m:02d}'] = e
            print(f'{y}-{m:02d}')
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    with open(OUT, 'w') as f:
        f.write('{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, separators=(",", ":"))}' for k, v in out.items()) + '\n}\n')


main()
