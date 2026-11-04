const SPACE = 7;
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_MARGIN = 68;
const EPSILON = 1e-6;
const LETTERS = "cdefgab";

const GLYPHS = {
  brace: "",
  noteheadWhole: "",
  noteheadHalf: "",
  noteheadBlack: "",
  dot: "",
  metronomeQuarter: ""
};

const ARTICULATION_GLYPHS = {
  accent: { above: "\uE4A0", below: "\uE4A1" },
  staccato: { above: "\uE4A2", below: "\uE4A3" },
  tenuto: { above: "\uE4A4", below: "\uE4A5" }
};
const FERMATA_GLYPH = "\uE4C0";
const REST_GLYPHS = { 1: "", 2: "", 4: "", 8: "", 16: "", 32: "", 64: "" };
const FLAG_GLYPHS = {
  up: { 8: "", 16: "", 32: "", 64: "" },
  down: { 8: "", 16: "", 32: "", 64: "" }
};
const ACCIDENTAL_GLYPHS = { "-2": "\uE264", "-1": "\uE260", "0": "\uE261", "1": "\uE262", "2": "\uE263" };
const ACCIDENTAL_WIDTHS = { "-2": 1.64, "-1": 0.9, "0": 0.68, "1": 1, "2": 1 };
const TIME_DIGIT_WIDTHS = [ 1.9, 1.6, 1.84, 1.74, 1.9, 1.67, 1.8, 1.82, 1.8, 1.8 ];
const BEAM_COUNTS = { 8: 1, 16: 2, 32: 3, 64: 4 };
const GRACE_SIZE = 0.65;
const GRACE_ADVANCE = 1.3;

const CLEFS = {
  treble: { glyph: "", width: 2.7, bottomLine: 30, glyphStep: 2, sharpSteps: [ 8, 5, 9, 6, 3, 7, 4 ], flatSteps: [ 4, 7, 3, 6, 2, 5, 1 ] },
  bass: { glyph: "", width: 2.75, bottomLine: 18, glyphStep: 6, sharpSteps: [ 6, 3, 7, 4, 1, 5, 2 ], flatSteps: [ 2, 5, 1, 4, 0, 3, -1 ] }
};

let PLAYHEAD_STOPS = [];

const NOTATED_VALUES = [ 1, 2, 4, 8, 16, 32 ]
  .flatMap( duration => [ { duration, dots: 1 }, { duration, dots: 0 } ] )
  .map( value => ( { ...value, length: lengthOf( value ) } ) )
  .sort( ( a, b ) => b.length - a.length );

function svgElement( tag, attributes, parent ) {
  const element = document.createElementNS( "http://www.w3.org/2000/svg", tag );
  Object.entries( attributes ).forEach( ( [ name, value ] ) => element.setAttribute( name, value ) );
  parent.appendChild( element );
  return element;
}

function drawGlyph( glyph, x, y, parent, class_name = "glyph" ) {
  svgElement( "text", { x, y, class: class_name }, parent ).textContent = glyph;
}

function drawText( content, x, y, class_name, parent ) {
  const text = svgElement( "text", { x, y, class: class_name }, parent );
  text.textContent = content;
  return text;
}

function fitText( text, room ) {
  const size = parseFloat( getComputedStyle( text ).fontSize );
  const scale = Math.max( 0.5, Math.min( 1, room / text.getComputedTextLength() ) );
  text.style.fontSize = `${ size * scale }px`;
  while ( text.getComputedTextLength() > room && text.textContent.length > 1 )
    text.textContent = text.textContent.slice( 0, -2 ) + "…";
}

function drawLine( x1, y1, x2, y2, thickness, parent ) {
  svgElement( "line", { x1, y1, x2, y2, "stroke-width": thickness * SPACE }, parent );
}

function drawPolygon( points, parent ) {
  svgElement( "polygon", { points: points.map( point => point.join( "," ) ).join( " " ) }, parent );
}

function staffStepOf( pitch, clef ) {
  return pitch.octave * 7 + LETTERS.indexOf( pitch.letter ) - CLEFS[ clef ].bottomLine;
}

function yOfStep( staff_top, step ) {
  return staff_top + ( 8 - step ) * SPACE / 2;
}

function notatedPiecesOf( length ) {
  const pieces = [];
  let remaining = length;
  while ( remaining > EPSILON ) {
    const piece = NOTATED_VALUES.find( value => value.length <= remaining + EPSILON ) || NOTATED_VALUES.at( -1 );
    pieces.push( piece );
    remaining -= piece.length;
  }
  return pieces;
}

function staffLengthOf( staff ) {
  return staff.events.reduce( ( total, event ) => total + lengthOf( event ), 0 );
}

function measuresOf( events, measure_length, measure_count ) {
  const measures = Array.from( { length: measure_count }, () => [] );
  let position = 0;
  let previous = null;

  const placeEvent = ( event, total_length ) => {
    let remaining = total_length;
    const pieces = [];
    while ( remaining > EPSILON ) {
      const index = Math.floor( position / measure_length + EPSILON );
      const start = position - index * measure_length;
      const room = measure_length - start;
      const fits_as_written = remaining === total_length && remaining <= room + EPSILON && !event.padding;
      const notated_pieces = fits_as_written ? [ event ] : notatedPiecesOf( Math.min( remaining, room ) );
      notated_pieces.forEach( piece => {
        const is_first_piece = remaining === total_length;
        const placed = {
          event,
          rest: event.rest,
          pitches: event.pitches,
          graces: is_first_piece ? event.graces || [] : [],
          duration: piece.duration,
          dots: piece.dots,
          start: position - index * measure_length,
          length: lengthOf( piece ),
          tied: !event.rest,
          continuesTie: Boolean( previous && previous.tied && !event.rest )
        };
        measures[ index ] ??= [];
        measures[ index ].push( placed );
        pieces.push( placed );
        position += placed.length;
        remaining -= placed.length;
        previous = placed;
      });
    }
    if ( previous )
      previous.tied = !event.rest && event.tie;
    markPieces( event, pieces );
  };

  events.forEach( event => placeEvent( event, lengthOf( event ) ) );
  const padding = measure_count * measure_length - position;
  if ( padding > EPSILON )
    placeEvent( { rest: true, pitches: [], padding: true, marks: [] }, padding );

  return measures.map( measure => wholeMeasureRestOr( measure, measure_length ) );
}

