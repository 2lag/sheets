const ACCIDENTAL_SIGNS = { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" };
const LENGTH_NAMES = { 1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "sixteenth", 32: "thirty-second", 64: "sixty-fourth" };

function nameOf( pitch ) {
  return pitch.letter.toUpperCase() + ACCIDENTAL_SIGNS[ pitch.alter ?? 0 ] + pitch.octave;
}

function ordinalOf( number ) {
  const ending = [ "th", "st", "nd", "rd" ][ number % 100 > 10 && number % 100 < 14 ? 0 : number % 10 ] || "th";
  return number + ending;
}

function ledgerPlaceOf( distance, side ) {
  if ( distance === 1 )
    return `just ${ side } the staff`;
  const ledger = ordinalOf( Math.floor( distance / 2 ) );
  return distance % 2 === 0
    ? `on the ${ ledger } ledger line ${ side }`
    : `${ side } the ${ ledger } ledger line`;
}

function staffPlaceOf( pitch, clef ) {
  const step = staffStepOf( pitch, clef );
  if ( step > 8 )
    return ledgerPlaceOf( step - 8, "above" );
  if ( step < 0 )
    return ledgerPlaceOf( -step, "below" );
  return step % 2 === 0
    ? `${ ordinalOf( step / 2 + 1 ) } line of the ${ clef } staff`
    : `${ ordinalOf( ( step + 1 ) / 2 ) } space of the ${ clef } staff`;
}

function lengthNameOf( event ) {
  const dotted = [ "", "dotted ", "double-dotted " ][ event.dots || 0 ];
  const tuplet = !event.tuplet ? "" : event.tuplet.count === 3 ? "triplet " : `${ event.tuplet.count }-tuplet `;
  return dotted + tuplet + LENGTH_NAMES[ event.duration ];
}

function describePitch( pitch, clef ) {
  const middle = pitch.letter === "c" && pitch.octave === 4 && !pitch.alter ? " (middle C)" : "";
  return `${ nameOf( pitch ) }${ middle }, ${ staffPlaceOf( pitch, clef ) }`;
}

function describeEvent( event, clef ) {
  if ( event.rest )
    return `${ lengthNameOf( event ) } rest`;
  const kind = event.pitches.length > 1 ? "chord" : "note";
  const pitches = event.pitches.map( pitch => describePitch( pitch, clef ) ).join( " · " );
  return `${ pitches } · ${ lengthNameOf( event ) } ${ kind }`;
}

function cursorPlace() {
  const before = editor.value.slice( 0, editor.selectionStart ).split( "\n" );
  return { line: before.length, column: before.at( -1 ).length };
}

function touches( source, place ) {
  return source.line === place.line && place.column >= source.column && place.column <= source.column + source.token.length;
}

function hintAt( place ) {
  for ( const staff of sheet.staves ) {
    for ( const event of staff.events ) {
      const graceIndex = ( event.graceSources || [] ).findIndex( source => touches( source, place ) );
      if ( graceIndex >= 0 )
        return `${ describePitch( event.graces[ graceIndex ], staff.clef ) } · grace note`;
      if ( event.token && touches( event, place ) )
        return describeEvent( event, staff.clef );
    }
  }
  return "";
}

function showNoteHint() {
  noteHint.textContent = hintAt( cursorPlace() );
}

[ "keyup", "pointerup", "focus" ].forEach( name => editor.addEventListener( name, showNoteHint ) );
