// Converte um SRT na lista que o index.html entrega ao gerador Python, em cada taxa.
// Uso: node tests/dump_subs.js <arquivo.srt> <single|dual>  -> JSON no stdout
const H = require('./harness.js');
const fs = require('fs');
const [srtPath, mode = 'single'] = process.argv.slice(2);
const subs = H.parseSRT(fs.readFileSync(srtPath, 'utf8'));
const out = {};
for (const k of Object.keys(H.FPS_DEFS)) {
  const all = subs.map(s => ({
    start_frame: H.tcToFrames(s.tcIn, k),
    length_frames: Math.max(1, H.tcToFrames(s.tcOut, k) - H.tcToFrames(s.tcIn, k)),
    text: s.lines.join('\r\n'),
    italic: !!s.hasItalic,
  }));
  const tracks = mode === 'dual' ? [all.filter(s => !s.italic), all.filter(s => s.italic)] : [all];
  const trimmed = tracks.reduce((n, t) => n + H.fitTrack(t), 0);
  const d = H.FPS_DEFS[k];
  out[k] = { subs: tracks.flat(), trimmed, rate: { num: d.num, den: d.den, base: d.base, drop: d.drop } };
}
process.stdout.write(JSON.stringify(out));