function markPieces( event, pieces ) {
  event.pieces = pieces;
  const first = pieces[ 0 ];
  const last = pieces.at( -1 );
  const articulations = event.articulations || [];
  first.articulations = articulations.filter( articulation => articulation !== "fermata" );
  last.fermata = articulations.includes( "fermata" );
  last.fall = Boolean( event.fall );
  last.rise = Boolean( event.rise );
}

function wholeMeasureRestOr( measure, measure_length ) {
  if ( !measure.every( placed => placed.rest ) )
    return measure;
  const fermata = measure.some( placed => placed.fermata );
  return [ { event: measure[ 0 ].event, rest: true, wholeMeasure: true, fermata, articulations: [], pitches: [], duration: 1, dots: 0, start: 0, length: measure_length } ];
}

function beatLengthOf( meter ) {
  const is_compound = meter.unit >= 8 && meter.beats % 3 === 0 && meter.beats > 3;
  if ( is_compound )
    return 3 / meter.unit;
  if ( meter.unit >= 8 )
    return measureLengthOf( meter );
  return 1 / meter.unit;
}

function beamGroupsOf( measure, beat_length ) {
  const groups = [];
  let current = [];
  let current_beat = -1;
  const closeGroup = () => {
    if ( current.length > 1 )
      groups.push( current );
    current = [];
  };
  measure.forEach( placed => {
    const beat = Math.floor( placed.start / beat_length + EPSILON );
    const is_beamable = !placed.rest && placed.duration >= 8;
    if ( !is_beamable || beat !== current_beat )
      closeGroup();
    if ( is_beamable ) {
      current.push( placed );
      current_beat = beat;
    }
  });
  closeGroup();
  return groups;
}

function stemDirectionOf( steps ) {
  const highest = Math.max( ...steps );
  const lowest = Math.min( ...steps );
  return highest - 4 >= 4 - lowest ? "down" : "up";
}

function headWidthOf( placed ) {
  return placed.duration === 1 ? 1.69 : 1.18;
}

function leftmostHeadOf( placed ) {
  return Math.min( 0, ...placed.heads.map( head => head.offset ) );
}

function rightmostHeadOf( placed ) {
  return Math.max( 0, ...placed.heads.map( head => head.offset ) );
}

function writtenFifthsOf( sheet ) {
  return SHOW_IN_C ? 0 : sheet.key.fifths;
}

function markAccidentals( measure, fifths ) {
  const alterations = {};
  const accidentalFor = ( pitch, is_continuing_tie ) => {
    const name = pitch.letter + pitch.octave;
    const expected = name in alterations ? alterations[ name ] : keyAlterOf( pitch.letter, fifths );
    alterations[ name ] = pitch.alter;
    const needs_sign = pitch.alter !== expected || ( SHOW_IN_C && pitch.alter !== 0 );
    return needs_sign && !is_continuing_tie ? pitch.alter : null;
  };
  measure.forEach( placed => {
    placed.graceAccidentals = ( placed.graces || [] ).map( pitch => accidentalFor( pitch, false ) );
    placed.accidentals = placed.pitches.map( pitch => accidentalFor( pitch, placed.continuesTie ) );
  });
}

function arrangeHeads( placed ) {
  const head_width = headWidthOf( placed );
  const going_up = placed.stem !== "down";
  const heads = placed.pitches
    .map( ( pitch, index ) => ( { pitch, step: placed.steps[ index ], accidental: placed.accidentals[ index ], offset: 0 } ) )
    .sort( ( a, b ) => going_up ? a.step - b.step : b.step - a.step );
  heads.forEach( ( head, index ) => {
    const neighbor = heads[ index - 1 ];
    if ( neighbor && Math.abs( head.step - neighbor.step ) === 1 && neighbor.offset === 0 )
      head.offset = going_up ? head_width - 0.12 : -( head_width - 0.12 );
  });
  return heads;
}

function arrangeAccidentals( heads ) {
  const columns = [];
  heads
    .filter( head => head.accidental !== null )
    .sort( ( a, b ) => b.step - a.step )
    .forEach( head => {
      let column = columns.findIndex( steps_in_column => steps_in_column.every( step => Math.abs( step - head.step ) >= 6 ) );
      if ( column === -1 ) {
        columns.push( [] );
        column = columns.length - 1;
      }
      columns[ column ].push( head.step );
      head.accidentalColumn = column;
    });
  return columns.length;
}

function graceAccidentalWidthOf( accidental ) {
  return accidental === null ? 0 : ACCIDENTAL_WIDTHS[ accidental ] * GRACE_SIZE + 0.15;
}

function graceWidthOf( placed ) {
  if ( !placed.graces.length )
    return 0;
  const accidentals = placed.graceAccidentals.reduce( ( total, accidental ) => total + graceAccidentalWidthOf( accidental ), 0 );
  return placed.graces.length * GRACE_ADVANCE + accidentals + 0.4;
}

function prepareMeasure( measure, clef, sheet ) {
  markAccidentals( measure, writtenFifthsOf( sheet ) );
  measure.forEach( placed => {
    placed.steps = placed.pitches.map( pitch => staffStepOf( pitch, clef ) );
    placed.beamCount = BEAM_COUNTS[ placed.duration ] || 0;
  });
  measure.beams = beamGroupsOf( measure, beatLengthOf( sheet.meter ) ).map( group => {
    const direction = stemDirectionOf( group.flatMap( placed => placed.steps ) );
    const beam = { notes: group, direction };
    group.forEach( placed => {
      placed.stem = direction;
      placed.beam = beam;
    });
    return beam;
  });
  measure.filter( placed => !placed.rest ).forEach( placed => {
    placed.stem ??= placed.duration === 1 ? "none" : stemDirectionOf( placed.steps );
    placed.heads = arrangeHeads( placed );
    const accidental_columns = arrangeAccidentals( placed.heads );
    const flag_room = placed.beamCount && !placed.beam && placed.stem === "up" ? 1.1 : 0;
    const dot_room = placed.dots ? 0.4 + placed.dots * 0.6 : 0;
    const widest_accidental = Math.max( 1.1, ...placed.heads.filter( head => head.accidental !== null ).map( head => ACCIDENTAL_WIDTHS[ head.accidental ] ) );
    placed.leading = ( accidental_columns ? accidental_columns * 1.1 + widest_accidental - 1.1 + 0.25 : 0 ) - leftmostHeadOf( placed );
    const slide_room = placed.fall || placed.rise ? 2.6 : 0;
    const tie_room = placed.tied ? 1.8 : 0;
    placed.trailing = rightmostHeadOf( placed ) + headWidthOf( placed ) + Math.max( flag_room, dot_room ) + slide_room + tie_room;
    placed.accidentalRoom = placed.leading;
    placed.graceSteps = placed.graces.map( pitch => staffStepOf( pitch, clef ) );
    placed.leading += graceWidthOf( placed );
  });
  measure.filter( placed => placed.rest ).forEach( placed => {
    placed.leading = 0;
    placed.trailing = 1.3 + ( placed.dots ? 0.9 : 0 );
  });
}

