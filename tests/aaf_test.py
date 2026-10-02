"""Roda o gerador Python embutido no index.html sob CPython e confere o AAF gerado.

Uso: python3 tests/aaf_test.py   (precisa de node e de pyaaf2==1.7.1, a mesma versão que o
app instala no Pyodide). Nada é gravado na pasta do projeto: tudo vai para um diretório
temporário.
"""
import base64
import json
import os
import re
import struct
import subprocess
import sys
import tempfile

import aaf2

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SRT = os.path.join(AQUI, 'fixtures', 'exemplo.srt')
TEXT_TYPE_B = '3319f04a-ac69-4525-b9e8-2206362fd233'  # o texto UTF-8 que o Avid exibe

falhas = []


def confere(cond, nome):
    if not cond:
        falhas.append(nome)
        print('FALHOU', nome)


def carregar_app(tmp):
    src = open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
    # o Python mora num template literal do JS: '\\x00' no fonte é '\x00' no Python
    py = src.split('const PY_AAF_GEN = `', 1)[1].split('`;', 1)[0].replace('\\\\', '\\')
    py = py.replace("'/tmp/in.aaf'", repr(os.path.join(tmp, 'in.aaf')))
    py = py.replace("'/tmp/out.aaf'", repr(os.path.join(tmp, 'out.aaf')))
    b64 = re.search(r'id="aaf-template-b64">(.*?)</script>', src, re.S).group(1)
    tpl = base64.b64decode(re.sub(r'\s+', '', b64))
    confere(tpl == open(os.path.join(RAIZ, 'template', 'TEMPLATE AAF.aaf'), 'rb').read(),
            'template embutido == template/TEMPLATE AAF.aaf')
    open(os.path.join(tmp, 'in.aaf'), 'wb').write(tpl)
    confere('micropip.install("pyaaf2==1.7.1")' in src, 'pyaaf2 fixado em 1.7.1')
    ns = {}
    exec(py, ns)
    return ns['generate']


def texto_b(og):
    for p in og['Parameters'].value:
        v = p.get('Value')
        if v is None or v.data is None:
            continue
        full = bytes(v.data)
        if full[17:21] != b'PUVA':
            continue
        d = full[33:49]
        auid = '%08x-%04x-%04x-%s-%s' % (struct.unpack('<I', d[0:4])[0], struct.unpack('<H', d[4:6])[0],
                                         struct.unpack('<H', d[6:8])[0], d[8:10].hex(), d[10:].hex())
        if auid == TEXT_TYPE_B:
            n = struct.unpack('<I', full[53:57])[0]
            return full[57:57 + n].rstrip(b'\x00').decode('utf-8')
    return None


def main():
    with tempfile.TemporaryDirectory() as tmp:
        generate = carregar_app(tmp)
        for mode in ('single', 'dual'):
            dados = json.loads(subprocess.check_output(['node', os.path.join(AQUI, 'dump_subs.js'), SRT, mode]))
            for k, v in dados.items():
                nome = f'{k}/{mode}'
                out = generate(json.dumps(v['subs']), mode, json.dumps(v['rate']))
                caminho = os.path.join(tmp, f'{k}_{mode}.aaf')
                open(caminho, 'wb').write(out)
                with aaf2.open(caminho, 'r') as f:
                    comp = list(f.content.toplevel())[0]
                    slots = list(comp.slots)
                    taxa = '%d/%d' % (v['rate']['num'], v['rate']['den']) if v['rate']['den'] != 1 else str(v['rate']['num'])
                    confere({str(s.edit_rate) for s in slots} == {taxa}, f'{nome}: edit_rate {taxa} em todos os slots')
                    tcs = [(s.segment.fps, s.segment.drop) for s in slots if type(s.segment).__name__ == 'Timecode']
                    if k == '23976':
                        confere(len(slots) == 11, f'{nome}: estrutura do template intacta (11 slots)')
                    else:
                        confere(len(slots) == 3, f'{nome}: só TC1 + Picture + SoundMaster')
                        confere(tcs == [(v['rate']['base'], v['rate']['drop'])], f'{nome}: TC1 {tcs}')
                    pic = [s for s in slots if s.media_kind == 'Picture'][0].segment
                    seqs = list(pic.slots) if type(pic).__name__ == 'NestedScope' else [pic]
                    confere(len(seqs) == (2 if mode == 'dual' else 1), f'{nome}: número de trilhas')
                    achados = []
                    for q in seqs:
                        pos = 0
                        for c in q.components:
                            if type(c).__name__ == 'OperationGroup':
                                achados.append((pos, c.length, texto_b(c)))
                            pos += c.length
                        confere(pos == q.length, f'{nome}: soma dos clips == duração da trilha')
                    esperado = [(s['start_frame'], s['length_frames'], s['text'].replace('“', '"').replace('”', '"').replace('…', '...'))
                                for s in v['subs']]
                    confere(sorted(achados) == sorted(esperado), f'{nome}: posição, duração e texto de cada legenda')
                print(f'{nome:14} {len(slots):2} slots  {len(achados)} legendas  cortes={v["trimmed"]}')
    print(f'{len(falhas)} FALHA(S)' if falhas else 'aaf_test.py: todos os testes passaram')
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
