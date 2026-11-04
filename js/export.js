const GRACE_LENGTH = 1 / 32;
const SLIDE_SHARE = 0.25;
const PLAIN_VELOCITY = 0.75;
const STRUDEL_SOUNDS = {
  piano: "piano",
  "electric piano": "gm_epiano1",
  organ: "gm_drawbar_organ",
  "music box": "gm_music_box",
  vibraphone: "gm_vibraphone",
  "soft pad": "gm_pad_warm",
  chiptune: "square",
  violin: "gm_violin",
  strings: "gm_string_ensemble_1",
  cello: "gm_cello",
  "upright bass": "gm_acoustic_bass",
  guitar: "gm_acoustic_guitar_nylon",
  harp: "gm_orchestral_harp",
  trumpet: "gm_trumpet",
  "muted trumpet": "gm_muted_trumpet",
  trombone: "gm_trombone",
  sax: "gm_alto_sax",
  flute: "gm_flute",
  choir: "gm_choir_aahs"
};

function strudelSoundOf( staff ) {
  return STRUDEL_SOUNDS[ staff.instrument || soundSettings.preset ] || "piano";
}

function strudelNameOf( pitch ) {
  const accidental = { "-2": "bb", "-1": "b", "0": "", "1": "#", "2": "##" }[ pitch.alter ];
  return pitch.letter + accidental + pitch.octave;
}

function strudelChordOf( pitches, semitones = 0 ) {
  const names = pitches.map( pitch => semitones ? midiOf( pitch ) + semitones : strudelNameOf( pitch ) );
  return names.length === 1 ? String( names[ 0 ] ) : `[${ names.join( "," ) }]`;
}

function strudelWeightOf( length ) {
  const quarters = Number( ( length * 4 ).toFixed( 4 ) );
  return quarters === 1 ? "" : "@" + quarters;
}

function fermataHoldsOf( performance ) {
  const holds = new Map();
  sheet.staves.forEach( staff => occurrencesOf( staff, performance )
    .filter( item => item.event.articulations?.includes( "fermata" ) && item.end <= item.segment.end + EPSILON )
    .forEach( item => {
      const at = item.performedAt( item.end ).toFixed( 6 );
      holds.set( at, Math.max( holds.get( at ) || 0, lengthOf( item.event ) ) );
    }));
  return [ ...holds ].map( ( [ at, extra ] ) => ( { at: Number( at ), extra } ) );
}

function heldTimeOf( position, holds ) {
  return position + holds.filter( hold => hold.at <= position + EPSILON ).reduce( ( total, hold ) => total + hold.extra, 0 );
}

function samePitches( a, b ) {
  return a.map( midiOf ).join() === b.map( midiOf ).join();
}

function soundingStepsOf( staff, performance, holds ) {
  const steps = [];
  occurrencesOf( staff, performance ).forEach( item => {
    const { event, segment } = item;
    const step = {
      event,
      lastEvent: event,
      rest: event.rest,
      pitches: event.pitches,
      start: heldTimeOf( item.performedAt( Math.max( item.start, segment.start ) ), holds ),
      end: heldTimeOf( item.performedAt( Math.min( item.end, segment.end ) ), holds ),
      tie: event.tie
    };
    const previous = steps.at( -1 );
    const continuesTie = previous && previous.tie && !step.rest && samePitches( previous.pitches, step.pitches );
    if ( !continuesTie ) {
      steps.push( step );
      return;
    }
    previous.end = step.end;
    previous.tie = step.tie;
    previous.lastEvent = event;
  });
  return steps;
}

function strudelPiecesOf( step ) {
  const length = step.end - step.start;
  if ( step.rest )
    return [ { sound: "~", length, velocity: PLAIN_VELOCITY } ];
  const articulations = step.event.articulations || [];
  const velocity = articulations.includes( "accent" ) ? 1 : PLAIN_VELOCITY;
  const graces = step.event.graces || [];
  const graceLength = Math.min( GRACE_LENGTH, length / ( graces.length + 2 ) );
  const pieces = graces.map( pitch => ( { sound: strudelNameOf( pitch ), length: graceLength, velocity: 0.6 } ) );
  const remaining = length - graces.length * graceLength;
  const slide = step.lastEvent.fall ? -7 : step.lastEvent.rise ? 7 : 0;
  const chord = strudelChordOf( step.pitches );
  if ( articulations.includes( "staccato" ) )
    return [ ...pieces, { sound: chord, length: remaining / 2, velocity }, { sound: "~", length: remaining / 2, velocity } ];
  if ( slide )
    return [ ...pieces, { sound: chord, length: remaining * ( 1 - SLIDE_SHARE ), velocity }, { sound: strudelChordOf( step.pitches, slide ), length: remaining * SLIDE_SHARE, velocity: velocity * 0.6 } ];
  return [ ...pieces, { sound: chord, length: remaining, velocity } ];
}

function strudelLineOf( staff, performance, holds, totalLength ) {
  const pieces = soundingStepsOf( staff, performance, holds ).flatMap( strudelPiecesOf );
  const silence = totalLength - pieces.reduce( ( total, piece ) => total + piece.length, 0 );
  if ( silence > EPSILON )
    pieces.push( { sound: "~", length: silence, velocity: PLAIN_VELOCITY } );
  const notes = pieces.map( piece => piece.sound + strudelWeightOf( piece.length ) ).join( " " );
  const velocities = pieces.map( piece => Number( piece.velocity.toFixed( 2 ) ) + strudelWeightOf( piece.length ) ).join( " " );
  const hasAccents = pieces.some( piece => piece.velocity !== PLAIN_VELOCITY );
  const swing = isSwung() ? `.swingBy(${ Number( ( 2 * ( swingRatio() - 0.5 ) ).toFixed( 3 ) ) }, 4)` : "";
  const velocity = hasAccents ? `.velocity("[${ velocities }]")` : "";
  return `  note("[${ notes }]")${ velocity }.s("${ strudelSoundOf( staff ) }").slow(${ Number( totalLength.toFixed( 4 ) ) })${ swing }`;
}

function strudelCodeOf( sheet ) {
  const performance = onePassPerformanceOf( sheet );
  const holds = fermataHoldsOf( performance );
  const totalLength = Math.max( 1, heldTimeOf( passLengthOf( sheet ), holds ) );
  const lines = sheet.staves.filter( staff => !staff.muted ).map( staff => strudelLineOf( staff, performance, holds, totalLength ) );
  if ( !lines.length )
    return `setcpm(${ sheet.bpm }/4)\nsilence`;
  return [ `setcpm(${ sheet.bpm }/4)`, "stack(", lines.join( ",\n" ), ")" ].join( "\n" );
}

exportStrudel.addEventListener( "click", () => {
  const code = strudelCodeOf( sheet );
  copyText( code );
  window.open( "https://strudel.cc/#" + encodeURIComponent( base64Encode( code ) ), "_blank" );
  closeExportMenu();
});

exportPdf.addEventListener( "click", () => {
  closeExportMenu();
  window.print();
});

exportLink.addEventListener( "click", async event => {
  event.stopPropagation();
  const link = ( await shareLinkOf( editor.value ) ).href;
  if ( !await copyText( link ) )
    prompt( "copy this link", link );
  exportLink.textContent = "link copied ✓";
  setTimeout( () => {
    exportLink.textContent = "link";
    closeExportMenu();
  }, 1200 );
});