function prepareStaves( sheet ) {
  const measure_length = measureLengthOf( sheet.meter );
  const longest_staff = Math.max( ...sheet.staves.map( staffLengthOf ) );
  const measure_count = Math.max( 1, Math.ceil( longest_staff / measure_length - EPSILON ) );
  return sheet.staves.map( staff => {
    staff.events.forEach( event => event.marks = [] );
    const measures = measuresOf( staff.events, measure_length, measure_count );
    measures.forEach( measure => prepareMeasure( measure, staff.clef, sheet ) );
    return { clef: staff.clef, measures, events: staff.events };
  });
}

function spaceFor( length ) {
  return 4 * Math.sqrt( length * 4 );
}

function layoutMeasure( measure_on_each_staff, measure_length ) {
  const everything = measure_on_each_staff.flat();
  const onsets = [ ...new Set( everything.map( placed => placed.start.toFixed( 6 ) ) ) ].map( Number ).sort( ( a, b ) => a - b );
  const columns = onsets.map( ( onset, index ) => {
    const items = everything.filter( placed => Math.abs( placed.start - onset ) < EPSILON );
    return {
      onset,
      items,
      leading: Math.max( ...items.map( placed => placed.leading ) ),
      trailing: Math.max( ...items.map( placed => placed.trailing ) ),
      natural: spaceFor( ( onsets[ index + 1 ] ?? measure_length ) - onset )
    };
  });
  columns.forEach( ( column, index ) => {
    const next_leading = index + 1 < columns.length ? columns[ index + 1 ].leading : 0.6;
    column.width = Math.max( column.natural, column.trailing + 0.6 + next_leading );
  });
  const opening = 1.4 + columns[ 0 ].leading;
  const stretchable = columns.reduce( ( total, column ) => total + column.width, 0 );
  return { columns, opening, stretchable, measureOnEachStaff: measure_on_each_staff };
}

function keySignatureWidthOf( fifths ) {
  return Math.abs( fifths ) * ( fifths > 0 ? 1.1 : 1 );
}

function timeSignatureWidthOf( meter ) {
  const widthOfNumber = number => String( number ).split( "" ).reduce( ( total, digit ) => total + TIME_DIGIT_WIDTHS[ digit ], 0 );
  return Math.max( widthOfNumber( meter.beats ), widthOfNumber( meter.unit ) );
}

function headerWidthOf( sheet, is_first_system ) {
  const time_signature = is_first_system ? timeSignatureWidthOf( sheet.meter ) + 1 : 0;
  return 1 + 2.75 + 1 + keySignatureWidthOf( writtenFifthsOf( sheet ) ) + time_signature;
}

function breakIntoSystems( measure_layouts, sheet ) {
  const line_width = ( PAGE_WIDTH - 2 * PAGE_MARGIN ) / SPACE;
  const systems = [];
  let current = null;
  measure_layouts.forEach( ( layout, index ) => {
    const natural_width = layout.opening + layout.stretchable;
    if ( current && current.used + natural_width > current.available )
      current = null;
    if ( !current ) {
      const header = headerWidthOf( sheet, systems.length === 0 );
      current = { header, available: line_width - header, used: 0, measures: [], firstMeasureNumber: index + 1 };
      systems.push( current );
    }
    current.measures.push( layout );
    current.used += natural_width;
  });
  systems.forEach( ( system, index ) => justifySystem( system, index === systems.length - 1 ) );
  return systems;
}

function justifySystem( system, is_last_system ) {
  const opening = system.measures.reduce( ( total, layout ) => total + layout.opening, 0 );
  const stretchable = system.measures.reduce( ( total, layout ) => total + layout.stretchable, 0 );
  const full_stretch = ( system.available - opening ) / stretchable;
  const is_mostly_full = system.used / system.available > 0.6;
  const stretch = is_last_system && !is_mostly_full ? 1 : full_stretch;
  let x = system.header;
  system.measures.forEach( layout => {
    layout.x = x;
    let column_x = x + layout.opening;
    layout.columns.forEach( column => {
      column.x = column_x;
      column_x += column.width * stretch;
    });
    layout.width = column_x - x;
    x = column_x;
  });
  system.width = x;
}

function verticalExtentOf( measures_of_staff ) {
  const steps = measures_of_staff.flat().filter( placed => !placed.rest ).flatMap( placed => {
    const highest = Math.max( ...placed.steps );
    const lowest = Math.min( ...placed.steps );
    return [ placed.stem === "up" ? highest + 7 : highest, placed.stem === "down" ? lowest - 7 : lowest ];
  });
  return { above: Math.max( 8, ...steps ) + 2, below: Math.min( 0, ...steps ) - 2 };
}

function stackStaves( system, staves ) {
  const extents = staves.map( staff => verticalExtentOf( system.measures.map( layout => layout.measureOnEachStaff[ staves.indexOf( staff ) ] ) ) );
  let top = Math.max( 0, extents[ 0 ].above - 8 ) * SPACE / 2;
  system.staffTops = extents.map( ( extent, index ) => {
    if ( index > 0 ) {
      const previous = extents[ index - 1 ];
      const gap = Math.max( 13, -previous.below + extent.above - 8 );
      top += ( 8 + gap ) * SPACE / 2;
    }
    return top;
  });
  system.height = system.staffTops.at( -1 ) + ( 8 - Math.min( 0, extents.at( -1 ).below ) ) * SPACE / 2;
}

function arrangeOnPages( systems, sheet ) {
  const pages = [ { systems: [] } ];
  const title_room = sheet.title || sheet.author ? 90 : 20;
  let y = PAGE_MARGIN + title_room + 16;
  systems.forEach( system => {
    if ( y + system.height > PAGE_HEIGHT - PAGE_MARGIN && pages.at( -1 ).systems.length ) {
      pages.push( { systems: [] } );
      y = PAGE_MARGIN;
    }
    system.y = y;
    pages.at( -1 ).systems.push( system );
    y += system.height + 7 * SPACE;
  });
  return pages;
}

