const MAJOR_KEY_FIFTHS = {
  c: 0, g: 1, d: 2, a: 3, e: 4, b: 5, fs: 6, cs: 7,
  f: -1, bb: -2, eb: -3, ab: -4, db: -5, gb: -6, cb: -7
};
const MINOR_KEY_FIFTHS = {
  am: 0, em: 1, bm: 2, fsm: 3, csm: 4, gsm: 5, dsm: 6, asm: 7,
  dm: -1, gm: -2, cm: -3, fm: -4, bbm: -5, ebm: -6, abm: -7
};
const SHARP_ORDER = "fcgdaeb";
const FLAT_ORDER = "beadgcf";
const NOTE_MARKS = { "~": "tie", "-": "slur", "*": "staccato", ">": "accent", "_": "tenuto", "^": "fermata", "\\": "fall", "/": "rise" };
const ARTICULATIONS = [ "staccato", "accent", "tenuto", "fermata" ];
const NOTE_VALUES = [ 1, 2, 4, 8, 16, 32, 64 ];
const MOST_COPIES = 999;
const CLEF_NAMES = { t: "treble", b: "bass" };
const LETTER_SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function writtenLengthOf( event ) {
  return ( 1 / event.duration ) * ( 2 - Math.pow( 0.5, event.dots ) );
}

function lengthOf( event ) {
  return writtenLengthOf( event ) * ( event.tupletRatio ?? 1 );
}

function midiOf( pitch ) {
  return ( pitch.octave + 1 ) * 12 + LETTER_SEMITONES[ pitch.letter ] + pitch.alter;
}

function measureLengthOf( meter ) {
  return meter.beats / meter.unit;
}

function keyFifthsOf( name ) {
  if ( Object.hasOwn( MAJOR_KEY_FIFTHS, name ) )
    return MAJOR_KEY_FIFTHS[ name ];
  if ( Object.hasOwn( MINOR_KEY_FIFTHS, name ) )
    return MINOR_KEY_FIFTHS[ name ];
  return null;
}

function keyAlterOf( letter, fifths ) {
  if ( fifths > 0 && SHARP_ORDER.slice( 0, fifths ).includes( letter ) )
    return 1;
  if ( fifths < 0 && FLAT_ORDER.slice( 0, -fifths ).includes( letter ) )
    return -1;
  return 0;
}

function parsePitch( text ) {
  const match = text.match( /^([0-8])([a-g])(ss|bb|s|b|n)?$/ );
  if ( !match )
    return null;
  const alter = { ss: 2, s: 1, n: 0, b: -1, bb: -2 }[ match[ 3 ] ] ?? null;
  return { letter: match[ 2 ], alter, octave: Number( match[ 1 ] ) };
}

function applyKeyToNotes( staves, fifths ) {
  staves.forEach( staff => staff.events.forEach( event => {
    [ ...event.pitches, ...( event.graces || [] ) ].forEach( pitch => pitch.alter ??= keyAlterOf( pitch.letter, fifths ) );
    event.pitches.sort( ( a, b ) => midiOf( a ) - midiOf( b ) );
  }));
}

function parseLength( text ) {
  const match = text.match( /^(\d+)(\.{0,2})([~\-*>_^\\/]*)$/ );
  if ( !match || !NOTE_VALUES.includes( Number( match[ 1 ] ) ) )
    return null;
  const marks = [ ...match[ 3 ] ].map( mark => NOTE_MARKS[ mark ] );
  const length = { duration: Number( match[ 1 ] ), dots: match[ 2 ].length, tie: marks.includes( "tie" ) };
  const articulations = ARTICULATIONS.filter( articulation => marks.includes( articulation ) );
  if ( marks.includes( "slur" ) )
    length.slur = true;
  if ( marks.includes( "fall" ) )
    length.fall = true;
  if ( marks.includes( "rise" ) )
    length.rise = true;
  if ( articulations.length )
    length.articulations = articulations;
  return length;
}

function parseRest( text ) {
  const length = text.startsWith( "r" ) ? parseLength( text.slice( 1 ) ) : null;
  const onlyFermata = length && ( length.articulations || [] ).every( articulation => articulation === "fermata" );
  if ( !length || length.tie || length.slur || length.fall || length.rise || !onlyFermata )
    return null;
  return { rest: true, pitches: [], ...length };
}

