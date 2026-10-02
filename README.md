# Legenda → AAF

Converte legendas **SRT** (e TXT/STL) em um **AAF com SubCap** para o **Avid Media Composer**.
Você importa o AAF e recebe uma sequência com as legendas já posicionadas na timeline, com a
fonte certa em cada clip (Arial normal ou Arial Italic).

**Usar:** https://lohan-costa.github.io/legenda-para-aaf/

Tudo roda no navegador. O arquivo de legenda nunca sai da sua máquina, e não existe servidor.

## Como usar

1. Escolha o **frame rate** do projeto do Avid: **23.976**, **24** ou **29.97 DF**.
2. Arraste o `.srt` para a página (também aceita `.txt` no formato SRT e `.stl` EBU).
3. **Visualizar legenda** mostra a tabela com o timecode de entrada e saída, o estilo de cada
   legenda e os avisos. Dá para corrigir o texto com duplo-clique. **Apenas converter** pula
   a tabela.
4. Escolha o modo e clique em **Gerar AAF**:
   - **Single-track** (recomendado): todas as legendas em V1, com a fonte trocada por clip.
   - **Dual-track**: normal em V1 e itálico em V2. É o modo para quando uma legenda em
     itálico se sobrepõe no tempo a uma normal. O app escolhe esse modo sozinho quando
     detecta isso.
5. No Avid: **File → Import** o AAF num projeto com o **mesmo frame rate** escolhido.

Na primeira geração, o navegador baixa o motor Python (Pyodide, ~10 MB) e precisa de internet.
Depois ele fica em cache.

## O que é lido do SRT

| No SRT | No Avid |
|---|---|
| `<i>…</i>` | Arial Italic |
| `<b>…</b>`, `{\an8}` | identificados e mostrados na prévia (no AAF, a fonte é normal) |
| aspas curvas, travessão, reticências | trocados por equivalentes ASCII, que o SubCap exibe |
| quebra de linha | quebra de linha na legenda |

Os tempos do SRT são **tempo real** (o relógio do player), e o app converte cada tempo para o
frame correspondente na taxa escolhida. Só em 24 fps redondo o relógio coincide com o timecode.
Em 23.976, `01:00:00,000` do SRT cai em `00:59:56:10` da timeline, e isso está certo. A
prévia mostra exatamente o timecode em que cada legenda vai cair no AAF.

### Avisos

- **Frame rate suspeito.** Legendas exportadas por software de legendagem caem no grid de frames
  do vídeo. Se os tempos baterem com o grid de outra taxa e não com a escolhida, o log avisa.
- **Sobreposição na mesma trilha.** Uma trilha do Avid não comporta dois clips no mesmo
  instante. A saída da legenda anterior é cortada na entrada da seguinte, e o log diz
  quantas foram cortadas.

## Como funciona

O AAF não é montado do zero. Dentro do `index.html` vai embutido um AAF de referência, exportado
pelo próprio Media Composer (`template/TEMPLATE AAF.aaf`), com um clip SubCap normal e um
itálico. O app roda o [pyaaf2](https://github.com/markreidvfx/pyaaf2) no navegador via
[Pyodide](https://pyodide.org) e, para cada legenda:

1. clona o clip SubCap do estilo certo;
2. troca o texto nos dois parâmetros que o Avid lê (um em Mac Roman, outro em UTF-8);
3. ajusta a duração e posiciona o clip com filler entre as legendas.

Em 23.976 a estrutura do template é mantida intacta. Em 24 e 29.97 DF, a composição recebe a
taxa nova e mantém só a trilha de timecode principal, porque o template traz trilhas
auxiliares de película que só fazem sentido a 23.976.

## Desenvolvimento

É um único `index.html`, sem build. Para testar:

```bash
node tests/tc.test.js          # matemática de timecode, parsers, detecção de fps
python3 tests/aaf_test.py      # roda o gerador embutido e confere o AAF (pip install pyaaf2==1.7.1)
```

O `aaf_test.py` executa, em CPython, o mesmo código Python que o app executa no Pyodide. Ele
gera AAFs nas três taxas e nos dois modos, e confere a taxa, as trilhas, a posição, a duração e
o texto de cada legenda.

## Histórico

- **v1.1.0**: opção 24 fps. O 29.97 DF passa a gerar o AAF na taxa certa (antes as
  legendas saíam numa composição 23.976). O modo Dual-track volta a gerar arquivo.
  Sobreposições são cortadas em vez de empurrar as legendas seguintes, e a prévia mostra o
  timecode real do AAF.
- **v1.0.0**: geração de AAF com SubCap (Pyodide + pyaaf2 + template).
- **v0.x**: a primeira versão entregava **EBU STL** separado por estilo, para importar com o
  SubCap do Avid e formatar em lote. Foi substituída pelo AAF, que já chega formatado e na
  timeline.

---

Idealizado por [Lohan Costa, edt.](https://www.linkedin.com/in/lohan-costa/)