function drawStaffLines( left, right, top, parent ) {
  for ( let line = 0; line < 5; line++ )
    drawLine( left, top + line * SPACE, right, top + line * SPACE, 0.13, parent );
}

function drawKeySignature( clef, fifths, x, top, parent ) {
  const steps = fifths > 0 ? CLEFS[ clef ].sharpSteps : CLEFS[ clef ].flatSteps;
  const glyph = ACCIDENTAL_GLYPHS[ Math.sign( fifths ) ];
  const advance = fifths > 0 ? 1.1 : 1;
  steps.slice( 0, Math.abs( fifths ) ).forEach( ( step, index ) => {
    drawGlyph( glyph, x + index * advance * SPACE, yOfStep( top, step ), parent );
  });
}

function drawTimeSignature( meter, x, top, parent ) {
  const width = timeSignatureWidthOf( meter );
  const drawNumber = ( number, step ) => {
    const digits = String( number ).split( "" );
    const number_width = digits.reduce( ( total, digit ) => total + TIME_DIGIT_WIDTHS[ digit ], 0 );
    let digit_x = x + ( width - number_width ) / 2 * SPACE;
    digits.forEach( digit => {
      drawGlyph( String.fromCharCode( 0xE080 + Number( digit ) ), digit_x, yOfStep( top, step ), parent );
      digit_x += TIME_DIGIT_WIDTHS[ digit ] * SPACE;
    });
  };
  drawNumber( meter.beats, 6 );
  drawNumber( meter.unit, 2 );
}

function drawSystemHeader( system, staves, sheet, is_first_system, parent ) {
  const left = PAGE_MARGIN;
  staves.forEach( ( staff, index ) => {
    const top = system.y + system.staffTops[ index ];
    const clef = CLEFS[ staff.clef ];
    drawGlyph( clef.glyph, left + SPACE, yOfStep( top, clef.glyphStep ), parent );
    const key_x = left + ( 1 + clef.width + 1 ) * SPACE;
    drawKeySignature( staff.clef, writtenFifthsOf( sheet ), key_x, top, parent );
    if ( is_first_system )
      drawTimeSignature( sheet.meter, key_x + ( keySignatureWidthOf( writtenFifthsOf( sheet ) ) + 0.6 ) * SPACE, top, parent );
  });
  const first_top = system.y + system.staffTops[ 0 ];
  const last_bottom = system.y + system.staffTops.at( -1 ) + 4 * SPACE;
  if ( staves.length > 1 ) {
    drawLine( left, first_top, left, last_bottom, 0.16, parent );
    const tallness = ( last_bottom - first_top ) / ( 4 * SPACE );
    const wideness = Math.sqrt( tallness ) * 0.9;
    const brace_x = left - ( 0.35 + 1.31 * wideness ) * SPACE;
    const brace = svgElement( "text", {
      class: "glyph",
      transform: `translate( ${ brace_x } ${ last_bottom } ) scale( ${ wideness } ${ tallness } )`
    }, parent );
    brace.textContent = GLYPHS.brace;
  }
  if ( !is_first_system )
    drawText( system.firstMeasureNumber, left, first_top - 2.4 * SPACE, "measureNumber", parent );
}

function drawBarline( x, system, is_final, parent ) {
  const top = system.y + system.staffTops[ 0 ];
  const bottom = system.y + system.staffTops.at( -1 ) + 4 * SPACE;
  if ( !is_final ) {
    drawLine( x, top, x, bottom, 0.16, parent );
    return;
  }
  drawLine( x - 0.25 * SPACE, top, x - 0.25 * SPACE, bottom, 0.5, parent );
  drawLine( x - 1.05 * SPACE, top, x - 1.05 * SPACE, bottom, 0.16, parent );
}

function drawLedgerLines( placed, x, top, parent ) {
  const head_width = headWidthOf( placed );
  const left = x + ( leftmostHeadOf( placed ) - 0.4 ) * SPACE;
  const right = x + ( rightmostHeadOf( placed ) + head_width + 0.4 ) * SPACE;
  const lowest = Math.min( ...placed.steps );
  const highest = Math.max( ...placed.steps );
  for ( let step = -2; step >= lowest; step -= 2 )
    drawLine( left, yOfStep( top, step ), right, yOfStep( top, step ), 0.16, parent );
  for ( let step = 10; step <= highest; step += 2 )
    drawLine( left, yOfStep( top, step ), right, yOfStep( top, step ), 0.16, parent );
}

function noteheadGlyphOf( duration ) {
  if ( duration === 1 )
    return GLYPHS.noteheadWhole;
  if ( duration === 2 )
    return GLYPHS.noteheadHalf;
  return GLYPHS.noteheadBlack;
}

function stemXOf( placed, x ) {
  return placed.stem === "up" ? x + ( headWidthOf( placed ) - 0.06 ) * SPACE : x + 0.06 * SPACE;
}

function drawAccidental( head, placed, x, y, parent ) {
  const column_right = x + ( leftmostHeadOf( placed ) - 0.25 - head.accidentalColumn * 1.1 ) * SPACE;
  drawGlyph( ACCIDENTAL_GLYPHS[ head.accidental ], column_right - ACCIDENTAL_WIDTHS[ head.accidental ] * SPACE, y, parent );
}

function drawDots( head, placed, x, top, parent ) {
  const step = head.step % 2 === 0 ? head.step + 1 : head.step;
  const first_dot_x = x + ( rightmostHeadOf( placed ) + headWidthOf( placed ) + 0.4 ) * SPACE;
  for ( let dot = 0; dot < placed.dots; dot++ )
    drawGlyph( GLYPHS.dot, first_dot_x + dot * 0.6 * SPACE, yOfStep( top, step ), parent );
}

function drawGraceLedgerLines( step, x, top, parent ) {
  const ledger_steps = [];
  for ( let ledger = -2; ledger >= step; ledger -= 2 )
    ledger_steps.push( ledger );
  for ( let ledger = 10; ledger <= step; ledger += 2 )
    ledger_steps.push( ledger );
  const width = 1.18 * GRACE_SIZE;
  ledger_steps.forEach( ledger => drawLine( x - 0.25 * SPACE, yOfStep( top, ledger ), x + ( width + 0.25 ) * SPACE, yOfStep( top, ledger ), 0.12, parent ) );
}

