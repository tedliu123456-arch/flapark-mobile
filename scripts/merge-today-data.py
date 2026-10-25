#!/usr/bin/env python3
"""併發同步時，決定 today-data.json 要保留本地還是遠端版本。

用法：python3 scripts/merge-today-data.py <remote-file>
遠端與本地皆為 today-data.json 結構，以 updatedAt 欄位比較新舊。
"""
import json
import os
import shutil
import sys


def stamp(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f).get('updatedAt', '') or ''
    except Exception:
        return ''


def main():
    remote = sys.argv[1] if len(sys.argv) > 1 else '/tmp/remote-today.json'
    local_file = 'today-data.json'
    local, rem = stamp(local_file), stamp(remote)

    if rem and rem > local:
        shutil.copyfile(remote, local_file)
        print(f'keep remote (newer): {rem}')
    else:
        print(f'keep local: {local or "(empty)"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
