"""Build the gallery, the audit report and SKIPPED.md, and embed demos in the map.

    python harness/report.py [PROJECT] [--watch]

The project is PROJECT, else $JOURNEYS_HOME, else the folder above harness/.
Reads journeys.html (<section id="jN" class="journey"><h2>N. Title</h2> plus an
audience chip), recordings/, audit/ and QA.md. Writes index.html,
audit-report.html, SKIPPED.md (keeping each journey's written reason), and a
<!-- DEMO-JN --> figure under each heading in journeys.html. Recordings marked
"needs fix" in QA.md stay out of the gallery. --watch rebuilds every 60 s.
"""
import html, json, os, re, sys, time

STYLE = '''
:root{--bg:#f7f7fa;--fg:#1d1b26;--mut:#6d6a7a;--card:#fff;--line:#e6e4ee;--link:#4f46e5}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121118;--fg:#ecebf2;--mut:#a3a0b2;--card:#1b1a23;--line:#2c2a36;--link:#a5b4fc}}
body{margin:0;padding:32px 16px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto}
h1{margin:0 0 4px;font-size:26px}.lede{color:var(--mut);margin:0 0 20px}a{color:var(--link)}small{color:var(--mut)}
.chip{display:inline-block;font-size:11.5px;padding:1px 9px;border-radius:99px;margin:0 6px 6px 0;font-weight:600}
.role-admin{background:#fbe9e6;color:#a3301b}.role-mixed{background:#fff3d6;color:#8a5a00}.role-all{background:#e7f3ee;color:#1f5e48}.role-ext{background:#e8eefc;color:#2a4b9b}
.none{aspect-ratio:1100/744;display:grid;place-items:center;color:var(--mut);background:repeating-linear-gradient(45deg,transparent 0 10px,rgb(127 127 127 / .06) 10px 20px)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:16px}
article{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}article img{display:block;width:100%;aspect-ratio:1100/744}
.cap{padding:10px 14px 12px}.cap b{display:block;font-size:14px;margin-bottom:6px}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line)}
td{border-top:1px solid var(--line);padding:8px 10px;vertical-align:top}td.t img,td.t .none{width:220px;aspect-ratio:1100/744;border-radius:8px;display:block}
.v{font-weight:700;padding:2px 9px;border-radius:99px;font-size:12px;white-space:nowrap;background:#eee;color:#555}.ok{background:#e1f4ea;color:#1c6b43}.notes{background:#ece9fb;color:#483cac}.fail{background:#fbe2df;color:#a3301b}
'''

VERDICT_CLASS = {'pass': 'ok', 'pass with notes': 'notes', 'fail': 'fail', 'unreadable': 'fail'}


def write(path, text):
    try:
        if open(path, encoding='utf-8').read() == text:
            return
    except FileNotFoundError:
        pass
    open(path + '.tmp', 'w', encoding='utf-8').write(text)
    os.replace(path + '.tmp', path)


def page(title, body):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>{STYLE}</style></head><body><main>{body}</main></body></html>'