function parseNote( text ) {
  const match = text.match( /^([0-8][a-g](?:ss|bb|s|b|n)?)(\d.*)$/ );
  const pitch = match && parsePitch( match[ 1 ] );
  const length = match && parseLength( match[ 2 ] );
  if ( !pitch || !length )
    return null;
  return { rest: false, pitches: [ pitch ], ...length };
}

function parseChord( text, column, report ) {
  const closing = text.indexOf( "]" );
  if ( closing === -1 )
    return report( column, text, "chord is missing ]" );
  const pitches = [];
  for ( const piece of text.slice( 1, closing ).matchAll( /\S+/g ) ) {
    const pitch = parsePitch( piece[ 0 ] );
    if ( pitch )
      pitches.push( pitch );
    else
      report( column + 1 + piece.index, piece[ 0 ], "unknown note in chord" );
  }
  if ( pitches.length === 0 )
    return report( column, text, "empty chord" );
  const length = parseLength( text.slice( closing + 1 ) );
  if ( !length )
    return report( column + closing + 1, text.slice( closing + 1 ) || "]", "chord needs a duration like ]4" );
  return { rest: false, pitches, ...length };
}

function parseGrace( text ) {
  return text.startsWith( "g" ) ? parsePitch( text.slice( 1 ) ) : null;
}

function attachGraces( event, staff, report ) {
  if ( !staff.waitingGraces.length )
    return;
  if ( event.rest )
    staff.waitingGraces.forEach( grace => report( grace.line, grace.column, grace.token, "a grace note needs a note after it, not a rest" ) );
  else {
    event.graces = staff.waitingGraces.map( grace => grace.pitch );
    event.graceSources = staff.waitingGraces.map( ( { line, column, token } ) => ( { line, column, token } ) );
  }
  staff.waitingGraces = [];
}

function parseEvent( token, column, lineNumber, staff, report ) {
  const grace = parseGrace( token );
  if ( grace ) {
    staff.waitingGraces.push( { pitch: grace, line: lineNumber, column, token } );
    return null;
  }
  const reportHere = ( where, what, reason ) => report( lineNumber, where, what, reason );
  if ( token.startsWith( "[" ) )
    return withSourceOf( parseChord( token, column, reportHere ), column, token );
  return withSourceOf( parseRest( token ) || parseNote( token ), column, token ) || reportHere( column, token, "not a note, rest, chord or grace note" );
}

function withSourceOf( event, column, token ) {
  return event && { ...event, column, token };
}

function withGracesAttached( event, staff, report ) {
  if ( event )
    attachGraces( event, staff, report );
  return event;
}

function largestPowerOfTwoBelow( count ) {
  return Math.pow( 2, Math.floor( Math.log2( count ) ) );
}

function parseTuplet( token, column, lineNumber, staff, report ) {
  if ( !token.endsWith( "}" ) )
    return report( lineNumber, column, token, "triplet is missing }" );
  const events = [ ...token.slice( 1, -1 ).matchAll( /\[[^\]]*\]?\S*|\S+/g ) ]
    .map( piece => withGracesAttached( parseEvent( piece[ 0 ], column + 1 + piece.index, lineNumber, staff, report ), staff, report ) )
    .filter( Boolean );
  if ( !events.length )
    return report( lineNumber, column, token, "empty triplet" );
  const shortest = Math.min( ...events.map( writtenLengthOf ) );
  const count = Math.round( events.reduce( ( total, event ) => total + writtenLengthOf( event ), 0 ) / shortest );
  const normal = largestPowerOfTwoBelow( count );
  if ( count === normal )
    return report( lineNumber, column, token, `these already fit evenly; a tuplet needs a count like 3 or 5 (this is ${ count })` );
  const tuplet = { count, normal };
  staff.tuplets.push( { start: staff.position, length: events.reduce( ( total, event ) => total + writtenLengthOf( event ), 0 ) * normal / count, line: lineNumber, column, token } );
  return events.map( event => ( { ...event, tuplet, tupletRatio: normal / count } ) );
}

