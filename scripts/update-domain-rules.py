#!/usr/bin/env python3
"""Mirror maintained China rules and Johnshall's generated proxy domains."""
import argparse
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CHINA_URL = 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/China/China.list'
FOREVER_URL = 'https://raw.githubusercontent.com/johnshall/Shadowrocket-ADBlock-Rules-Forever/build/factory/resultant/gfw.list'
FILES = ('whitelist-default.conf', 'whitelist-saving.conf', 'blacklist-default.conf', 'blacklist-saving.conf')
MIRROR = 'https://raw.githubusercontent.com/readguide/shadowrocket-rule-config/main/rules/'
RULE = re.compile(r'^(HOST|HOST-SUFFIX|HOST-KEYWORD|HOST-WILDCARD|IP-CIDR|IP-CIDR6|USER-AGENT|PROCESS-NAME|DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP6-CIDR|GEOIP),')
DOMAIN = re.compile(r'^(?=.{3,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z0-9-]{2,63}$')


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read(5_000_001)
    if len(data) > 5_000_000:
        raise ValueError('upstream size exceeded limit')
    return data.decode('utf-8-sig')


def china(text):
    rules = [s.strip() for s in text.splitlines() if s.strip() and not s.startswith('#')]
    if len(rules) < 3000 or any(not RULE.match(s) for s in rules):
        raise ValueError('China: suspicious rule count or syntax')
    return '\n'.join(rules) + '\n'


def global_proxy(text):
    domains = [s.strip() for s in text.splitlines() if s.strip() and not s.startswith('#')]
    if len(domains) < 30000 or len(domains) > 150000 or any(not DOMAIN.fullmatch(s) or '..' in s for s in domains):
        raise ValueError('Johnshall GFW: suspicious domain count or syntax')
    if len(set(domains)) < 30000:
        raise ValueError('Johnshall GFW: too many duplicate domains')
    return '# Source: Johnshall/Shadowrocket-ADBlock-Rules-Forever, CC BY-SA 4.0\n' + '\n'.join('DOMAIN-SUFFIX,'+s for s in sorted(set(domains))) + '\n'


def check_references():
    for filename in FILES:
        body = (ROOT / filename).read_text()
        for name in ('china', 'global'):
            expected = f'RULE-SET,{MIRROR}{name}.list,{"DIRECT" if name == "china" else "PROXY"}'
            if body.splitlines().count(expected) != 1:
                raise ValueError(f'{filename}: missing or duplicate {name} mirror reference')
        fallbacks = [line for line in body.splitlines() if line.startswith('FINAL,')]
        if fallbacks != [('FINAL,DIRECT' if filename.startswith('blacklist') else 'FINAL,PROXY')]:
            raise ValueError(f'{filename}: fallback policy changed')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='validate local mirrors and references without network')
    args = parser.parse_args()
    check_references()
    if args.check:
        local_china = (ROOT / 'rules/china.list').read_text()
        local_global = (ROOT / 'rules/global.list').read_text()
        if china(local_china) != local_china:
            raise ValueError('China mirror changed')
        lines = local_global.splitlines()
        if not lines or lines[0] != '# Source: Johnshall/Shadowrocket-ADBlock-Rules-Forever, CC BY-SA 4.0':
            raise ValueError('Global mirror attribution missing')
        domains = [line.removeprefix('DOMAIN-SUFFIX,') for line in lines[1:]]
        if any(not line.startswith('DOMAIN-SUFFIX,') for line in lines[1:]) or global_proxy('\n'.join(domains)) != local_global:
            raise ValueError('Global mirror changed or invalid')
    else:
        prepared = {'china': china(fetch(CHINA_URL)), 'global': global_proxy(fetch(FOREVER_URL))}
        for name, text in prepared.items():
            (ROOT / 'rules' / (name+'.list')).write_text(text)
    print('China and Johnshall GFW mirrors valid; four FINAL policies preserved')


if __name__ == '__main__':
    main()