def build(p):
    doc = open(os.path.join(p, 'journeys.html'), encoding='utf-8').read()
    m = re.search(r'<title>([^<]*)</title>', doc)
    name = html.escape(html.unescape(m.group(1)).strip() if m else 'Product')
    titles = {int(n): html.escape(html.unescape(t)) for n, t in re.findall(r'<h2>(\d+)\. ([^<]*)</h2>', doc)}
    roles = {}
    for n, body in re.findall(r'<section id="j(\d+)" class="journey">(.*?)</section>', doc, re.S):
        r = re.search(r'<span class="chip role (role-[\w-]+)">([^<]*)</span>', body)
        roles[int(n)] = r.groups() if r else ('role-all', 'Everyone')
    folder = os.path.join(p, 'recordings')
    real = {int(m.group(1)): f for f in sorted(os.listdir(folder)) if (m := re.match(r'j(\d+)-.*\.webp$', f))} if os.path.isdir(folder) else {}
    audits = {}
    for f in os.listdir(os.path.join(p, 'audit')) if os.path.isdir(os.path.join(p, 'audit')) else []:
        if m := re.match(r'j(\d+)\.json$', f):
            try:
                audits[int(m.group(1))] = json.load(open(os.path.join(p, 'audit', f), encoding='utf-8'))
            except Exception as e:
                audits[int(m.group(1))] = {'verdict': 'unreadable', 'notes': str(e)}
    shown = dict(real)
    if os.path.exists(os.path.join(p, 'QA.md')):
        for n in re.findall(r'^\| j(\d+) \| needs fix', open(os.path.join(p, 'QA.md'), encoding='utf-8').read(), re.M):
            shown.pop(int(n), None)
    chip = lambda n: '<span class="chip {}">{}</span>'.format(*roles.get(n, ('role-all', 'Everyone')))
    img = lambda n, alt='': f'<img loading="lazy" src="recordings/{real[n]}" alt="{alt}">'

    cards = ''.join(f'<article id="j{n}">{img(n, f"Demo of journey {n}: {titles[n]}") if n in shown else "<div class=none>Not recorded yet</div>"}'
                    f'<div class="cap"><b>{n}. {titles[n]}</b><div>{chip(n)}</div><small><a href="journeys.html#j{n}">steps</a></small></div></article>' for n in sorted(titles))
    write(os.path.join(p, 'index.html'), page(f'{name} demos', f'<h1>{name} journey demos</h1><p class="lede">{len(titles)} journeys, '
          f'{sum(n in shown for n in titles)} recorded on the real UI with demo data.</p><div class="grid">{cards}</div>'))

    verdict = lambda n: str((audits.get(n) or {}).get('verdict', 'not audited')).strip().lower() if n in real else 'not recorded'
    counts = {}
    for n in titles:
        counts[verdict(n)] = counts.get(verdict(n), 0) + 1
    rows = []
    for n in sorted(titles):
        a, v = audits.get(n) or {}, verdict(n)
        bad = [k for k, x in (a.get('checks') or {}).items() if isinstance(x, str) and re.match(r'\s*(fail|no\b)', x, re.I)]
        fixed = html.escape(str(a.get('fixed') or ''))
        rows.append(f'<tr id="j{n}"><td class="t">{img(n) if n in real else "<div class=none>not recorded</div>"}</td>'
                    f'<td><b>{n}. {titles[n]}</b><br>{chip(n)} <a href="journeys.html#j{n}">steps</a></td>'
                    f'<td><span class="v {VERDICT_CLASS.get(v, "")}">{v}</span>'
                    f'{"<br><small>failed checks: " + ", ".join(bad) + "</small>" if bad else ""}</td>'
                    f'<td><small>{html.escape(str(a.get("notes") or ""))[:400]}{"<br><b>Fixed:</b> " + fixed if fixed else ""}</small></td></tr>')
    summary = ' · '.join(f'{k}: {v}' for k, v in sorted(counts.items(), key=lambda kv: -kv[1]))
    write(os.path.join(p, 'audit-report.html'), page(f'{name} demo audit', f'<h1>{name} demo audit</h1><p class="lede">Independent audit: privacy, '
          f'clean UI, overlay, start, pace, accuracy and calls. {summary}.</p><p class="lede"><a href="index.html">Gallery</a> · '
          f'<a href="journeys.html">Journey map</a></p><div class="wrap"><table>{"".join(rows)}</table></div>'))

    missing, reasons, skipped = sorted(set(titles) - set(real)), {}, os.path.join(p, 'SKIPPED.md')
    if os.path.exists(skipped):
        for line in open(skipped, encoding='utf-8'):
            if (m := re.match(r'- \*\*j0*(\d+) [^*]*\*\*: (.*)', line.strip())) and int(m.group(1)) in missing:
                reasons[int(m.group(1))] = m.group(2)
    lines = [f'- **j{n:02d} {html.unescape(titles[n])}**: {reasons.get(n, "reason not recorded yet")}' for n in missing] or ['None.']
    write(skipped, '\n'.join(['# Journeys without a recording', '', 'Rebuilt by report.py from `recordings/`.', '', *lines]) + '\n')

    def embed(m):
        n = int(m.group(1))
        return m.group(0) + (f'<!-- DEMO-J{n} --><figure class="demo"><img loading="lazy" src="recordings/{shown[n]}" alt="Demo of journey {n}">'
                             f'<figcaption>Recorded on the real UI with demo data</figcaption></figure><!-- /DEMO-J{n} -->' if n in shown else '')
    doc2 = re.sub(r'<section id="j(\d+)" class="journey"><h2>[^<]*</h2>', embed, re.sub(r'<!-- DEMO-J\d+ -->.*?<!-- /DEMO-J\d+ -->', '', doc, flags=re.S))
    if '.demo{' not in doc2:
        doc2 = doc2.replace('</style>', '.demo{margin:.6rem 0 1rem}.demo img{width:100%;max-width:880px;border-radius:12px}.demo figcaption{font-size:.8rem;opacity:.7}</style>', 1)
    write(os.path.join(p, 'journeys.html'), doc2)
    return f'{summary} | not recorded: {missing}'


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    project = os.path.abspath(args[0] if args else os.environ.get('JOURNEYS_HOME') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    while True:
        print(build(project), flush=True)
        if '--watch' not in sys.argv:
            break
        time.sleep(60)
