// Testes da matemática de tempo: node tests/tc.test.js
const H = require('./harness.js');
const fs = require('fs');
const path = require('path');

let falhas = 0;
const eq = (obtido, esperado, nome) => {
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) {
    falhas++; console.log('FALHOU', nome, '\n  obtido  ', obtido, '\n  esperado', esperado);
  }
};
const KEYS = Object.keys(H.FPS_DEFS);

// A ordem na tela vem do HTML, não de FPS_DEFS: chaves que parecem inteiro ('24',
// '23976') saem em ordem numérica em Object.keys, então não dá para iterar a tabela.
const radios = [...H.APP_SRC.matchAll(/name="fps" value="([^"]+)"/g)].map(m => m[1]);
eq(radios, ['23976', '24', '2997df'], 'ordem dos botões de fps');
eq([...KEYS].sort(), [...radios].sort(), 'todo botão tem taxa em FPS_DEFS');

// framesToTC e tcPartsToFrames são inversos em todas as taxas
for (const k of KEYS) {
  for (let f = 0; f < 300000; f += 7) {
    const tc = H.framesToTC(f, k);
    const [h, m, s, ff] = tc.split(/[:;]/).map(Number);
    if (H.tcPartsToFrames(h, m, s, ff, k) !== f) { eq(tc, '(ida e volta)', `roundtrip ${k} frame ${f}`); break; }
  }
}

// Valores conhecidos de drop frame
eq(H.framesToTC(1800, '2997df'), '00:01:00;02', 'DF: 1 min pula ;00 e ;01');
eq(H.framesToTC(17982, '2997df'), '00:10:00;00', 'DF: 10 min não pula');
eq(H.framesToTC(107892, '2997df'), '01:00:00;00', 'DF: 1 h');

// SRT é tempo real: só em 24 redondo o relógio coincide com o TC
eq(H.tcToFrames({ h: 1, m: 0, s: 0, ms: 0 }, '24'), 86400, '24: 1 h = 86400 frames');
eq(H.tcToFrames({ h: 1, m: 0, s: 0, ms: 0 }, '23976'), 86314, '23.976: 1 h de relógio');
eq(H.framesToTC(86314, '23976'), '00:59:56:10', '23.976: 1 h de relógio em TC');

// fitTrack: ordena, corta sobreposição, resolve entradas iguais
const t = [{ start_frame: 10, length_frames: 20 }, { start_frame: 5, length_frames: 3 },
  { start_frame: 25, length_frames: 10 }, { start_frame: 25, length_frames: 4 }];
eq(H.fitTrack(t), 2, 'fitTrack conta os cortes');
eq(t.map(x => [x.start_frame, x.length_frames]), [[5, 3], [10, 15], [25, 1], [26, 3]], 'fitTrack layout');

// Detecção pelo grid de frames
const grade = (num, den) => Array.from({ length: 40 }, (_, i) => ({
  tcIn: H.msToTC(Math.round((i * 317 + 101) * den * 1000 / num)),
  tcOut: H.msToTC(Math.round((i * 317 + 179) * den * 1000 / num)),
}));
const sc24 = H.fpsGridScores(grade(24, 1)), sc23 = H.fpsGridScores(grade(24000, 1001)), sc29 = H.fpsGridScores(grade(30000, 1001));
eq([sc24['24'] > 0.9, sc24['23976'] < 0.3], [true, true], 'grid 24 separa de 23.976');
eq([sc23['23976'] > 0.9, sc23['24'] < 0.3], [true, true], 'grid 23.976 separa de 24');
eq([sc29['2997df'] > 0.9, sc23['2997df'] < 0.5], [true, true], 'grid 29.97 (coincide 1 em 4 com 23.976)');

// Parser de SRT com a fixture
const subs = H.parseSRT(fs.readFileSync(path.join(__dirname, 'fixtures', 'exemplo.srt'), 'utf8'));
eq(subs.length, 8, 'fixture: 8 legendas');
eq([subs[1].hasItalic, subs[1].lines], [true, ['Uma linha em itálico']], 'fixture: itálico');
eq([subs[3].hasTop, subs[3].lines], [true, ['Legenda no topo']], 'fixture: {\\an8}');
eq(subs[7].tcIn, { h: 1, m: 2, s: 3, ms: 500 }, 'fixture: hora > 0');

// STL: monta um bloco TTI e lê de volta (horas, itálico, acento ISO 6937)
const buf = new Uint8Array(1024 + 128); buf.fill(0x8F, 1024);
const o = 1024; buf[o + 3] = 0xFF; buf[o + 15] = 0;
[1, 2, 3, 12].forEach((v, i) => buf[o + 5 + i] = v);
[1, 2, 5, 0].forEach((v, i) => buf[o + 9 + i] = v);
[0x80, ...Buffer.from('Ol'), 0xC2, 0x61, 0x81, 0x8A, ...Buffer.from('linha 2')].forEach((b, i) => buf[o + 16 + i] = b);
for (const k of KEYS) {
  const r = H.parseSTL(buf.buffer, k)[0];
  eq([H.framesToTC(H.tcToFrames(r.tcIn, k), k).replace(';', ':'), r.lines, r.hasItalic],
    ['01:02:03:12', ['Olá', 'linha 2'], true], 'STL ' + k);
}

console.log(falhas ? `${falhas} FALHA(S)` : 'tc.test.js: todos os testes passaram');
process.exit(falhas ? 1 : 0);
