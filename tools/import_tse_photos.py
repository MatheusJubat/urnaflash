"""Importa fotografias oficiais extraídas dos arquivos de fotos 2026 do TSE.

Uso: python tools/import_tse_photos.py /caminho/foto_cand2026_BR.zip
Ou: python tools/import_tse_photos.py /pasta/fotos_extraidas

Somente nomes de arquivos contendo um SQ_CANDIDATO (8 a 18 dígitos) são aceitos.
Nunca tenta associar fotos por nome de urna ou número de partido.
"""
import json,re,sys,zipfile,io
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'public'
DEST=ROOT/'candidate-photos'
MANIFEST=ROOT/'candidate-photos.json'
PAT=re.compile(r'(?<!\d)(\d{8,18})(?!\d)')
ALLOWED={'.jpg','.jpeg','.png','.webp'}
LIMIT=20_000
MAX_BYTES=250_000


def read_entries(path):
    if path.is_dir():
        for file in path.rglob('*'):
            if file.is_file() and file.suffix.lower() in ALLOWED and file.stat().st_size<=MAX_BYTES:
                yield file.name,file.read_bytes()
    elif path.suffix.lower()=='.zip':
        with zipfile.ZipFile(path) as z:
            for item in z.infolist():
                name=Path(item.filename).name
                if name and Path(name).suffix.lower() in ALLOWED and item.file_size<=MAX_BYTES:
                    yield name,z.read(item)
    else:raise ValueError('Informe uma pasta de fotos ou um arquivo ZIP oficial do TSE')


def run(path):
    DEST.mkdir(parents=True,exist_ok=True)
    try: manifest=json.loads(MANIFEST.read_text())
    except (OSError,ValueError):manifest={}
    saved=0;skipped=0
    for name,data in read_entries(path):
        found=PAT.search(Path(name).stem)
        if not found or len(data)>MAX_BYTES or len(data)<100 or not (data.startswith(b'\xff\xd8\xff') or data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'RIFF') and data[8:12]==b'WEBP'):
            skipped+=1;continue
        ident=found.group(1)
        ext=Path(name).suffix.lower(); ext='.jpg' if ext=='.jpeg' else ext
        target=f'{ident}{ext}'
        (DEST/target).write_bytes(data)
        manifest[ident]=f'/candidate-photos/{target}'
        saved+=1
        if saved>=LIMIT:break
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Fotos importadas: {saved}; ignoradas: {skipped}; índice: {MANIFEST}')

if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Uso: python tools/import_tse_photos.py arquivo.zip|pasta')
    run(Path(sys.argv[1]))
