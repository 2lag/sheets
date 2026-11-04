let playing = false;
let holding = false;
let audioContext = null;
let highlightTimeouts = [];
let heldNotes = [];
let playbackPosition = 0;
let playbackOrigin = null;
let schedulerTimer = null;
let activePlan = null;

const LOOKAHEAD_SECONDS = 2;
const HIDDEN_LOOKAHEAD_SECONDS = 45;
const LATE_SECONDS = 0.05;

function secondsPerWholeNoteOf( sheet ) {
  return 240 / sheet.bpm;
}

const ENDLESS_MINUTES = 30;
const performances = new WeakMap();

function timedSegmentsOf( segments ) {
  let performedStart = 0;
  return segments.map( segment => {
    const timed = { ...segment, performedStart };
    performedStart += segment.end - segment.start;
    return timed;
  });
}

function lengthOfSegments( segments ) {
  return segments.reduce( ( total, segment ) => total + segment.end - segment.start, 0 );
}

function onePassOf( sheet ) {
  const songLength = sheet.loop ? sheet.loop.end : Math.max( ...sheet.staves.map( staffLengthOf ) );
  return performanceSegmentsOf( sheet.repeats || [], songLength );
}

function loopBodyOf( sheet ) {
  return joinedSegments( unfold( sheet.repeats || [], sheet.loop.start, sheet.loop.end, 1 ) );
}

function endlessPerformanceOf( sheet ) {
  const body = loopBodyOf( sheet );
  const loops = Math.max( 1, Math.ceil( ENDLESS_MINUTES * 60 / secondsPerWholeNoteOf( sheet ) / lengthOfSegments( body ) ) );
  return [ ...onePassOf( sheet ), ...Array.from( { length: loops }, () => body ).flat() ];
}

function performanceOf( sheet ) {
  if ( !performances.has( sheet ) )
    performances.set( sheet, timedSegmentsOf( sheet.loop ? endlessPerformanceOf( sheet ) : onePassOf( sheet ) ) );
  return performances.get( sheet );
}

function onePassPerformanceOf( sheet ) {
  return timedSegmentsOf( onePassOf( sheet ) );
}

function totalDurationOf( sheet ) {
  return lengthOfSegments( performanceOf( sheet ) );
}

function passLengthOf( sheet ) {
  return lengthOfSegments( onePassOf( sheet ) );
}

function shownPositionOf( position ) {
  const pass = passLengthOf( sheet );
  if ( !sheet.loop || position <= pass + EPSILON )
    return position;
  const body = lengthOfSegments( loopBodyOf( sheet ) );
  return pass - body + ( position - pass ) % body;
}

function scorePositionOf( performed ) {
  const performance = performanceOf( sheet );
  const segment = performance.findLast( candidate => candidate.performedStart <= performed + EPSILON ) || performance[ 0 ];
  if ( !segment )
    return performed;
  return Math.min( segment.end, segment.start + performed - segment.performedStart );
}

function timedEventsOf( staff ) {
  let position = 0;
  return staff.events.map( ( event, index ) => {
    const start = position;
    position += lengthOf( event );
    return { event, index, start, end: position };
  });
}

function occurrencesOf( staff, performance ) {
  const timed = timedEventsOf( staff );
  return performance.flatMap( segment => timed
    .filter( item => item.start < segment.end - EPSILON && item.end > segment.start + EPSILON )
    .map( item => ( { ...item, segment, performedAt: position => segment.performedStart + position - segment.start } ) ) );
}

function nextFermataAfter( from, performance ) {
  const ends = sheet.staves.flatMap( staff => occurrencesOf( staff, performance )
    .filter( item => item.event.articulations?.includes( "fermata" ) && item.end <= item.segment.end + EPSILON )
    .map( item => item.performedAt( item.end ) ) );
  return Math.min( Infinity, ...ends.filter( end => end > from + EPSILON ) );
}

function soundStyleOf( event ) {
  const articulations = event.articulations || [];
  return {
    loudness: articulations.includes( "accent" ) ? 1.5 : 1,
    slide: event.fall ? "fall" : event.rise ? "rise" : null
  };
}

function pitchMatches( a, b ) {
  return a.letter === b.letter && a.octave === b.octave && a.alter === b.alter;
}

function hasPitch( event, pitch ) {
  return event.pitches.some( p => pitchMatches( p, pitch ) );
}

function tiedDurationOf( staff, index, pitch ) {
  let total = lengthOf( staff.events[ index ] );
  let i = index;
  while ( staff.events[ i ].tie && i + 1 < staff.events.length && hasPitch( staff.events[ i + 1 ], pitch ) ) {
    total += lengthOf( staff.events[ i + 1 ] );
    i++;
  }
  return total;
}

function isContinuing( staff, index, pitch ) {
  if ( index === 0 )
    return false;
  const previous = staff.events[ index - 1 ];
  return previous.tie && hasPitch( previous, pitch );
}

function highlight( event, isOn ) {
  [ ...( event.marks || [] ), ...( event.textMarks || [] ) ].forEach( mark => mark.classList.toggle( "playing", isOn ) );
  if ( isOn )
    followInEditor( event );
}