function repeatSignOf( token, staff ) {
  if ( token === "|" ) {
    staff.openRepeats++;
    return { kind: "start", level: staff.openRepeats };
  }
  const level = Math.max( 1, staff.openRepeats );
  staff.openRepeats = Math.max( 0, staff.openRepeats - 1 );
  return { kind: "end", level };
}

function addEvent( event, lineNumber, staff, pass ) {
  attachGraces( event, staff, pass.report );
  const copy = pass.countSource ? { countSource: pass.countSource } : {};
  staff.events.push( { ...event, line: lineNumber, ...copy } );
  staff.position += lengthOf( event );
}

function playToken( { token, column, line }, staff, pass ) {
  if ( /^\|{5,}$/.test( token ) )
    return pass.report( line, column, token, "| and || repeat, ||| and |||| loop forever; there's nothing longer" );
  if ( token === "|||" || token === "||||" ) {
    staff.loops.push( { kind: token === "|||" ? "start" : "end", position: staff.position, line, column, token } );
    return;
  }
  if ( /^\|+$/.test( token ) ) {
    staff.repeats.push( { ...repeatSignOf( token, staff ), position: staff.position, line, column, token } );
    return;
  }
  if ( /^x\d*$/.test( token ) )
    return pass.report( line, column, token, "x2 goes right after what it repeats, with no space" );
  const events = token.startsWith( "{" )
    ? parseTuplet( token, column, line, staff, pass.report )
    : [ parseEvent( token, column, line, staff, pass.report ) ];
  ( events || [] ).filter( Boolean ).forEach( event => addEvent( event, line, staff, pass ) );
}

const SILENT = { report: () => null };

function playTimes( times, countSource, pass, playOnce ) {
  if ( times < 2 )
    pass.report( countSource.line, countSource.column, countSource.token, "repeat at least twice, like x2" );
  if ( times > MOST_COPIES ) {
    pass.report( countSource.line, countSource.column, countSource.token, `that's a lot; x${ MOST_COPIES } at most, or use ||| |||| to loop forever` );
    times = 1;
  }
  for ( let copy = 0; copy < Math.max( 1, times ); copy++ )
    playOnce( copy === 0 ? pass : { ...SILENT, countSource: pass.countSource || countSource }, copy );
}

function playCounted( record, staff, pass ) {
  const counted = record.token.match( /^(.+?)(x(\d+))$/ );
  if ( !counted )
    return playToken( record, staff, pass );
  const [ , written, countToken, times ] = counted;
  const countSource = { line: record.line, column: record.column + written.length, token: countToken };
  const graces = [ ...staff.waitingGraces ];
  playTimes( Number( times ), countSource, pass, ( copyPass, copy ) => {
    if ( copy > 0 )
      staff.waitingGraces = [ ...graces ];
    playToken( { ...record, token: written }, staff, copyPass );
  });
}

function playGroup( records, staff, pass ) {
  const closing = records.at( -1 );
  const counted = closing.token.match( /^\)x(\d+)$/ );
  const inside = records.slice( 1, -1 );
  if ( !counted ) {
    pass.report( closing.line, closing.column, closing.token, "a group needs a count right after it, like )x2" );
    return playRecords( inside, staff, pass );
  }
  const countSource = { line: closing.line, column: closing.column + 1, token: closing.token.slice( 1 ) };
  playTimes( Number( counted[ 1 ] ), countSource, pass, copyPass => playRecords( inside, staff, copyPass ) );
}

function feedRecord( group, record, staff, pass ) {
  const opens = record.token === "(";
  const closes = record.token.startsWith( ")" );
  if ( group.depth > 0 ) {
    group.depth += opens ? 1 : closes ? -1 : 0;
    group.records.push( record );
    if ( group.depth === 0 )
      playGroup( group.records.splice( 0 ), staff, pass );
    return;
  }
  if ( opens ) {
    group.depth = 1;
    group.records = [ record ];
    return;
  }
  if ( closes )
    return pass.report( record.line, record.column, record.token, "there's no ( for this ) to close" );
  playCounted( record, staff, pass );
}

