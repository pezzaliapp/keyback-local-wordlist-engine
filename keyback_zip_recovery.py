#!/usr/bin/env python3
"""KeyBack Local ZIP Recovery - uso solo su archivi propri/autorizzati."""
import sys, zipfile, time, os
from pathlib import Path

def usage():
    print("Uso: python3 keyback_zip_recovery.py archivio.zip wordlist.txt")
    sys.exit(1)

def main():
    if len(sys.argv) != 3: usage()
    zip_path = Path(sys.argv[1]).expanduser()
    wordlist = Path(sys.argv[2]).expanduser()
    if not zip_path.exists(): print(f"ERRORE: ZIP non trovato: {zip_path}"); sys.exit(1)
    if not wordlist.exists(): print(f"ERRORE: wordlist non trovata: {wordlist}"); sys.exit(1)
    if not zipfile.is_zipfile(zip_path): print("ERRORE: file ZIP non valido"); sys.exit(1)

    print("="*60)
    print("KeyBack Local ZIP Recovery")
    print("Uso previsto: solo archivi propri/autorizzati")
    print("="*60)
    print(f"ZIP: {zip_path}")
    print(f"Wordlist: {wordlist}")

    with zipfile.ZipFile(zip_path, 'r') as zf:
        infos = [i for i in zf.infolist() if not i.is_dir()]
        if not infos: print("ZIP vuoto"); return
        test = infos[0]
        print(f"File test: {test.filename}")
        try:
            zf.read(test)
            print("ZIP non protetto: apertura riuscita senza password.")
            return
        except RuntimeError:
            print("ZIP protetto: inizio verifica wordlist...")
        except Exception as e:
            print(f"Errore lettura iniziale: {e}")

        started = time.time(); attempts = 0; found = None
        with open(wordlist, 'r', encoding='utf-8', errors='ignore') as fh:
            for line in fh:
                pwd = line.rstrip('\n\r')
                if not pwd: continue
                attempts += 1
                try:
                    zf.read(test, pwd=pwd.encode('utf-8'))
                    found = pwd
                    break
                except RuntimeError:
                    pass
                except zipfile.BadZipFile:
                    print("ERRORE: ZIP danneggiato o formato non supportato."); sys.exit(1)
                if attempts % 10000 == 0:
                    elapsed = max(time.time()-started, .001)
                    print(f"Tentativi: {attempts:,} | Velocità: {attempts/elapsed:,.0f}/s".replace(',', '.'))
        elapsed = max(time.time()-started, .001)
        report = []
        report.append("KeyBack Local - Report verifica ZIP")
        report.append(f"ZIP: {zip_path}")
        report.append(f"Wordlist: {wordlist}")
        report.append(f"Tentativi: {attempts}")
        report.append(f"Tempo: {elapsed:.2f} sec")
        report.append(f"Velocità media: {attempts/elapsed:.0f}/s")
        if found is not None:
            print("\n✅ PASSWORD TROVATA")
            print(f"Password: {found}")
            report.append("Risultato: PASSWORD TROVATA")
            report.append(f"Password: {found}")
        else:
            print("\n❌ Password non trovata nella wordlist.")
            report.append("Risultato: NON TROVATA")
        Path('report_keyback.txt').write_text('\n'.join(report)+'\n', encoding='utf-8')
        print("Report salvato: report_keyback.txt")

if __name__ == '__main__': main()