function drawGraces( placed, x, top, parent ) {
  if ( !placed.graces.length )
    return;
  const stem_top = yOfStep( top, Math.max( ...placed.graceSteps ) + 5 );
  const head_width = 1.18 * GRACE_SIZE * SPACE;
  let grace_x = x - ( placed.leading - 0.2 ) * SPACE;
  const stems = placed.graceSteps.map( ( step, index ) => {
    const accidental = placed.graceAccidentals[ index ];
    const y = yOfStep( top, step );
    if ( accidental !== null ) {
      drawGlyph( ACCIDENTAL_GLYPHS[ accidental ], grace_x, y, parent, "glyph grace" );
      grace_x += graceAccidentalWidthOf( accidental ) * SPACE;
    }
    drawGraceLedgerLines( step, grace_x, top, parent );
    drawGlyph( GLYPHS.noteheadBlack, grace_x, y, parent, "glyph grace" );
    const stem_x = grace_x + head_width - 0.05 * SPACE;
    drawLine( stem_x, y, stem_x, stem_top, 0.09, parent );
    grace_x += GRACE_ADVANCE * SPACE;
    return stem_x;
  });
  if ( stems.length === 1 ) {
    drawGlyph( FLAG_GLYPHS.up[ 8 ], stems[ 0 ] - 0.05 * SPACE, stem_top, parent, "glyph grace" );
    drawLine( stems[ 0 ] - 0.6 * SPACE, stem_top + 1.9 * SPACE, stems[ 0 ] + 0.9 * SPACE, stem_top + 0.7 * SPACE, 0.1, parent );
    return;
  }
  [ 0, 0.5 ].forEach( offset => {
    const y = stem_top + offset * SPACE;
    drawPolygon( [ [ stems[ 0 ] - 0.05 * SPACE, y ], [ stems.at( -1 ) + 0.05 * SPACE, y ], [ stems.at( -1 ) + 0.05 * SPACE, y + 0.3 * SPACE ], [ stems[ 0 ] - 0.05 * SPACE, y + 0.3 * SPACE ] ], parent );
  });
}

function drawNote( placed, x, top, parent ) {
  drawGraces( placed, x, top, parent );
  drawLedgerLines( placed, x, top, parent );
  placed.heads.forEach( head => {
    const y = yOfStep( top, head.step );
    drawGlyph( noteheadGlyphOf( placed.duration ), x + head.offset * SPACE, y, parent );
    if ( head.accidental !== null )
      drawAccidental( head, placed, x, y, parent );
    drawDots( head, placed, x, top, parent );
  });
  placed.stemX = stemXOf( placed, x );
  if ( placed.stem === "none" || placed.beam )
    return;
  const highest = Math.max( ...placed.steps );
  const lowest = Math.min( ...placed.steps );
  const extra_for_flags = Math.max( 0, placed.beamCount - 1 );
  const stem_end = placed.stem === "up" ? Math.max( highest + 7 + extra_for_flags, 4 ) : Math.min( lowest - 7 - extra_for_flags, 4 );
  const stem_start = placed.stem === "up" ? lowest : highest;
  placed.stemTipY = yOfStep( top, stem_end );
  drawLine( placed.stemX, yOfStep( top, stem_start ), placed.stemX, yOfStep( top, stem_end ), 0.12, parent );
  if ( placed.beamCount )
    drawGlyph( FLAG_GLYPHS[ placed.stem ][ placed.duration ], placed.stemX - 0.06 * SPACE, yOfStep( top, stem_end ), parent );
}

function drawRest( placed, x, top, measure_layout, parent ) {
  if ( placed.wholeMeasure ) {
    const center_x = measure_layout.x * SPACE + PAGE_MARGIN + measure_layout.width * SPACE / 2;
    drawGlyph( REST_GLYPHS[ 1 ], center_x - 0.56 * SPACE, yOfStep( top, 6 ), parent );
    return;
  }
  const step = placed.duration === 1 ? 6 : 4;
  drawGlyph( REST_GLYPHS[ placed.duration ], x, yOfStep( top, step ), parent );
  for ( let dot = 0; dot < placed.dots; dot++ )
    drawGlyph( GLYPHS.dot, x + ( 1.5 + dot * 0.6 ) * SPACE, yOfStep( top, 5 ), parent );
}

function drawBeam( beam, top, parent ) {
  const notes = beam.notes;
  const going_up = beam.direction === "up";
  const outerStepOf = placed => going_up ? Math.max( ...placed.steps ) : Math.min( ...placed.steps );
  const innerStepOf = placed => going_up ? Math.min( ...placed.steps ) : Math.max( ...placed.steps );
  const first = notes[ 0 ];
  const last = notes.at( -1 );
  const run = last.stemX - first.stemX;
  const outer_steps = notes.map( outerStepOf );
  const interior_is_more_extreme = outer_steps.slice( 1, -1 ).some( step => going_up ? step > Math.max( outer_steps[ 0 ], outer_steps.at( -1 ) ) : step < Math.min( outer_steps[ 0 ], outer_steps.at( -1 ) ) );
  const rise = interior_is_more_extreme ? 0 : Math.max( -2, Math.min( 2, outer_steps.at( -1 ) - outer_steps[ 0 ] ) );
  const slope = run > 0 ? -rise * SPACE / 2 / run : 0;
  const beam_count = Math.max( ...notes.map( placed => placed.beamCount ) );
  const stem_length = ( 3.25 + ( beam_count - 1 ) * 0.75 ) * SPACE;
  const middle_y = yOfStep( top, 4 );
  const start_ys = notes.map( placed => {
    const head_y = yOfStep( top, outerStepOf( placed ) );
    const reach = going_up ? Math.min( head_y - stem_length, middle_y ) : Math.max( head_y + stem_length, middle_y );
    return reach - slope * ( placed.stemX - first.stemX );
  });
  const start_y = going_up ? Math.min( ...start_ys ) : Math.max( ...start_ys );
  const beamYAt = x => start_y + slope * ( x - first.stemX );
  const toward_heads = going_up ? 1 : -1;
  const thickness = 0.5 * SPACE;

  notes.forEach( placed => {
    placed.stemTipY = beamYAt( placed.stemX );
    drawLine( placed.stemX, yOfStep( top, innerStepOf( placed ) ), placed.stemX, placed.stemTipY, 0.12, placed.group );
  });

  const drawSegment = ( from_x, to_x, level ) => {
    const offset = level * 0.75 * SPACE * toward_heads;
    const edge = [ [ from_x, beamYAt( from_x ) + offset ], [ to_x, beamYAt( to_x ) + offset ] ];
    drawPolygon( [ ...edge, ...edge.reverse().map( ( [ x, y ] ) => [ x, y + thickness * toward_heads ] ) ], parent );
  };
  const half = 0.06 * SPACE;
  drawSegment( first.stemX - half, last.stemX + half, 0 );

  for ( let level = 1; level < beam_count; level++ ) {
    let run_start = null;
    notes.forEach( ( placed, index ) => {
      const reaches = placed.beamCount > level;
      if ( reaches && run_start === null )
        run_start = index;
      const run_ends = run_start !== null && ( !reaches || index === notes.length - 1 );
      if ( !run_ends )
        return;
      const run_end = reaches ? index : index - 1;
      const from = notes[ run_start ];
      const to = notes[ run_end ];
      if ( run_start !== run_end )
        drawSegment( from.stemX - half, to.stemX + half, level );
      else if ( run_start === 0 )
        drawSegment( from.stemX - half, from.stemX + 1.1 * SPACE, level );
      else
        drawSegment( from.stemX - 1.1 * SPACE, from.stemX + half, level );
      run_start = null;
    });
  }
}