function playRecords( records, staff, pass ) {
  const group = { depth: 0, records: [] };
  records.forEach( record => feedRecord( group, record, staff, pass ) );
}

function parseMusicLine( lineText, lineNumber, staff, report ) {
  for ( const match of lineText.matchAll( /\(|\)[^\s()]*|\{[^}]*\}?[^\s()]*|\[[^\]]*\]?[^\s()]*|[^\s()]+/g ) )
    feedRecord( staff.group, { token: match[ 0 ], column: match.index, line: lineNumber }, staff, { report } );
}

function isOnBarline( position, measureLength ) {
  const measures = position / measureLength;
  return Math.abs( measures - Math.round( measures ) ) < 1e-6;
}

function sharesAPitch( event, next ) {
  return !event.rest && !next.rest && event.pitches.some( pitch => next.pitches.some( other => other.letter === pitch.letter && other.octave === pitch.octave ) );
}

function finishStaff( staff, measureLength, report ) {
  if ( staff.group.depth > 0 ) {
    const [ opening, ...inside ] = staff.group.records;
    report( opening.line, opening.column, opening.token, "this ( is never closed; end it with )x2" );
    playRecords( inside, staff, { report } );
  }
  staff.waitingGraces.forEach( grace => report( grace.line, grace.column, grace.token, "a grace note needs a note after it" ) );
  [ ...staff.repeats, ...staff.loops ]
    .filter( sign => !isOnBarline( sign.position, measureLength ) )
    .forEach( sign => report( sign.line, sign.column, sign.token, "repeat signs go on a barline, between measures" ) );
  staff.loopSigns = staff.loops.filter( sign => isOnBarline( sign.position, measureLength ) );
  staff.events
    .filter( ( event, index ) => event.tie && !event.countSource && staff.events[ index + 1 ] && !sharesAPitch( event, staff.events[ index + 1 ] ) )
    .forEach( event => report( event.line, event.column, event.token, "a tie (~) joins two of the same note; for different notes use a slur (-)" ) );
  staff.tuplets
    .filter( span => Math.floor( span.start / measureLength + 1e-6 ) !== Math.floor( ( span.start + span.length ) / measureLength - 1e-6 ) )
    .forEach( span => report( span.line, span.column, span.token, "a triplet can't cross a barline" ) );
  const repeats = staff.repeats.filter( sign => isOnBarline( sign.position, measureLength ) ).map( ( { kind, level, position } ) => ( { kind, level, position } ) );
  [ "waitingGraces", "position", "repeats", "loops", "openRepeats", "tuplets", "group" ].forEach( name => delete staff[ name ] );
  return repeats;
}

function loopOf( staves, report ) {
  const signs = staves.flatMap( staff => staff.loopSigns );
  staves.forEach( staff => delete staff.loopSigns );
  const at = kind => [ ...new Map( signs.filter( sign => sign.kind === kind ).map( sign => [ sign.position.toFixed( 6 ), sign ] ) ).values() ];
  const [ starts, ends ] = [ at( "start" ), at( "end" ) ];
  [ ...starts.slice( 1 ), ...ends.slice( 1 ) ].forEach( sign => report( sign.line, sign.column, sign.token, "a sheet can only have one endless loop" ) );
  if ( !ends.length ) {
    starts.forEach( sign => report( sign.line, sign.column, sign.token, "this loop never closes; end it with ||||" ) );
    return null;
  }
  const end = ends[ 0 ];
  const start = starts[ 0 ] ? starts[ 0 ].position : 0;
  if ( end.position <= start + 1e-6 )
    return report( end.line, end.column, end.token, "a loop needs music between ||| and ||||" );
  return { start, end: end.position };
}

function mergedRepeatsOf( repeatsOfEachStaff ) {
  const unique = new Map( repeatsOfEachStaff.flat().map( sign => [ `${ sign.kind } ${ sign.level } ${ sign.position.toFixed( 6 ) }`, sign ] ) );
  return [ ...unique.values() ].sort( ( a, b ) => a.position - b.position );
}

