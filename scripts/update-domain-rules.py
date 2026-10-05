#!/usr/bin/env python3
"""Mirror maintained domestic/global rule sets with strict, fail-closed checks."""
import argparse
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/'
SOURCES = {'China': (BASE + 'China/China.list', 3000), 'Global': (BASE + 'Global/Global.list', 30000)}
FILES = ('whitelist-default.conf', 'whitelist-saving.conf', 'blacklist-default.conf', 'blacklist-saving.conf')
MIRROR = 'https://raw.githubusercontent.com/readguide/shadowrocket-rule-config/main/rules/'

def validate(name, text, minimum):
    lines = text.splitlines()
    rules = [line for line in lines if line and not line.startswith('#')]
    if len(rules) < minimum or len(text) > 5_000_000:
        raise ValueError(f'{name}: suspicious rule count/size: {len(rules)}')
    allowed = re.compile(r'^(HOST|HOST-SUFFIX|HOST-KEYWORD|HOST-WILDCARD|IP-CIDR|IP-CIDR6|USER-AGENT|PROCESS-NAME|DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP6-CIDR|GEOIP),')
    if any(not allowed.match(line) for line in rules):
        bad = next(line for line in rules if not allowed.match(line))
        raise ValueError(f'{name}: unexpected rule syntax: {bad[:80]}')
    return len(rules)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='validate local mirrors and references without network')
    args = parser.parse_args()
    for name, (url, minimum) in SOURCES.items():
        dest = ROOT / 'rules' / (name.lower() + '.list')
        text = dest.read_text() if args.check else urllib.request.urlopen(url, timeout=40).read().decode('utf-8-sig')
        count = validate(name, text, minimum)
        if not args.check:
            dest.parent.mkdir(exist_ok=True)
            dest.write_text(text if text.endswith('\n') else text+'\n')
        print(f'{name}: {count} rules')
    for filename in FILES:
        body = (ROOT / filename).read_text()
        for name in SOURCES:
            expected = f'RULE-SET,{MIRROR}{name.lower()}.list,{"DIRECT" if name == "China" else "PROXY"}'
            if body.count(expected) != 1:
                raise ValueError(f'{filename}: missing or duplicate {name} mirror reference')
        fallbacks = [line for line in body.splitlines() if line.startswith('FINAL,')]
        if fallbacks != [('FINAL,DIRECT' if filename.startswith('blacklist') else 'FINAL,PROXY')]:
            raise ValueError(f'{filename}: fallback policy changed')
    print('Four configs keep their original FINAL policies and mirror references')

if __name__ == '__main__':
    main()