function drawCurve( from_x, from_y, to_x, to_y, height, direction, parent ) {
  const thickness = 0.4 * SPACE;
  const middle_x = ( from_x + to_x ) / 2;
  const middle_y = ( from_y + to_y ) / 2;
  const outer = `Q ${ middle_x } ${ middle_y + height * direction } ${ to_x } ${ to_y }`;
  const inner = `Q ${ middle_x } ${ middle_y + ( height - thickness ) * direction } ${ from_x } ${ from_y }`;
  svgElement( "path", { d: `M ${ from_x } ${ from_y } ${ outer } ${ inner } Z`, class: "tie" }, parent );
}

function drawTie( from_x, to_x, y, direction, parent ) {
  const height = Math.max( 1.1 * SPACE, Math.min( 3 * SPACE, ( to_x - from_x ) * 0.25 ) );
  drawCurve( from_x, y, to_x, y, height, direction, parent );
}

function tieDirectionOf( placed, head ) {
  const middle = ( Math.max( ...placed.steps ) + Math.min( ...placed.steps ) ) / 2;
  if ( placed.heads.length > 1 && head.step !== middle )
    return head.step > middle ? -1 : 1;
  return placed.stem === "up" ? 1 : -1;
}

function drawTiesOfStaff( measures ) {
  const notes = measures.flat().filter( placed => !placed.rest );
  notes.forEach( ( placed, index ) => {
    const next = notes[ index + 1 ];
    if ( !placed.tied || !next || !placed.drawn || !next.drawn )
      return;
    const from_x = placed.drawn.x + ( rightmostHeadOf( placed ) + headWidthOf( placed ) + 0.2 ) * SPACE;
    const to_x = next.drawn.x + ( leftmostHeadOf( next ) - 0.2 ) * SPACE;
    placed.heads.forEach( head => {
      const target = next.heads.find( other => midiOf( other.pitch ) === midiOf( head.pitch ) );
      if ( !target )
        return;
      const direction = tieDirectionOf( placed, head );
      const from_y = yOfStep( placed.drawn.top, head.step ) + direction * 0.6 * SPACE;
      if ( placed.drawn.system === next.drawn.system ) {
        drawTie( from_x, to_x, from_y, direction, placed.group );
        return;
      }
      const system_end = PAGE_MARGIN + placed.drawn.system.width * SPACE;
      drawTie( from_x, system_end + SPACE, from_y, direction, placed.group );
      const next_y = yOfStep( next.drawn.top, target.step ) + direction * 0.6 * SPACE;
      drawTie( next.drawn.x - 2.5 * SPACE, to_x, next_y, direction, next.group );
    });
  });
}

function spaceAwayFromLines( step, direction ) {
  const is_on_line_inside_staff = step >= 0 && step <= 8 && step % 2 === 0;
  return is_on_line_inside_staff ? step + direction : step;
}

function articulationSideOf( placed ) {
  return placed.stem === "up" ? "below" : "above";
}

function drawArticulations( placed, top, parent ) {
  if ( !placed.articulations?.length || placed.rest )
    return;
  const side = articulationSideOf( placed );
  const direction = side === "above" ? 1 : -1;
  const center_x = placed.drawn.x + headWidthOf( placed ) * SPACE / 2;
  let step = ( side === "above" ? Math.max( ...placed.steps ) : Math.min( ...placed.steps ) ) + 2 * direction;
  [ "staccato", "tenuto", "accent" ]
    .filter( articulation => placed.articulations.includes( articulation ) )
    .forEach( articulation => {
      step = spaceAwayFromLines( step, direction );
      drawGlyph( ARTICULATION_GLYPHS[ articulation ][ side ], center_x, yOfStep( top, step ) + 0.5 * SPACE * ( side === "above" ? 0 : -0.2 ), parent, "glyph centered" );
      step += 2 * direction;
    });
}

function drawFermata( placed, top, measure_layout, parent ) {
  if ( !placed.fermata )
    return;
  const center_x = placed.wholeMeasure
    ? PAGE_MARGIN + ( measure_layout.x + measure_layout.width / 2 ) * SPACE
    : placed.drawn.x + ( placed.rest ? 0.6 : headWidthOf( placed ) / 2 ) * SPACE;
  const highest_head = placed.rest ? top : yOfStep( top, Math.max( ...placed.steps ) ) - SPACE;
  const stem_tip = placed.stem === "up" ? placed.stemTipY : Infinity;
  const y = Math.min( top - 0.8 * SPACE, highest_head - 0.6 * SPACE, stem_tip - 0.8 * SPACE );
  drawGlyph( FERMATA_GLYPH, center_x, y, parent, "glyph centered" );
}

function drawSlide( placed, top, parent ) {
  if ( !placed.fall && !placed.rise )
    return;
  const start_x = placed.drawn.x + ( rightmostHeadOf( placed ) + headWidthOf( placed ) + 0.35 + ( placed.dots ? 0.4 + placed.dots * 0.6 : 0 ) ) * SPACE;
  const y = yOfStep( top, placed.fall ? Math.min( ...placed.steps ) : Math.max( ...placed.steps ) );
  const drop = placed.fall ? 1.8 * SPACE : -1.8 * SPACE;
  const end_x = start_x + 2 * SPACE;
  svgElement( "path", { d: `M ${ start_x } ${ y } Q ${ start_x + 1.4 * SPACE } ${ y } ${ end_x } ${ y + drop }`, class: "slide" }, parent );
}

