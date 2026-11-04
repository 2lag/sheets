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

let playheadStops = [];

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

function drawGlyph( glyph, x, y, parent, className = "glyph" ) {
  svgElement( "text", { x, y, class: className }, parent ).textContent = glyph;
}

function drawText( content, x, y, className, parent ) {
  const text = svgElement( "text", { x, y, class: className }, parent );
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

function yOfStep( staffTop, step ) {
  return staffTop + ( 8 - step ) * SPACE / 2;
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

function measuresOf( events, measureLength, measureCount ) {
  const measures = Array.from( { length: measureCount }, () => [] );
  let position = 0;
  let previous = null;

  const placeEvent = ( event, totalLength ) => {
    let remaining = totalLength;
    const pieces = [];
    while ( remaining > EPSILON ) {
      const index = Math.floor( position / measureLength + EPSILON );
      const start = position - index * measureLength;
      const room = measureLength - start;
      const fitsAsWritten = remaining === totalLength && remaining <= room + EPSILON && !event.padding;
      const notatedPieces = fitsAsWritten ? [ event ] : notatedPiecesOf( Math.min( remaining, room ) );
      notatedPieces.forEach( piece => {
        const isFirstPiece = remaining === totalLength;
        const placed = {
          event,
          rest: event.rest,
          pitches: event.pitches,
          graces: isFirstPiece ? event.graces || [] : [],
          duration: piece.duration,
          dots: piece.dots,
          start: position - index * measureLength,
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
  const padding = measureCount * measureLength - position;
  if ( padding > EPSILON )
    placeEvent( { rest: true, pitches: [], padding: true, marks: [] }, padding );

  return measures.map( measure => wholeMeasureRestOr( measure, measureLength ) );
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

function wholeMeasureRestOr( measure, measureLength ) {
  if ( !measure.every( placed => placed.rest ) )
    return measure;
  const fermata = measure.some( placed => placed.fermata );
  return [ { event: measure[ 0 ].event, rest: true, wholeMeasure: true, fermata, articulations: [], pitches: [], duration: 1, dots: 0, start: 0, length: measureLength } ];
}

function beatLengthOf( meter ) {
  const isCompound = meter.unit >= 8 && meter.beats % 3 === 0 && meter.beats > 3;
  if ( isCompound )
    return 3 / meter.unit;
  if ( meter.unit >= 8 )
    return measureLengthOf( meter );
  return 1 / meter.unit;
}

function beamGroupsOf( measure, beatLength ) {
  const groups = [];
  let current = [];
  let currentBeat = -1;
  const closeGroup = () => {
    if ( current.length > 1 )
      groups.push( current );
    current = [];
  };
  measure.forEach( placed => {
    const beat = Math.floor( placed.start / beatLength + EPSILON );
    const isBeamable = !placed.rest && placed.duration >= 8;
    if ( !isBeamable || beat !== currentBeat )
      closeGroup();
    if ( isBeamable ) {
      current.push( placed );
      currentBeat = beat;
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
  return showInC ? 0 : sheet.key.fifths;
}

function markAccidentals( measure, fifths ) {
  const alterations = {};
  const accidentalFor = ( pitch, isContinuingTie ) => {
    const name = pitch.letter + pitch.octave;
    const expected = name in alterations ? alterations[ name ] : keyAlterOf( pitch.letter, fifths );
    alterations[ name ] = pitch.alter;
    const needsSign = pitch.alter !== expected || ( showInC && pitch.alter !== 0 );
    return needsSign && !isContinuingTie ? pitch.alter : null;
  };
  measure.forEach( placed => {
    placed.graceAccidentals = ( placed.graces || [] ).map( pitch => accidentalFor( pitch, false ) );
    placed.accidentals = placed.pitches.map( pitch => accidentalFor( pitch, placed.continuesTie ) );
  });
}

function arrangeHeads( placed ) {
  const headWidth = headWidthOf( placed );
  const goingUp = placed.stem !== "down";
  const heads = placed.pitches
    .map( ( pitch, index ) => ( { pitch, step: placed.steps[ index ], accidental: placed.accidentals[ index ], offset: 0 } ) )
    .sort( ( a, b ) => goingUp ? a.step - b.step : b.step - a.step );
  heads.forEach( ( head, index ) => {
    const neighbor = heads[ index - 1 ];
    if ( neighbor && Math.abs( head.step - neighbor.step ) === 1 && neighbor.offset === 0 )
      head.offset = goingUp ? headWidth - 0.12 : -( headWidth - 0.12 );
  });
  return heads;
}

function arrangeAccidentals( heads ) {
  const columns = [];
  heads
    .filter( head => head.accidental !== null )
    .sort( ( a, b ) => b.step - a.step )
    .forEach( head => {
      let column = columns.findIndex( stepsInColumn => stepsInColumn.every( step => Math.abs( step - head.step ) >= 6 ) );
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
    const accidentalColumns = arrangeAccidentals( placed.heads );
    const flagRoom = placed.beamCount && !placed.beam && placed.stem === "up" ? 1.1 : 0;
    const dotRoom = placed.dots ? 0.4 + placed.dots * 0.6 : 0;
    const widestAccidental = Math.max( 1.1, ...placed.heads.filter( head => head.accidental !== null ).map( head => ACCIDENTAL_WIDTHS[ head.accidental ] ) );
    placed.leading = ( accidentalColumns ? accidentalColumns * 1.1 + widestAccidental - 1.1 + 0.25 : 0 ) - leftmostHeadOf( placed );
    const slideRoom = placed.fall || placed.rise ? 2.6 : 0;
    const tieRoom = placed.tied ? 1.8 : 0;
    placed.trailing = rightmostHeadOf( placed ) + headWidthOf( placed ) + Math.max( flagRoom, dotRoom ) + slideRoom + tieRoom;
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
  const measureLength = measureLengthOf( sheet.meter );
  const longestStaff = Math.max( ...sheet.staves.map( staffLengthOf ) );
  const measureCount = Math.max( 1, Math.ceil( longestStaff / measureLength - EPSILON ) );
  return sheet.staves.map( staff => {
    staff.events.forEach( event => event.marks = [] );
    const measures = measuresOf( staff.events, measureLength, measureCount );
    measures.forEach( measure => prepareMeasure( measure, staff.clef, sheet ) );
    return { clef: staff.clef, measures, events: staff.events };
  });
}

function spaceFor( length ) {
  return 4 * Math.sqrt( length * 4 );
}

function layoutMeasure( measureOnEachStaff, measureLength ) {
  const everything = measureOnEachStaff.flat();
  const onsets = [ ...new Set( everything.map( placed => placed.start.toFixed( 6 ) ) ) ].map( Number ).sort( ( a, b ) => a - b );
  const columns = onsets.map( ( onset, index ) => {
    const items = everything.filter( placed => Math.abs( placed.start - onset ) < EPSILON );
    return {
      onset,
      items,
      leading: Math.max( ...items.map( placed => placed.leading ) ),
      trailing: Math.max( ...items.map( placed => placed.trailing ) ),
      natural: spaceFor( ( onsets[ index + 1 ] ?? measureLength ) - onset )
    };
  });
  columns.forEach( ( column, index ) => {
    const nextLeading = index + 1 < columns.length ? columns[ index + 1 ].leading : 0.6;
    column.width = Math.max( column.natural, column.trailing + 0.6 + nextLeading );
  });
  const opening = 1.4 + columns[ 0 ].leading;
  const stretchable = columns.reduce( ( total, column ) => total + column.width, 0 );
  return { columns, opening, stretchable, measureOnEachStaff };
}

function keySignatureWidthOf( fifths ) {
  return Math.abs( fifths ) * ( fifths > 0 ? 1.1 : 1 );
}

function timeSignatureWidthOf( meter ) {
  const widthOfNumber = number => String( number ).split( "" ).reduce( ( total, digit ) => total + TIME_DIGIT_WIDTHS[ digit ], 0 );
  return Math.max( widthOfNumber( meter.beats ), widthOfNumber( meter.unit ) );
}

function headerWidthOf( sheet, isFirstSystem ) {
  const timeSignature = isFirstSystem ? timeSignatureWidthOf( sheet.meter ) + 1 : 0;
  return 1 + 2.75 + 1 + keySignatureWidthOf( writtenFifthsOf( sheet ) ) + timeSignature;
}

function breakIntoSystems( measureLayouts, sheet ) {
  const lineWidth = ( PAGE_WIDTH - 2 * PAGE_MARGIN ) / SPACE;
  const systems = [];
  let current = null;
  measureLayouts.forEach( ( layout, index ) => {
    const naturalWidth = layout.opening + layout.stretchable;
    if ( current && current.used + naturalWidth > current.available )
      current = null;
    if ( !current ) {
      const header = headerWidthOf( sheet, systems.length === 0 );
      current = { header, available: lineWidth - header, used: 0, measures: [], firstMeasureNumber: index + 1 };
      systems.push( current );
    }
    current.measures.push( layout );
    current.used += naturalWidth;
  });
  systems.forEach( ( system, index ) => justifySystem( system, index === systems.length - 1 ) );
  return systems;
}

function justifySystem( system, isLastSystem ) {
  const opening = system.measures.reduce( ( total, layout ) => total + layout.opening, 0 );
  const stretchable = system.measures.reduce( ( total, layout ) => total + layout.stretchable, 0 );
  const fullStretch = ( system.available - opening ) / stretchable;
  const isMostlyFull = system.used / system.available > 0.6;
  const stretch = isLastSystem && !isMostlyFull ? 1 : fullStretch;
  let x = system.header;
  system.measures.forEach( layout => {
    layout.x = x;
    let columnX = x + layout.opening;
    layout.columns.forEach( column => {
      column.x = columnX;
      columnX += column.width * stretch;
    });
    layout.width = columnX - x;
    x = columnX;
  });
  system.width = x;
}

function verticalExtentOf( measuresOfStaff ) {
  const steps = measuresOfStaff.flat().filter( placed => !placed.rest ).flatMap( placed => {
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
  const titleRoom = sheet.title || sheet.author ? 90 : 20;
  let y = PAGE_MARGIN + titleRoom + 16;
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
    const numberWidth = digits.reduce( ( total, digit ) => total + TIME_DIGIT_WIDTHS[ digit ], 0 );
    let digitX = x + ( width - numberWidth ) / 2 * SPACE;
    digits.forEach( digit => {
      drawGlyph( String.fromCharCode( 0xE080 + Number( digit ) ), digitX, yOfStep( top, step ), parent );
      digitX += TIME_DIGIT_WIDTHS[ digit ] * SPACE;
    });
  };
  drawNumber( meter.beats, 6 );
  drawNumber( meter.unit, 2 );
}

function drawSystemHeader( system, staves, sheet, isFirstSystem, parent ) {
  const left = PAGE_MARGIN;
  staves.forEach( ( staff, index ) => {
    const top = system.y + system.staffTops[ index ];
    const clef = CLEFS[ staff.clef ];
    drawGlyph( clef.glyph, left + SPACE, yOfStep( top, clef.glyphStep ), parent );
    const keyX = left + ( 1 + clef.width + 1 ) * SPACE;
    drawKeySignature( staff.clef, writtenFifthsOf( sheet ), keyX, top, parent );
    if ( isFirstSystem )
      drawTimeSignature( sheet.meter, keyX + ( keySignatureWidthOf( writtenFifthsOf( sheet ) ) + 0.6 ) * SPACE, top, parent );
  });
  const firstTop = system.y + system.staffTops[ 0 ];
  const lastBottom = system.y + system.staffTops.at( -1 ) + 4 * SPACE;
  if ( staves.length > 1 ) {
    drawLine( left, firstTop, left, lastBottom, 0.16, parent );
    const tallness = ( lastBottom - firstTop ) / ( 4 * SPACE );
    const wideness = Math.sqrt( tallness ) * 0.9;
    const braceX = left - ( 0.35 + 1.31 * wideness ) * SPACE;
    const brace = svgElement( "text", {
      class: "glyph",
      transform: `translate( ${ braceX } ${ lastBottom } ) scale( ${ wideness } ${ tallness } )`
    }, parent );
    brace.textContent = GLYPHS.brace;
  }
  if ( !isFirstSystem )
    drawText( system.firstMeasureNumber, left, firstTop - 2.4 * SPACE, "measureNumber", parent );
}

function drawBarline( x, system, isFinal, parent ) {
  const top = system.y + system.staffTops[ 0 ];
  const bottom = system.y + system.staffTops.at( -1 ) + 4 * SPACE;
  if ( !isFinal ) {
    drawLine( x, top, x, bottom, 0.16, parent );
    return;
  }
  drawLine( x - 0.25 * SPACE, top, x - 0.25 * SPACE, bottom, 0.5, parent );
  drawLine( x - 1.05 * SPACE, top, x - 1.05 * SPACE, bottom, 0.16, parent );
}

function drawLedgerLines( placed, x, top, parent ) {
  const headWidth = headWidthOf( placed );
  const left = x + ( leftmostHeadOf( placed ) - 0.4 ) * SPACE;
  const right = x + ( rightmostHeadOf( placed ) + headWidth + 0.4 ) * SPACE;
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
  const columnRight = x + ( leftmostHeadOf( placed ) - 0.25 - head.accidentalColumn * 1.1 ) * SPACE;
  drawGlyph( ACCIDENTAL_GLYPHS[ head.accidental ], columnRight - ACCIDENTAL_WIDTHS[ head.accidental ] * SPACE, y, parent );
}

function drawDots( head, placed, x, top, parent ) {
  const step = head.step % 2 === 0 ? head.step + 1 : head.step;
  const firstDotX = x + ( rightmostHeadOf( placed ) + headWidthOf( placed ) + 0.4 ) * SPACE;
  for ( let dot = 0; dot < placed.dots; dot++ )
    drawGlyph( GLYPHS.dot, firstDotX + dot * 0.6 * SPACE, yOfStep( top, step ), parent );
}

function drawGraceLedgerLines( step, x, top, parent ) {
  const ledgerSteps = [];
  for ( let ledger = -2; ledger >= step; ledger -= 2 )
    ledgerSteps.push( ledger );
  for ( let ledger = 10; ledger <= step; ledger += 2 )
    ledgerSteps.push( ledger );
  const width = 1.18 * GRACE_SIZE;
  ledgerSteps.forEach( ledger => drawLine( x - 0.25 * SPACE, yOfStep( top, ledger ), x + ( width + 0.25 ) * SPACE, yOfStep( top, ledger ), 0.12, parent ) );
}

function drawGraces( placed, x, top, parent ) {
  if ( !placed.graces.length )
    return;
  const stemTop = yOfStep( top, Math.max( ...placed.graceSteps ) + 5 );
  const headWidth = 1.18 * GRACE_SIZE * SPACE;
  let graceX = x - ( placed.leading - 0.2 ) * SPACE;
  const stems = placed.graceSteps.map( ( step, index ) => {
    const accidental = placed.graceAccidentals[ index ];
    const y = yOfStep( top, step );
    if ( accidental !== null ) {
      drawGlyph( ACCIDENTAL_GLYPHS[ accidental ], graceX, y, parent, "glyph grace" );
      graceX += graceAccidentalWidthOf( accidental ) * SPACE;
    }
    drawGraceLedgerLines( step, graceX, top, parent );
    drawGlyph( GLYPHS.noteheadBlack, graceX, y, parent, "glyph grace" );
    const stemX = graceX + headWidth - 0.05 * SPACE;
    drawLine( stemX, y, stemX, stemTop, 0.09, parent );
    graceX += GRACE_ADVANCE * SPACE;
    return stemX;
  });
  if ( stems.length === 1 ) {
    drawGlyph( FLAG_GLYPHS.up[ 8 ], stems[ 0 ] - 0.05 * SPACE, stemTop, parent, "glyph grace" );
    drawLine( stems[ 0 ] - 0.6 * SPACE, stemTop + 1.9 * SPACE, stems[ 0 ] + 0.9 * SPACE, stemTop + 0.7 * SPACE, 0.1, parent );
    return;
  }
  [ 0, 0.5 ].forEach( offset => {
    const y = stemTop + offset * SPACE;
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
  const extraForFlags = Math.max( 0, placed.beamCount - 1 );
  const stemEnd = placed.stem === "up" ? Math.max( highest + 7 + extraForFlags, 4 ) : Math.min( lowest - 7 - extraForFlags, 4 );
  const stemStart = placed.stem === "up" ? lowest : highest;
  placed.stemTipY = yOfStep( top, stemEnd );
  drawLine( placed.stemX, yOfStep( top, stemStart ), placed.stemX, yOfStep( top, stemEnd ), 0.12, parent );
  if ( placed.beamCount )
    drawGlyph( FLAG_GLYPHS[ placed.stem ][ placed.duration ], placed.stemX - 0.06 * SPACE, yOfStep( top, stemEnd ), parent );
}

function drawRest( placed, x, top, measureLayout, parent ) {
  if ( placed.wholeMeasure ) {
    const centerX = measureLayout.x * SPACE + PAGE_MARGIN + measureLayout.width * SPACE / 2;
    drawGlyph( REST_GLYPHS[ 1 ], centerX - 0.56 * SPACE, yOfStep( top, 6 ), parent );
    return;
  }
  const step = placed.duration === 1 ? 6 : 4;
  drawGlyph( REST_GLYPHS[ placed.duration ], x, yOfStep( top, step ), parent );
  for ( let dot = 0; dot < placed.dots; dot++ )
    drawGlyph( GLYPHS.dot, x + ( 1.5 + dot * 0.6 ) * SPACE, yOfStep( top, 5 ), parent );
}

function drawBeam( beam, top, parent ) {
  const notes = beam.notes;
  const goingUp = beam.direction === "up";
  const outerStepOf = placed => goingUp ? Math.max( ...placed.steps ) : Math.min( ...placed.steps );
  const innerStepOf = placed => goingUp ? Math.min( ...placed.steps ) : Math.max( ...placed.steps );
  const first = notes[ 0 ];
  const last = notes.at( -1 );
  const run = last.stemX - first.stemX;
  const outerSteps = notes.map( outerStepOf );
  const interiorIsMoreExtreme = outerSteps.slice( 1, -1 ).some( step => goingUp ? step > Math.max( outerSteps[ 0 ], outerSteps.at( -1 ) ) : step < Math.min( outerSteps[ 0 ], outerSteps.at( -1 ) ) );
  const rise = interiorIsMoreExtreme ? 0 : Math.max( -2, Math.min( 2, outerSteps.at( -1 ) - outerSteps[ 0 ] ) );
  const slope = run > 0 ? -rise * SPACE / 2 / run : 0;
  const beamCount = Math.max( ...notes.map( placed => placed.beamCount ) );
  const stemLength = ( 3.25 + ( beamCount - 1 ) * 0.75 ) * SPACE;
  const middleY = yOfStep( top, 4 );
  const startYs = notes.map( placed => {
    const headY = yOfStep( top, outerStepOf( placed ) );
    const reach = goingUp ? Math.min( headY - stemLength, middleY ) : Math.max( headY + stemLength, middleY );
    return reach - slope * ( placed.stemX - first.stemX );
  });
  const startY = goingUp ? Math.min( ...startYs ) : Math.max( ...startYs );
  const beamYAt = x => startY + slope * ( x - first.stemX );
  const towardHeads = goingUp ? 1 : -1;
  const thickness = 0.5 * SPACE;

  notes.forEach( placed => {
    placed.stemTipY = beamYAt( placed.stemX );
    drawLine( placed.stemX, yOfStep( top, innerStepOf( placed ) ), placed.stemX, placed.stemTipY, 0.12, placed.group );
  });

  const drawSegment = ( fromX, toX, level ) => {
    const offset = level * 0.75 * SPACE * towardHeads;
    const edge = [ [ fromX, beamYAt( fromX ) + offset ], [ toX, beamYAt( toX ) + offset ] ];
    drawPolygon( [ ...edge, ...edge.reverse().map( ( [ x, y ] ) => [ x, y + thickness * towardHeads ] ) ], parent );
  };
  const half = 0.06 * SPACE;
  drawSegment( first.stemX - half, last.stemX + half, 0 );

  for ( let level = 1; level < beamCount; level++ ) {
    let runStart = null;
    notes.forEach( ( placed, index ) => {
      const reaches = placed.beamCount > level;
      if ( reaches && runStart === null )
        runStart = index;
      const runEnds = runStart !== null && ( !reaches || index === notes.length - 1 );
      if ( !runEnds )
        return;
      const runEnd = reaches ? index : index - 1;
      const from = notes[ runStart ];
      const to = notes[ runEnd ];
      if ( runStart !== runEnd )
        drawSegment( from.stemX - half, to.stemX + half, level );
      else if ( runStart === 0 )
        drawSegment( from.stemX - half, from.stemX + 1.1 * SPACE, level );
      else
        drawSegment( from.stemX - 1.1 * SPACE, from.stemX + half, level );
      runStart = null;
    });
  }
}

function drawCurve( fromX, fromY, toX, toY, height, direction, parent ) {
  const thickness = 0.4 * SPACE;
  const middleX = ( fromX + toX ) / 2;
  const middleY = ( fromY + toY ) / 2;
  const outer = `Q ${ middleX } ${ middleY + height * direction } ${ toX } ${ toY }`;
  const inner = `Q ${ middleX } ${ middleY + ( height - thickness ) * direction } ${ fromX } ${ fromY }`;
  svgElement( "path", { d: `M ${ fromX } ${ fromY } ${ outer } ${ inner } Z`, class: "tie" }, parent );
}

function drawTie( fromX, toX, y, direction, parent ) {
  const height = Math.max( 1.1 * SPACE, Math.min( 3 * SPACE, ( toX - fromX ) * 0.25 ) );
  drawCurve( fromX, y, toX, y, height, direction, parent );
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
    const fromX = placed.drawn.x + ( rightmostHeadOf( placed ) + headWidthOf( placed ) + 0.2 ) * SPACE;
    const toX = next.drawn.x + ( leftmostHeadOf( next ) - 0.2 ) * SPACE;
    placed.heads.forEach( head => {
      const target = next.heads.find( other => midiOf( other.pitch ) === midiOf( head.pitch ) );
      if ( !target )
        return;
      const direction = tieDirectionOf( placed, head );
      const fromY = yOfStep( placed.drawn.top, head.step ) + direction * 0.6 * SPACE;
      if ( placed.drawn.system === next.drawn.system ) {
        drawTie( fromX, toX, fromY, direction, placed.group );
        return;
      }
      const systemEnd = PAGE_MARGIN + placed.drawn.system.width * SPACE;
      drawTie( fromX, systemEnd + SPACE, fromY, direction, placed.group );
      const nextY = yOfStep( next.drawn.top, target.step ) + direction * 0.6 * SPACE;
      drawTie( next.drawn.x - 2.5 * SPACE, toX, nextY, direction, next.group );
    });
  });
}

function spaceAwayFromLines( step, direction ) {
  const isOnLineInsideStaff = step >= 0 && step <= 8 && step % 2 === 0;
  return isOnLineInsideStaff ? step + direction : step;
}

function articulationSideOf( placed ) {
  return placed.stem === "up" ? "below" : "above";
}

function drawArticulations( placed, top, parent ) {
  if ( !placed.articulations?.length || placed.rest )
    return;
  const side = articulationSideOf( placed );
  const direction = side === "above" ? 1 : -1;
  const centerX = placed.drawn.x + headWidthOf( placed ) * SPACE / 2;
  let step = ( side === "above" ? Math.max( ...placed.steps ) : Math.min( ...placed.steps ) ) + 2 * direction;
  [ "staccato", "tenuto", "accent" ]
    .filter( articulation => placed.articulations.includes( articulation ) )
    .forEach( articulation => {
      step = spaceAwayFromLines( step, direction );
      drawGlyph( ARTICULATION_GLYPHS[ articulation ][ side ], centerX, yOfStep( top, step ) + 0.5 * SPACE * ( side === "above" ? 0 : -0.2 ), parent, "glyph centered" );
      step += 2 * direction;
    });
}

function drawFermata( placed, top, measureLayout, parent ) {
  if ( !placed.fermata )
    return;
  const centerX = placed.wholeMeasure
    ? PAGE_MARGIN + ( measureLayout.x + measureLayout.width / 2 ) * SPACE
    : placed.drawn.x + ( placed.rest ? 0.6 : headWidthOf( placed ) / 2 ) * SPACE;
  const highestHead = placed.rest ? top : yOfStep( top, Math.max( ...placed.steps ) ) - SPACE;
  const stemTip = placed.stem === "up" ? placed.stemTipY : Infinity;
  const y = Math.min( top - 0.8 * SPACE, highestHead - 0.6 * SPACE, stemTip - 0.8 * SPACE );
  drawGlyph( FERMATA_GLYPH, centerX, y, parent, "glyph centered" );
}

function drawSlide( placed, top, parent ) {
  if ( !placed.fall && !placed.rise )
    return;
  const startX = placed.drawn.x + ( rightmostHeadOf( placed ) + headWidthOf( placed ) + 0.35 + ( placed.dots ? 0.4 + placed.dots * 0.6 : 0 ) ) * SPACE;
  const y = yOfStep( top, placed.fall ? Math.min( ...placed.steps ) : Math.max( ...placed.steps ) );
  const drop = placed.fall ? 1.8 * SPACE : -1.8 * SPACE;
  const endX = startX + 2 * SPACE;
  svgElement( "path", { d: `M ${ startX } ${ y } Q ${ startX + 1.4 * SPACE } ${ y } ${ endX } ${ y + drop }`, class: "slide" }, parent );
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
    const leftX = members[ 0 ].drawn.x;
    const rightX = members.at( -1 ).drawn.x + ( members.at( -1 ).rest ? 1.2 : headWidthOf( members.at( -1 ) ) ) * SPACE;
    const outermost = members.map( placed => {
      if ( placed.rest )
        return above ? top : top + 4 * SPACE;
      const headY = yOfStep( top, above ? Math.max( ...placed.steps ) : Math.min( ...placed.steps ) );
      const tipY = placed.stem === ( above ? "up" : "down" ) ? placed.stemTipY : headY;
      return above ? Math.min( headY - SPACE, tipY ) : Math.max( headY + SPACE, tipY );
    });
    const edgeY = above ? Math.min( top, ...outermost ) - 1.2 * SPACE : Math.max( top + 4 * SPACE, ...outermost ) + 1.2 * SPACE;
    const centerX = ( leftX + rightX ) / 2;
    const numberY = edgeY + 0.55 * SPACE;
    drawGlyph( String( tuplet.count ).split( "" ).map( digit => String.fromCharCode( 0xE880 + Number( digit ) ) ).join( "" ), centerX, numberY, parent, "glyph centered tupletNumber" );
    const gap = 1.1 * SPACE;
    const hook = 0.7 * SPACE * -direction;
    drawLine( leftX, edgeY + hook, leftX, edgeY, 0.12, parent );
    drawLine( leftX, edgeY, centerX - gap, edgeY, 0.12, parent );
    drawLine( centerX + gap, edgeY, rightX, edgeY, 0.12, parent );
    drawLine( rightX, edgeY, rightX, edgeY + hook, 0.12, parent );
  });
}

function drawRepeatDots( x, system, parent ) {
  system.staffTops.forEach( staffTop => [ 3, 5 ].forEach( step => {
    svgElement( "circle", { cx: x, cy: yOfStep( system.y + staffTop, step ), r: 0.25 * SPACE }, parent );
  }));
}

function drawRepeatStart( x, system, joinsAnEnding, parent ) {
  const top = system.y + system.staffTops[ 0 ];
  const bottom = system.y + system.staffTops.at( -1 ) + 4 * SPACE;
  if ( !joinsAnEnding )
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
  const headY = yOfStep( placed.drawn.top, above ? Math.max( ...placed.steps ) : Math.min( ...placed.steps ) );
  const clearsHead = above ? headY - 0.9 * SPACE : headY + 0.9 * SPACE;
  const stemOnThisSide = placed.stem === ( above ? "up" : "down" );
  if ( !stemOnThisSide )
    return clearsHead;
  return above ? Math.min( clearsHead, placed.stemTipY - 0.5 * SPACE ) : Math.max( clearsHead, placed.stemTipY + 0.5 * SPACE );
}

function drawSlurPart( notes, fromX, toX, above, parent ) {
  const direction = above ? -1 : 1;
  const fromY = slurEndOf( notes[ 0 ], above );
  const toY = slurEndOf( notes.at( -1 ), above );
  const lineYAt = x => fromY + ( toY - fromY ) * ( x - fromX ) / Math.max( 1, toX - fromX );
  const intrusion = Math.max( 0, ...notes.slice( 1, -1 ).map( placed => ( slurEndOf( placed, above ) - lineYAt( placed.drawn.x ) ) * direction ) );
  const height = Math.max( Math.min( 3 * SPACE, ( toX - fromX ) * 0.15 ), 1.4 * SPACE, 2 * intrusion + SPACE );
  drawCurve( fromX, fromY, toX, toY, height, direction, parent );
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
      const startsHere = part[ 0 ] === first;
      const endsHere = part.at( -1 ) === last;
      const fromX = startsHere ? centerOf( first ) : part[ 0 ].drawn.x - 2 * SPACE;
      const toX = endsHere ? centerOf( last ) : PAGE_MARGIN + system.width * SPACE + 0.5 * SPACE;
      drawSlurPart( part, fromX, toX, above, part[ 0 ].group );
    });
  });
}

function drawMeasure( layout, system, staves, parent ) {
  staves.forEach( ( staff, staffIndex ) => {
    const top = system.y + system.staffTops[ staffIndex ];
    const measure = layout.measureOnEachStaff[ staffIndex ];
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

function drawPage( page, pageIndex, staves, sheet, isLastPage ) {
  const svg = svgElement( "svg", { viewBox: `0 0 ${ PAGE_WIDTH } ${ PAGE_HEIGHT }`, class: "page" }, score );
  if ( pageIndex === 0 )
    drawTitleBlock( sheet, svg );
  page.systems.forEach( ( system, systemIndex ) => {
    system.page = svg;
    const isFirstSystem = pageIndex === 0 && systemIndex === 0;
    const isLastSystem = isLastPage && systemIndex === page.systems.length - 1;
    const right = PAGE_MARGIN + system.width * SPACE;
    staves.forEach( ( staff, index ) => drawStaffLines( PAGE_MARGIN, right, system.y + system.staffTops[ index ], svg ) );
    drawSystemHeader( system, staves, sheet, isFirstSystem, svg );
    if ( isFirstSystem )
      drawTempo( sheet, system, svg );
    system.measures.forEach( ( layout, index ) => {
      const previous = system.measures[ index - 1 ];
      if ( layout.repeatStart )
        drawRepeatStart( PAGE_MARGIN + layout.x * SPACE, system, Boolean( previous?.repeatEnd ), svg );
      drawMeasure( layout, system, staves, svg );
      const isFinal = isLastSystem && index === system.measures.length - 1;
      const endX = PAGE_MARGIN + ( layout.x + layout.width ) * SPACE;
      if ( layout.repeatEnd )
        drawRepeatEnd( endX, system, svg );
      if ( layout.loopEnd )
        drawText( "∞", endX, system.y + system.staffTops[ 0 ] - 1.4 * SPACE, "loopMark", svg );
      else
        drawBarline( endX, system, isFinal, svg );
    });
  });
  return svg;
}

function playheadStopsOf( systems, measureLength ) {
  return systems.flatMap( system => {
    const stops = system.measures.flatMap( layout => layout.columns.map( column => ( {
      time: layout.index * measureLength + column.onset,
      x: PAGE_MARGIN + ( column.x + 0.6 ) * SPACE,
      system
    } ) ) );
    const lastMeasure = system.measures.at( -1 );
    stops.push( { time: ( lastMeasure.index + 1 ) * measureLength, x: PAGE_MARGIN + system.width * SPACE, system } );
    return stops;
  });
}

function repeatSignsOf( sheet ) {
  const loop = sheet.loop ? [ { kind: "start", position: sheet.loop.start, loop: true }, { kind: "end", position: sheet.loop.end, loop: true } ] : [];
  return [ ...sheet.repeats, ...loop ];
}

function withRepeatSigns( layout, repeats, measureLength ) {
  const isAt = ( sign, position ) => Math.abs( sign.position - position ) < EPSILON;
  layout.loopEnd = repeats.some( sign => sign.loop && sign.kind === "end" && isAt( sign, ( layout.index + 1 ) * measureLength ) );
  layout.repeatStart = repeats.some( sign => sign.kind === "start" && isAt( sign, layout.index * measureLength ) );
  layout.repeatEnd = repeats.some( sign => sign.kind === "end" && isAt( sign, ( layout.index + 1 ) * measureLength ) );
  if ( layout.repeatStart )
    layout.opening += 1.8;
  if ( layout.repeatEnd ) {
    layout.columns.at( -1 ).width += 1.8;
    layout.stretchable += 1.8;
  }
  return layout;
}

function scrollToNewPage( pagesBefore ) {
  if ( !pagesBefore || score.children.length !== pagesBefore + 1 )
    return;
  const newPage = score.children[ pagesBefore ];
  score.scrollTop += newPage.getBoundingClientRect().top - score.getBoundingClientRect().top;
}

function renderScore( sheet ) {
  const pagesBefore = score.children.length;
  const scrolledTo = score.scrollTop;
  score.replaceChildren();
  const staves = prepareStaves( sheet );
  const measureLength = measureLengthOf( sheet.meter );
  const layouts = staves[ 0 ].measures.map( ( measure, index ) => withRepeatSigns( {
    ...layoutMeasure( staves.map( staff => staff.measures[ index ] ), measureLength ),
    index
  }, repeatSignsOf( sheet ), measureLength ) );
  const systems = breakIntoSystems( layouts, sheet );
  systems.forEach( system => stackStaves( system, staves ) );
  const pages = arrangeOnPages( systems, sheet );
  pages.forEach( ( page, index ) => drawPage( page, index, staves, sheet, index === pages.length - 1 ) );
  staves.forEach( staff => drawTiesOfStaff( staff.measures ) );
  staves.forEach( staff => drawSlursOfStaff( staff ) );
  playheadStops = playheadStopsOf( systems, measureLength );
  score.scrollTop = scrolledTo;
  scrollToNewPage( pagesBefore );
}
