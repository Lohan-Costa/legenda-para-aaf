// Carrega as funções puras do index.html em Node, sem DOM.
// Cada função é recortada do fonte pelo nome — se uma mudar de nome, o teste quebra aqui.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const FN_NAMES = ['fpsDef', 'tcToMs', 'msToTC', 'framesToTC', 'tcPartsToFrames', 'tcToFrames',
  'fitTrack', 'parseSRT', 'parseSTL', 'iso6937Decode', 'fpsGridScores', 'pad2'];

const fpsDefs = src.match(/const FPS_DEFS=\{[\s\S]*?\n\};/);
if (!fpsDefs) throw new Error('FPS_DEFS não encontrado no index.html');
let code = fpsDefs[0] + '\n';
for (const name of FN_NAMES) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('função não encontrada no index.html: ' + name);
  const rest = src.slice(i);
  code += rest.slice(0, rest.search(/\n(function |const |let |\/\/ ──|async function )/)) + '\n';
}
module.exports = new Function(code + 'return {FPS_DEFS,' + FN_NAMES.join(',') + '};')();
module.exports.APP_SRC = src;