function drawTuplets( measure, top, clef, parent ) {
  const tuplets = new Map();
  measure.filter( placed => placed.event.tuplet ).forEach( placed => {
    const members = tuplets.get( placed.event.tuplet ) || [];
    tuplets.set( placed.event.tuplet, [ ...members, placed ] );
  });
  tuplets.forEach( ( members, tuplet ) => {
    const above = clef === "treble";
    const direction = above ? -1 : 1;
    const left_x = members[ 0 ].drawn.x;
    const right_x = members.at( -1 ).drawn.x + ( members.at( -1 ).rest ? 1.2 : headWidthOf( members.at( -1 ) ) ) * SPACE;
    const outermost = members.map( placed => {
      if ( placed.rest )
        return above ? top : top + 4 * SPACE;
      const head_y = yOfStep( top, above ? Math.max( ...placed.steps ) : Math.min( ...placed.steps ) );
      const tip_y = placed.stem === ( above ? "up" : "down" ) ? placed.stemTipY : head_y;
      return above ? Math.min( head_y - SPACE, tip_y ) : Math.max( head_y + SPACE, tip_y );
    });
    const edge_y = above ? Math.min( top, ...outermost ) - 1.2 * SPACE : Math.max( top + 4 * SPACE, ...outermost ) + 1.2 * SPACE;
    const center_x = ( left_x + right_x ) / 2;
    const number_y = edge_y + 0.55 * SPACE;
    drawGlyph( String( tuplet.count ).split( "" ).map( digit => String.fromCharCode( 0xE880 + Number( digit ) ) ).join( "" ), center_x, number_y, parent, "glyph centered tupletNumber" );
    const gap = 1.1 * SPACE;
    const hook = 0.7 * SPACE * -direction;
    drawLine( left_x, edge_y + hook, left_x, edge_y, 0.12, parent );
    drawLine( left_x, edge_y, center_x - gap, edge_y, 0.12, parent );
    drawLine( center_x + gap, edge_y, right_x, edge_y, 0.12, parent );
    drawLine( right_x, edge_y, right_x, edge_y + hook, 0.12, parent );
  });
}

function drawRepeatDots( x, system, parent ) {
  system.staffTops.forEach( staff_top => [ 3, 5 ].forEach( step => {
    svgElement( "circle", { cx: x, cy: yOfStep( system.y + staff_top, step ), r: 0.25 * SPACE }, parent );
  }));
}

function drawRepeatStart( x, system, joins_an_ending, parent ) {
  const top = system.y + system.staffTops[ 0 ];
  const bottom = system.y + system.staffTops.at( -1 ) + 4 * SPACE;
  if ( !joins_an_ending )
    drawLine( x + 0.25 * SPACE, top, x + 0.25 * SPACE, bottom, 0.5, parent );
  drawLine( x + 0.95 * SPACE, top, x + 0.95 * SPACE, bottom, 0.16, parent );
  drawRepeatDots( x + 1.5 * SPACE, system, parent );
}

function drawRepeatEnd( x, system, parent ) {
  const top = system.y + system.staffTops[ 0 ];
  const bottom = system.y + system.staffTops.at( -1 ) + 4 * SPACE;
  drawRepeatDots( x - 1.6 * SPACE, system, parent );
  drawLine( x - 1.05 * SPACE, top, x - 1.05 * SPACE, bottom, 0.16, parent );
  drawLine( x - 0.25 * SPACE, top, x - 0.25 * SPACE, bottom, 0.5, parent );
}

function slurChainsOf( events ) {
  const chains = [];
  let chain = null;
  events.filter( event => !event.rest && event.pieces ).forEach( event => {
    if ( chain )
      chain.push( event );
    else if ( event.slur )
      chain = [ event ];
    if ( chain && !event.slur ) {
      chains.push( chain );
      chain = null;
    }
  });
  return chains.filter( found => found.length > 1 );
}

function slurEndOf( placed, above ) {
  const head_y = yOfStep( placed.drawn.top, above ? Math.max( ...placed.steps ) : Math.min( ...placed.steps ) );
  const clears_head = above ? head_y - 0.9 * SPACE : head_y + 0.9 * SPACE;
  const stem_on_this_side = placed.stem === ( above ? "up" : "down" );
  if ( !stem_on_this_side )
    return clears_head;
  return above ? Math.min( clears_head, placed.stemTipY - 0.5 * SPACE ) : Math.max( clears_head, placed.stemTipY + 0.5 * SPACE );
}

function drawSlurPart( notes, from_x, to_x, above, parent ) {
  const direction = above ? -1 : 1;
  const from_y = slurEndOf( notes[ 0 ], above );
  const to_y = slurEndOf( notes.at( -1 ), above );
  const lineYAt = x => from_y + ( to_y - from_y ) * ( x - from_x ) / Math.max( 1, to_x - from_x );
  const intrusion = Math.max( 0, ...notes.slice( 1, -1 ).map( placed => ( slurEndOf( placed, above ) - lineYAt( placed.drawn.x ) ) * direction ) );
  const height = Math.max( Math.min( 3 * SPACE, ( to_x - from_x ) * 0.15 ), 1.4 * SPACE, 2 * intrusion + SPACE );
  drawCurve( from_x, from_y, to_x, to_y, height, direction, parent );
}

function drawSlursOfStaff( staff, parent ) {
  slurChainsOf( staff.events ).forEach( chain => {
    const notes = chain.flatMap( event => event.pieces ).filter( placed => placed.drawn );
    const first = chain[ 0 ].pieces[ 0 ];
    const last = chain.at( -1 ).pieces[ 0 ];
    const span = notes.slice( 0, notes.indexOf( last ) + 1 );
    const above = !span.every( placed => placed.stem === "up" );
    const centerOf = placed => placed.drawn.x + headWidthOf( placed ) * SPACE / 2;
    const systems = [ ...new Set( span.map( placed => placed.drawn.system ) ) ];
    systems.forEach( system => {
      const part = span.filter( placed => placed.drawn.system === system );
      const starts_here = part[ 0 ] === first;
      const ends_here = part.at( -1 ) === last;
      const from_x = starts_here ? centerOf( first ) : part[ 0 ].drawn.x - 2 * SPACE;
      const to_x = ends_here ? centerOf( last ) : PAGE_MARGIN + system.width * SPACE + 0.5 * SPACE;
      drawSlurPart( part, from_x, to_x, above, part[ 0 ].group );
    });
  });
}