const MOST_SWING = 0.985;

function swingRatio() {
  return Math.min( swingAmount, MOST_SWING );
}

function isSwung() {
  return swingAmount > 0.5 && !isCompoundMeter( sheet.meter );
}

function swungTimeOf( position ) {
  if ( !isSwung() )
    return position;
  const beat = 1 / 4;
  const beatStart = Math.floor( position / beat + EPSILON ) * beat;
  const within = ( position - beatStart ) / beat;
  const performed = within <= 0.5
    ? within * 2 * swingRatio()
    : swingRatio() + ( within - 0.5 ) * 2 * ( 1 - swingRatio() );
  return beatStart + performed * beat;
}

function straightTimeOf( performedPosition ) {
  if ( !isSwung() )
    return performedPosition;
  const beat = 1 / 4;
  const beatStart = Math.floor( performedPosition / beat + EPSILON ) * beat;
  const within = ( performedPosition - beatStart ) / beat;
  const written = within <= swingRatio()
    ? within / ( 2 * swingRatio() )
    : 0.5 + ( within - swingRatio() ) / ( 2 * ( 1 - swingRatio() ) );
  return beatStart + written * beat;
}

function audioTimeAt( position, startTime, from ) {
  return startTime + ( swungTimeOf( position ) - swungTimeOf( from ) ) * secondsPerWholeNoteOf( sheet );
}

function scheduleHighlight( event, startsAt, endsAt ) {
  const delayUntil = time => Math.max( 0, time - audioContext.currentTime ) * 1000;
  highlightTimeouts.push( setTimeout( () => highlight( event, true ), delayUntil( startsAt ) ) );
  if ( endsAt !== Infinity )
    highlightTimeouts.push( setTimeout( () => highlight( event, false ), delayUntil( endsAt ) ) );
}

function scheduleGraces( graces, beginsAt, noteSeconds, voice ) {
  const graceSeconds = Math.min( 0.06, noteSeconds / ( graces.length + 2 ) );
  graces.forEach( ( pitch, index ) => scheduleNote( pitch, beginsAt + index * graceSeconds, graceSeconds, voice ) );
  return graces.length * graceSeconds;
}

function scheduleOccurrence( staff, item, plan ) {
  const { event, index, segment } = item;
  const audioTimeOf = position => audioTimeAt( position, plan.startTime, plan.from );
  const performedStart = item.performedAt( Math.max( item.start, segment.start ) );
  const performedEnd = item.performedAt( Math.min( item.end, segment.end ) );
  if ( performedEnd <= plan.from + EPSILON || performedStart >= plan.until - EPSILON )
    return;
  const beginsHere = item.start >= segment.start - EPSILON && performedStart >= plan.from - EPSILON;
  const graceDelay = beginsHere && event.graces
    ? scheduleGraces( event.graces, audioTimeOf( performedStart ), audioTimeOf( performedEnd ) - audioTimeOf( performedStart ), plan.voices.get( staff ) )
    : 0;
  const isStaccato = event.articulations?.includes( "staccato" );
  event.pitches
    .filter( pitch => !isContinuing( staff, index, pitch ) || item.start <= segment.start + EPSILON )
    .forEach( pitch => {
      const chainEnd = Math.min( item.start + tiedDurationOf( staff, index, pitch ), segment.end );
      const soundEnd = isStaccato ? item.start + ( chainEnd - item.start ) * 0.5 : chainEnd;
      const soundStart = Math.max( performedStart, plan.from );
      const performedSoundEnd = item.performedAt( soundEnd );
      if ( performedSoundEnd <= plan.from + EPSILON )
        return;
      const ringsThroughHold = plan.stopsForFermata && performedSoundEnd >= plan.until - EPSILON;
      const startsAt = audioTimeOf( soundStart ) + graceDelay;
      const seconds = ringsThroughHold ? 60 : audioTimeOf( performedSoundEnd ) - startsAt;
      const note = scheduleNote( pitch, startsAt, seconds, plan.voices.get( staff ), { ...soundStyleOf( event ), held: ringsThroughHold } );
      if ( ringsThroughHold )
        heldNotes.push( note );
    });
  const highlightEnd = plan.stopsForFermata && performedEnd >= plan.until - EPSILON ? Infinity : audioTimeOf( performedEnd );
  scheduleHighlight( event, audioTimeOf( Math.max( performedStart, plan.from ) ), highlightEnd );
}

function startTimeOf( item, plan ) {
  const performedStart = item.performedAt( Math.max( item.start, item.segment.start ) );
  return audioTimeAt( Math.max( performedStart, plan.from ), plan.startTime, plan.from );
}

function noteQueueOf( plan ) {
  return sheet.staves
    .flatMap( staff => occurrencesOf( staff, plan.performance ).map( item => ( { staff, item, startsAt: startTimeOf( item, plan ) } ) ) )
    .sort( ( a, b ) => a.startsAt - b.startsAt );
}