function applySetting( name, value, sheet, problem ) {
  if ( name === "title" || name === "author" ) {
    sheet[ name ] = value;
    return;
  }
  if ( name === "bpm" ) {
    const bpm = Number( value );
    if ( Number.isInteger( bpm ) && bpm > 0 )
      sheet.bpm = bpm;
    else
      problem( "bpm must be a whole number above 0" );
    return;
  }
  if ( name === "ts" ) {
    const [ beats, unit ] = value.split( "," ).map( Number );
    if ( Number.isInteger( beats ) && beats > 0 && NOTE_VALUES.includes( unit ) )
      sheet.meter = { beats, unit };
    else
      problem( "time signature looks like 4,4 or 6,8" );
    return;
  }
  if ( name === "key" ) {
    const fifths = keyFifthsOf( value );
    if ( fifths === null )
      problem( "unknown key" );
    else
      sheet.key = { fifths };
    return;
  }
  problem( "unknown setting", true );
}

function instrumentNamed( name, problem ) {
  if ( Object.hasOwn( SOUND_PRESETS, name ) )
    return name;
  return problem( `unknown instrument; try ${ Object.keys( SOUND_PRESETS ).join( ", " ) }` );
}

function parseSheet( text ) {
  const sheet = { title: "", author: "", bpm: 120, repeats: [], loop: null, meter: { beats: 4, unit: 4 }, key: { fifths: 0 }, staves: [], problems: [] };
  const staves = {
    treble: { clef: "treble", events: [], waitingGraces: [], position: 0, repeats: [], loops: [], openRepeats: 0, tuplets: [], group: { depth: 0, records: [] } },
    bass: { clef: "bass", events: [], waitingGraces: [], position: 0, repeats: [], loops: [], openRepeats: 0, tuplets: [], group: { depth: 0, records: [] } }
  };
  const report = ( line, column, token, reason ) => {
    sheet.problems.push( { line, column, token, reason } );
    return null;
  };
  let currentStaff = staves.treble;
  let waitingInstrument = null;

  text.split( "\n" ).forEach( ( rawLine, index ) => {
    const lineNumber = index + 1;
    const lineText = rawLine.split( "#" )[ 0 ];
    const setting = lineText.match( /^(\s*)(\w+)(\s*=\s*)(.*?)\s*$/ );
    if ( !setting ) {
      if ( waitingInstrument && lineText.trim() ) {
        currentStaff.instrument = waitingInstrument;
        waitingInstrument = null;
      }
      parseMusicLine( lineText.toLowerCase(), lineNumber, currentStaff, report );
      return;
    }
    const [ , indent, rawName, equals, rawValue ] = setting;
    const name = rawName.toLowerCase();
    const value = name === "title" || name === "author" ? rawValue : rawValue.toLowerCase();
    const problem = ( reason, isAboutName ) => isAboutName
      ? report( lineNumber, indent.length, rawName, reason )
      : report( lineNumber, indent.length + rawName.length + equals.length, rawValue || "=", reason );
    if ( name === "instrument" ) {
      waitingInstrument = instrumentNamed( value.replace( /\s+/g, " " ), problem ) ?? waitingInstrument;
      return;
    }
    if ( name !== "clef" && name !== "mclef" ) {
      applySetting( name, value, sheet, problem );
      return;
    }
    if ( !Object.hasOwn( CLEF_NAMES, value ) )
      return problem( "clef is t (treble) or b (bass)" );
    currentStaff = staves[ CLEF_NAMES[ value ] ];
    if ( name === "mclef" )
      currentStaff.muted = true;
  });

  if ( waitingInstrument )
    currentStaff.instrument = waitingInstrument;
  const measureLength = measureLengthOf( sheet.meter );
  sheet.repeats = mergedRepeatsOf( [ staves.treble, staves.bass ].map( staff => finishStaff( staff, measureLength, report ) ) );
  sheet.loop = loopOf( [ staves.treble, staves.bass ], report );
  applyKeyToNotes( [ staves.treble, staves.bass ], sheet.key.fifths );
  const usedStaves = [ staves.treble, staves.bass ].filter( staff => staff.events.length > 0 );
  sheet.staves = usedStaves.length ? usedStaves : [ staves.treble ];
  return sheet;
}