function drawMeasure( layout, system, staves, parent ) {
  staves.forEach( ( staff, staff_index ) => {
    const top = system.y + system.staffTops[ staff_index ];
    const measure = layout.measureOnEachStaff[ staff_index ];
    measure.forEach( placed => {
      const column = layout.columns.find( candidate => Math.abs( candidate.onset - placed.start ) < EPSILON );
      const x = PAGE_MARGIN + column.x * SPACE;
      const group = svgElement( "g", {}, parent );
      placed.event.marks.push( group );
      placed.group = group;
      placed.drawn = { x, top, system };
      if ( placed.rest )
        drawRest( placed, x, top, layout, group );
      else
        drawNote( placed, x, top, group );
    });
    measure.beams.forEach( beam => drawBeam( beam, top, svgElement( "g", {}, parent ) ) );
    measure.forEach( placed => {
      drawArticulations( placed, top, placed.group );
      drawFermata( placed, top, layout, placed.group );
      if ( !placed.rest )
        drawSlide( placed, top, placed.group );
    });
    drawTuplets( measure, top, staff.clef, svgElement( "g", {}, parent ) );
  });
}

function drawTitleBlock( sheet, parent ) {
  const room = PAGE_WIDTH - 2 * PAGE_MARGIN;
  if ( sheet.title )
    fitText( drawText( sheet.title, PAGE_WIDTH / 2, PAGE_MARGIN + 22, "title", parent ), room );
  if ( sheet.author )
    fitText( drawText( sheet.author, PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN + 58, "author", parent ), room );
}

function drawTempo( sheet, system, parent ) {
  const x = PAGE_MARGIN + ( system.header + 0.5 ) * SPACE;
  const y = system.y - 3 * SPACE;
  drawGlyph( GLYPHS.metronomeQuarter, x, y, parent );
  drawText( `= ${ sheet.bpm }`, x + 1.8 * SPACE, y, "tempo", parent );
}

function drawPage( page, page_index, staves, sheet, is_last_page ) {
  const svg = svgElement( "svg", { viewBox: `0 0 ${ PAGE_WIDTH } ${ PAGE_HEIGHT }`, class: "page" }, SCORE );
  if ( page_index === 0 )
    drawTitleBlock( sheet, svg );
  page.systems.forEach( ( system, system_index ) => {
    system.page = svg;
    const is_first_system = page_index === 0 && system_index === 0;
    const is_last_system = is_last_page && system_index === page.systems.length - 1;
    const right = PAGE_MARGIN + system.width * SPACE;
    staves.forEach( ( staff, index ) => drawStaffLines( PAGE_MARGIN, right, system.y + system.staffTops[ index ], svg ) );
    drawSystemHeader( system, staves, sheet, is_first_system, svg );
    if ( is_first_system )
      drawTempo( sheet, system, svg );
    system.measures.forEach( ( layout, index ) => {
      const previous = system.measures[ index - 1 ];
      if ( layout.repeatStart )
        drawRepeatStart( PAGE_MARGIN + layout.x * SPACE, system, Boolean( previous?.repeatEnd ), svg );
      drawMeasure( layout, system, staves, svg );
      const is_final = is_last_system && index === system.measures.length - 1;
      const end_x = PAGE_MARGIN + ( layout.x + layout.width ) * SPACE;
      if ( layout.repeatEnd )
        drawRepeatEnd( end_x, system, svg );
      if ( layout.loopEnd )
        drawText( "∞", end_x, system.y + system.staffTops[ 0 ] - 1.4 * SPACE, "loopMark", svg );
      else
        drawBarline( end_x, system, is_final, svg );
    });
  });
  return svg;
}

function playheadStopsOf( systems, measure_length ) {
  return systems.flatMap( system => {
    const stops = system.measures.flatMap( layout => layout.columns.map( column => ( {
      time: layout.index * measure_length + column.onset,
      x: PAGE_MARGIN + ( column.x + 0.6 ) * SPACE,
      system
    } ) ) );
    const last_measure = system.measures.at( -1 );
    stops.push( { time: ( last_measure.index + 1 ) * measure_length, x: PAGE_MARGIN + system.width * SPACE, system } );
    return stops;
  });
}

function repeatSignsOf( sheet ) {
  const loop = sheet.loop ? [ { kind: "start", position: sheet.loop.start, loop: true }, { kind: "end", position: sheet.loop.end, loop: true } ] : [];
  return [ ...sheet.repeats, ...loop ];
}

function withRepeatSigns( layout, repeats, measure_length ) {
  const isAt = ( sign, position ) => Math.abs( sign.position - position ) < EPSILON;
  layout.loopEnd = repeats.some( sign => sign.loop && sign.kind === "end" && isAt( sign, ( layout.index + 1 ) * measure_length ) );
  layout.repeatStart = repeats.some( sign => sign.kind === "start" && isAt( sign, layout.index * measure_length ) );
  layout.repeatEnd = repeats.some( sign => sign.kind === "end" && isAt( sign, ( layout.index + 1 ) * measure_length ) );
  if ( layout.repeatStart )
    layout.opening += 1.8;
  if ( layout.repeatEnd ) {
    layout.columns.at( -1 ).width += 1.8;
    layout.stretchable += 1.8;
  }
  return layout;
}

function scrollToNewPage( pages_before ) {
  if ( !pages_before || SCORE.children.length !== pages_before + 1 )
    return;
  const new_page = SCORE.children[ pages_before ];
  SCORE.scrollTop += new_page.getBoundingClientRect().top - SCORE.getBoundingClientRect().top;
}

function renderScore( sheet ) {
  const pages_before = SCORE.children.length;
  const scrolled_to = SCORE.scrollTop;
  SCORE.replaceChildren();
  const staves = prepareStaves( sheet );
  const measure_length = measureLengthOf( sheet.meter );
  const layouts = staves[ 0 ].measures.map( ( measure, index ) => withRepeatSigns( {
    ...layoutMeasure( staves.map( staff => staff.measures[ index ] ), measure_length ),
    index
  }, repeatSignsOf( sheet ), measure_length ) );
  const systems = breakIntoSystems( layouts, sheet );
  systems.forEach( system => stackStaves( system, staves ) );
  const pages = arrangeOnPages( systems, sheet );
  pages.forEach( ( page, index ) => drawPage( page, index, staves, sheet, index === pages.length - 1 ) );
  staves.forEach( staff => drawTiesOfStaff( staff.measures ) );
  staves.forEach( staff => drawSlursOfStaff( staff ) );
  PLAYHEAD_STOPS = playheadStopsOf( systems, measure_length );
  SCORE.scrollTop = scrolled_to;
  scrollToNewPage( pages_before );
}
