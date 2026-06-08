#!/usr/bin/env python3
"""
KeyBack ZIP Recovery - uso previsto: solo archivi propri o autorizzati.
Prova una wordlist su un file ZIP cifrato e genera report_keyback.txt.
Supporta ZIP standard gestiti dalla libreria zipfile di Python.
"""
import sys, zipfile, time, os
from pathlib import Path


def clean_path(p: str) -> str:
    return p.strip().strip('"').strip("'")


def load_wordlist(path: Path):
    seen = set()
    with path.open('r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            pwd = line.strip('\r\n')
            if not pwd or pwd in seen:
                continue
            seen.add(pwd)
            yield pwd


def pick_test_file(zf: zipfile.ZipFile):
    infos = [i for i in zf.infolist() if not i.is_dir()]
    if not infos:
        raise RuntimeError('ZIP vuoto o senza file testabili')
    # Preferisce file piccoli: verifica più veloce
    infos.sort(key=lambda x: x.file_size)
    return infos[0]


def main():
    if len(sys.argv) < 3:
        print('Uso: python3 keyback_zip_recovery.py archivio.zip wordlist.txt')
        print('Esempio: python3 keyback_zip_recovery.py ~/Desktop/TestProtetto.zip ~/Downloads/keyback-wordlist.txt')
        sys.exit(1)

    zip_path = Path(os.path.expanduser(clean_path(sys.argv[1]))).resolve()
    wordlist_path = Path(os.path.expanduser(clean_path(sys.argv[2]))).resolve()
    report_path = Path.cwd() / 'report_keyback.txt'

    if not zip_path.exists():
        print(f'ERRORE: ZIP non trovato: {zip_path}')
        sys.exit(1)
    if not wordlist_path.exists():
        print(f'ERRORE: wordlist non trovata: {wordlist_path}')
        sys.exit(1)
    if not zipfile.is_zipfile(zip_path):
        print('ERRORE: il file indicato non è uno ZIP valido.')
        sys.exit(1)

    start = time.time()
    tried = 0
    found = None
    last_speed_time = start

    with zipfile.ZipFile(zip_path, 'r') as zf:
        test_info = pick_test_file(zf)
        print('=' * 60)
        print('KeyBack ZIP Recovery')
        print('=' * 60)
        print(f'ZIP:      {zip_path}')
        print(f'Wordlist: {wordlist_path}')
        print(f'Test su:  {test_info.filename}')
        print('Avvio verifica...')

        # Prova senza password
        try:
            zf.read(test_info)
            found = ''
            print('\nZIP aperto senza password.')
        except RuntimeError:
            pass

        if found is None:
            for pwd in load_wordlist(wordlist_path):
                tried += 1
                try:
                    zf.read(test_info, pwd=pwd.encode('utf-8'))
                    found = pwd
                    break
                except RuntimeError:
                    pass
                except Exception:
                    pass

                now = time.time()
                if tried % 5000 == 0 or now - last_speed_time > 5:
                    elapsed = max(now - start, 0.001)
                    speed = tried / elapsed
                    print(f'Tentativi: {tried:,} | Velocità: {speed:,.0f}/sec'.replace(',', '.'))
                    last_speed_time = now

    elapsed = time.time() - start
    lines = [
        'KeyBack ZIP Recovery Report',
        '=' * 40,
        f'ZIP: {zip_path}',
        f'Wordlist: {wordlist_path}',
        f'Tentativi: {tried}',
        f'Tempo: {elapsed:.2f} sec',
    ]
    if found is not None:
        if found == '':
            lines.append('RISULTATO: ZIP senza password')
        else:
            lines.append('RISULTATO: PASSWORD TROVATA')
            lines.append(f'Password: {found}')
        print('\n✅ PASSWORD TROVATA' if found else '\n✅ ZIP SENZA PASSWORD')
        if found:
            print(f'Password: {found}')
    else:
        lines.append('RISULTATO: password non trovata nella wordlist')
        print('\n❌ Password non trovata nella wordlist.')

    report_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Report creato: {report_path}')


if __name__ == '__main__':
    main()