function scheduleAhead( plan ) {
  const now = audioContext.currentTime;
  const horizon = now + ( document.hidden ? HIDDEN_LOOKAHEAD_SECONDS : LOOKAHEAD_SECONDS );
  while ( plan.next < plan.queue.length && plan.queue[ plan.next ].startsAt <= horizon ) {
    const { staff, item, startsAt } = plan.queue[ plan.next ];
    if ( startsAt >= now - LATE_SECONDS && !staff.muted )
      scheduleOccurrence( staff, item, plan );
    plan.next++;
  }
  plan.metronome( horizon );
}

document.addEventListener( "visibilitychange", () => {
  if ( playing && activePlan )
    scheduleAhead( activePlan );
});

function currentPosition() {
  if ( !playing )
    return playbackPosition;
  const secondsPlayed = Math.max( 0, audioContext.currentTime - playbackOrigin.time );
  const position = straightTimeOf( swungTimeOf( playbackOrigin.position ) + secondsPlayed / secondsPerWholeNoteOf( sheet ) );
  return Math.min( position, playbackOrigin.until );
}

function startPlayback() {
  const performance = performanceOf( sheet );
  const songLength = totalDurationOf( sheet );
  if ( playbackPosition >= songLength - EPSILON )
    playbackPosition = 0;
  playing = true;
  playButton.classList.add( "pausable" );
  playButton.classList.remove( "holding" );
  audioContext = new AudioContext();
  audioMix = buildMix( audioContext );
  const voices = new Map( sheet.staves.map( staff => [ staff, buildVoice( audioMix, staff.instrument ) ] ) );

  const startTime = audioContext.currentTime + 0.05;
  const fermataAt = nextFermataAfter( playbackPosition, performance );
  const until = Math.min( fermataAt, songLength );
  const stopsForFermata = fermataAt <= songLength + EPSILON;
  const plan = { performance, songLength, startTime, from: playbackPosition, until, stopsForFermata, voices };
  playbackOrigin = { time: startTime, position: playbackPosition, until };

  plan.metronome = metronomeOf( startTime, audioMix.compressor, playbackPosition, until );
  plan.queue = noteQueueOf( plan );
  plan.next = 0;
  activePlan = plan;
  scheduleAhead( plan );
  schedulerTimer = setInterval( () => scheduleAhead( plan ), 500 );
  startPlayhead();

  const secondsLeft = audioTimeAt( until, 0, playbackPosition );
  highlightTimeouts.push( setTimeout( stopsForFermata ? () => holdFermata( until ) : finishPlayback, ( secondsLeft + ( stopsForFermata ? 0 : 0.1 ) ) * 1000 ) );
}

function holdFermata( position ) {
  playing = false;
  holding = true;
  playbackPosition = position;
  playButton.classList.remove( "pausable" );
  playButton.classList.add( "holding" );
  showPosition( position );
  placePlayhead( position );
}

function continueAfterFermata() {
  const heldContext = audioContext;
  clearInterval( schedulerTimer );
  heldNotes.forEach( note => note.letGo() );
  heldNotes = [];
  highlightTimeouts.forEach( clearTimeout );
  highlightTimeouts = [];
  sheet.staves.forEach( staff => staff.events.forEach( event => highlight( event, false ) ) );
  setTimeout( () => heldContext.close(), 400 );
  audioContext = null;
  holding = false;
  if ( playbackPosition >= totalDurationOf( sheet ) - EPSILON )
    finishPlayback();
  else
    startPlayback();
}

function pausePlayback() {
  playbackPosition = currentPosition();
  stopPlayback();
  showPosition( playbackPosition );
  placePlayhead( playbackPosition );
}

function finishPlayback() {
  stopPlayback();
  playbackPosition = 0;
  showPosition( 0 );
}

function stopPlayback() {
  playing = false;
  holding = false;
  heldNotes = [];
  playButton.classList.remove( "pausable" );
  playButton.classList.remove( "holding" );

  clearInterval( schedulerTimer );
  highlightTimeouts.forEach( clearTimeout );
  highlightTimeouts = [];
  sheet.staves.forEach( staff => staff.events.forEach( event => highlight( event, false ) ) );
  resetMetronome();
  stopPlayhead();

  if ( audioContext ) {
    fadeOutAndClose( audioContext, audioMix );
    audioContext = null;
    audioMix = null;
  }
}

function fadeOutAndClose( context, mix ) {
  mix.master.gain.setTargetAtTime( 0, context.currentTime, 0.015 );
  setTimeout( () => context.close(), 150 );
}

playButton.addEventListener( "click", () => {
  if ( holding )
    continueAfterFermata();
  else if ( playing )
    pausePlayback();
  else
    startPlayback();
});

function spaceTogglesPlayback( target ) {
  const typing = [ "SELECT", "TEXTAREA" ].includes( target.tagName );
  return output.contains( target ) && !soundPanel.contains( target ) && !typing;
}

document.addEventListener( "keydown", event => {
  if ( event.code !== "Space" || !spaceTogglesPlayback( document.activeElement ) )
    return;
  event.preventDefault();
  playButton.click();
});

