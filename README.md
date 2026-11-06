Create, edit, and play sheet music in your browser, in vanilla HTML/CSS/JS.

Your music can be imported as ASCII text and exported as strudel.cc code or sheet-music PDF.

Inspiration: https://lilypond.org/ & https://strudel.cc/

## Run

```
./local.sh
```

Then open http://127.0.0.1:3000. The address bar always holds a shareable link to the current sheet.
Or access [here](https://kuso.day/sheets)

## Syntax

```
title=Prelude      # shown above the music
author=you
bpm=96             # quarter notes per minute
ts=4,4             # time signature
key=g              # c g d a e b fs cs f bb eb ab db gb cb, add m for minor: am dm fsm

clef=t             # following lines go to the treble staff
instrument=flute   # optional: the sound of this staff
r8 4g8 4b8 5d8 5g4 5f8 5e8   # in key=g, 5f is F sharp
[4g 4b 5d]2 5e8 5d16 5c16 4b8 4a8

clef=b             # following lines go to the bass staff
instrument=cello
3g1
2d2 3d2~ 3d4
```

| write          | means                                                |
| -------------- | ---------------------------------------------------- |
| `4c4`          | octave 4, C, quarter note (`4c` is middle C)         |
| `4cs8` `4bb8`  | force C sharp / B flat, whatever the key             |
| `4fn8`         | force F natural, whatever the key                    |
| `4fss8` `4ebb8`| double sharp / double flat (B double flat: `4bbb8`)  |
| `3g2.` `3g2..` | dotted / double-dotted half note                     |
| `5e4~`         | tied into the next note                              |
| `r4` `r8.`     | rests                                                |
| `[4c 4e 4g]2`  | chord                                                |
| `g5cs 5d4`     | grace note before the next note (several make a run) |
| `4c8- 4d8- 4e8`| slur: each `-` joins a note to the next              |
| `4c4*` `4c4>` `4c4_` | staccato, accent, tenuto (combine: `4c4*>`)    |
| `4c2^`         | fermata: playback waits until you press play         |
| `5c4\` `5c4/`  | fall off / rise off the note                         |
| `{4c8 4d8 4e8}`| triplet (5 sixteenths make a quintuplet, etc.)       |
| `\|` `\|\|`      | start / end repeat, on a barline (nest by opening another `\|` inside) |
| `\|\|\|` `\|\|\|\|`  | endless loop: plays between them forever (one per sheet) |
| `4c8x4` `(…)x2`  | write a note, chord, triplet or `( )` group several times in a row (groups can span lines) |
| `mclef=b`      | mute that staff (any one of its clef lines will do)  |
| `# ...`        | comment                                              |

Durations are `1 2 4 8 16 32 64`. Notes follow the key signature: in `key=f`, `4b4` is B flat.
A `key=` line between music lines changes the key from that barline on, for both staves, and the sheet
prints the new key signature there. Add `s`, `b` or `n` to step outside the key for one note;
the sheet prints whatever sharps, flats and naturals are needed. Notes that cross a barline are split and tied
automatically, and measures are beamed by the beat.

## Instruments

Put `instrument=` under a `clef=` line to choose that staff's sound:

piano, electric piano, organ, music box, vibraphone, soft pad, chiptune, violin, strings, cello,
upright bass, guitar, harp, trumpet, muted trumpet, trombone, sax, flute, choir

A staff without `instrument=` plays whatever is picked in the sound menu (top right of the sheet), where every part of the sound
can be shaped: waveform (including a plucked string), body, envelope, voices, vibrato, tremolo,
bite, breath, scoop and room. Everything is synthesized in the browser; there are no recordings.
Instruments carry over to strudel.cc as its General MIDI sounds.

## Files

- `js/parse.js` reads the text into a sheet
- `js/engrave.js` lays the sheet out on A4 pages as SVG (Bravura music font, `fonts/`)
- `js/sound.js` synthesizes the instruments with Web Audio
- `js/play.js` plays the sheet, a couple of seconds ahead at a time
- `js/volume.js` the master volume, and `js/popups.js` the volume and swing popups in the transport bar
- `js/drag.js` lets the sound panel be dragged anywhere (by its title bar, or anywhere but a control in 4.0)
- `js/export.js` strudel.cc and PDF export
- `js/read.js` loads compressed `?s=` share links and remembers your work
- `js/theme.js` day / night and the 1.0 (Windows 98), 2.0 (XP), 3.0 (Windows 11) and 4.0 (age of AI, the default) looks
- `css/base.css` the music font and the sheet itself, shared by every look
- `css/print.css` printing, loaded last so it wins over any look
- `css/layout.css` where everything sits and what shows when, shared by every look
- `css/web1.css` to `css/web4.css` one skin per look: colors, fonts, borders and effects
- `images/hills-day.svg` `images/hills-night.svg` the rolling-hill wallpapers behind the XP look (original drawings)
- `js/main.js` connects the editor to everything

## Future ideas

- Manual line and page breaks
- More barline styles, such as a double barline to mark the end of a phrase
- A number on every measure, not just the first of each line
- Rehearsal letters
- Dynamics (p, mf, f, crescendos and so on)
- More clefs than treble and bass, such as alto, tenor and percussion
- Full scores: any number of staves, each with its own clef and instrument
