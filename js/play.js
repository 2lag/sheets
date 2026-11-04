let PLAYING = false;
let HOLDING = false;
let AUDIO_CONTEXT = null;
let HIGHLIGHT_TIMEOUTS = [];
let HELD_NOTES = [];
let PLAYBACK_POSITION = 0;
let PLAYBACK_ORIGIN = null;
let SCHEDULER_TIMER = null;
let ACTIVE_PLAN = null;

const LOOKAHEAD_SECONDS = 2;
const HIDDEN_LOOKAHEAD_SECONDS = 45;
const LATE_SECONDS = 0.05;

function secondsPerWholeNoteOf( sheet ) {
  return 240 / sheet.bpm;
}

const ENDLESS_MINUTES = 30;
const PERFORMANCES = new WeakMap();

function timedSegmentsOf( segments ) {
  let performed_start = 0;
  return segments.map( segment => {
    const timed = { ...segment, performedStart: performed_start };
    performed_start += segment.end - segment.start;
    return timed;
  });
}

function lengthOfSegments( segments ) {
  return segments.reduce( ( total, segment ) => total + segment.end - segment.start, 0 );
}

function onePassOf( sheet ) {
  const song_length = sheet.loop ? sheet.loop.end : Math.max( ...sheet.staves.map( staffLengthOf ) );
  return performanceSegmentsOf( sheet.repeats || [], song_length );
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
  if ( !PERFORMANCES.has( sheet ) )
    PERFORMANCES.set( sheet, timedSegmentsOf( sheet.loop ? endlessPerformanceOf( sheet ) : onePassOf( sheet ) ) );
  return PERFORMANCES.get( sheet );
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
  const pass = passLengthOf( SHEET );
  if ( !SHEET.loop || position <= pass + EPSILON )
    return position;
  const body = lengthOfSegments( loopBodyOf( SHEET ) );
  return pass - body + ( position - pass ) % body;
}

function scorePositionOf( performed ) {
  const performance = performanceOf( SHEET );
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
  const ends = SHEET.staves.flatMap( staff => occurrencesOf( staff, performance )
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

function highlight( event, is_on ) {
  [ ...( event.marks || [] ), ...( event.textMarks || [] ) ].forEach( mark => mark.classList.toggle( "playing", is_on ) );
  if ( is_on )
    followInEditor( event );
}

const MOST_SWING = 0.985;

function swingRatio() {
  return Math.min( SWING_AMOUNT, MOST_SWING );
}

function isSwung() {
  return SWING_AMOUNT > 0.5 && !isCompoundMeter( SHEET.meter );
}

function swungTimeOf( position ) {
  if ( !isSwung() )
    return position;
  const beat = 1 / 4;
  const beat_start = Math.floor( position / beat + EPSILON ) * beat;
  const within = ( position - beat_start ) / beat;
  const performed = within <= 0.5
    ? within * 2 * swingRatio()
    : swingRatio() + ( within - 0.5 ) * 2 * ( 1 - swingRatio() );
  return beat_start + performed * beat;
}

function straightTimeOf( performed_position ) {
  if ( !isSwung() )
    return performed_position;
  const beat = 1 / 4;
  const beat_start = Math.floor( performed_position / beat + EPSILON ) * beat;
  const within = ( performed_position - beat_start ) / beat;
  const written = within <= swingRatio()
    ? within / ( 2 * swingRatio() )
    : 0.5 + ( within - swingRatio() ) / ( 2 * ( 1 - swingRatio() ) );
  return beat_start + written * beat;
}

function audioTimeAt( position, start_time, from ) {
  return start_time + ( swungTimeOf( position ) - swungTimeOf( from ) ) * secondsPerWholeNoteOf( SHEET );
}

function scheduleHighlight( event, starts_at, ends_at ) {
  const delayUntil = time => Math.max( 0, time - AUDIO_CONTEXT.currentTime ) * 1000;
  HIGHLIGHT_TIMEOUTS.push( setTimeout( () => highlight( event, true ), delayUntil( starts_at ) ) );
  if ( ends_at !== Infinity )
    HIGHLIGHT_TIMEOUTS.push( setTimeout( () => highlight( event, false ), delayUntil( ends_at ) ) );
}

function scheduleGraces( graces, begins_at, note_seconds, voice ) {
  const grace_seconds = Math.min( 0.06, note_seconds / ( graces.length + 2 ) );
  graces.forEach( ( pitch, index ) => scheduleNote( pitch, begins_at + index * grace_seconds, grace_seconds, voice ) );
  return graces.length * grace_seconds;
}

function scheduleOccurrence( staff, item, plan ) {
  const { event, index, segment } = item;
  const audioTimeOf = position => audioTimeAt( position, plan.startTime, plan.from );
  const performed_start = item.performedAt( Math.max( item.start, segment.start ) );
  const performed_end = item.performedAt( Math.min( item.end, segment.end ) );
  if ( performed_end <= plan.from + EPSILON || performed_start >= plan.until - EPSILON )
    return;
  const begins_here = item.start >= segment.start - EPSILON && performed_start >= plan.from - EPSILON;
  const grace_delay = begins_here && event.graces
    ? scheduleGraces( event.graces, audioTimeOf( performed_start ), audioTimeOf( performed_end ) - audioTimeOf( performed_start ), plan.voices.get( staff ) )
    : 0;
  const is_staccato = event.articulations?.includes( "staccato" );
  event.pitches
    .filter( pitch => !isContinuing( staff, index, pitch ) || item.start <= segment.start + EPSILON )
    .forEach( pitch => {
      const chain_end = Math.min( item.start + tiedDurationOf( staff, index, pitch ), segment.end );
      const sound_end = is_staccato ? item.start + ( chain_end - item.start ) * 0.5 : chain_end;
      const sound_start = Math.max( performed_start, plan.from );
      const performed_sound_end = item.performedAt( sound_end );
      if ( performed_sound_end <= plan.from + EPSILON )
        return;
      const rings_through_hold = plan.stopsForFermata && performed_sound_end >= plan.until - EPSILON;
      const starts_at = audioTimeOf( sound_start ) + grace_delay;
      const seconds = rings_through_hold ? 60 : audioTimeOf( performed_sound_end ) - starts_at;
      const note = scheduleNote( pitch, starts_at, seconds, plan.voices.get( staff ), { ...soundStyleOf( event ), held: rings_through_hold } );
      if ( rings_through_hold )
        HELD_NOTES.push( note );
    });
  const highlight_end = plan.stopsForFermata && performed_end >= plan.until - EPSILON ? Infinity : audioTimeOf( performed_end );
  scheduleHighlight( event, audioTimeOf( Math.max( performed_start, plan.from ) ), highlight_end );
}

function startTimeOf( item, plan ) {
  const performed_start = item.performedAt( Math.max( item.start, item.segment.start ) );
  return audioTimeAt( Math.max( performed_start, plan.from ), plan.startTime, plan.from );
}

function noteQueueOf( plan ) {
  return SHEET.staves
    .flatMap( staff => occurrencesOf( staff, plan.performance ).map( item => ( { staff, item, startsAt: startTimeOf( item, plan ) } ) ) )
    .sort( ( a, b ) => a.startsAt - b.startsAt );
}

function scheduleAhead( plan ) {
  const now = AUDIO_CONTEXT.currentTime;
  const horizon = now + ( document.hidden ? HIDDEN_LOOKAHEAD_SECONDS : LOOKAHEAD_SECONDS );
  while ( plan.next < plan.queue.length && plan.queue[ plan.next ].startsAt <= horizon ) {
    const { staff, item, startsAt: starts_at } = plan.queue[ plan.next ];
    if ( starts_at >= now - LATE_SECONDS && !staff.muted )
      scheduleOccurrence( staff, item, plan );
    plan.next++;
  }
  plan.metronome( horizon );
}

document.addEventListener( "visibilitychange", () => {
  if ( PLAYING && ACTIVE_PLAN )
    scheduleAhead( ACTIVE_PLAN );
});

function currentPosition() {
  if ( !PLAYING )
    return PLAYBACK_POSITION;
  const seconds_played = Math.max( 0, AUDIO_CONTEXT.currentTime - PLAYBACK_ORIGIN.time );
  const position = straightTimeOf( swungTimeOf( PLAYBACK_ORIGIN.position ) + seconds_played / secondsPerWholeNoteOf( SHEET ) );
  return Math.min( position, PLAYBACK_ORIGIN.until );
}

function startPlayback() {
  const performance = performanceOf( SHEET );
  const song_length = totalDurationOf( SHEET );
  if ( PLAYBACK_POSITION >= song_length - EPSILON )
    PLAYBACK_POSITION = 0;
  PLAYING = true;
  PLAY_BUTTON.classList.add( "pausable" );
  PLAY_BUTTON.classList.remove( "holding" );
  AUDIO_CONTEXT = new AudioContext();
  AUDIO_MIX = buildMix( AUDIO_CONTEXT );
  const voices = new Map( SHEET.staves.map( staff => [ staff, buildVoice( AUDIO_MIX, staff.instrument ) ] ) );

  const start_time = AUDIO_CONTEXT.currentTime + 0.05;
  const fermata_at = nextFermataAfter( PLAYBACK_POSITION, performance );
  const until = Math.min( fermata_at, song_length );
  const stops_for_fermata = fermata_at <= song_length + EPSILON;
  const plan = { performance, songLength: song_length, startTime: start_time, from: PLAYBACK_POSITION, until, stopsForFermata: stops_for_fermata, voices };
  PLAYBACK_ORIGIN = { time: start_time, position: PLAYBACK_POSITION, until };

  plan.metronome = metronomeOf( start_time, AUDIO_MIX.compressor, PLAYBACK_POSITION, until );
  plan.queue = noteQueueOf( plan );
  plan.next = 0;
  ACTIVE_PLAN = plan;
  scheduleAhead( plan );
  SCHEDULER_TIMER = setInterval( () => scheduleAhead( plan ), 500 );
  startPlayhead();

  const seconds_left = audioTimeAt( until, 0, PLAYBACK_POSITION );
  HIGHLIGHT_TIMEOUTS.push( setTimeout( stops_for_fermata ? () => holdFermata( until ) : finishPlayback, ( seconds_left + ( stops_for_fermata ? 0 : 0.1 ) ) * 1000 ) );
}

function holdFermata( position ) {
  PLAYING = false;
  HOLDING = true;
  PLAYBACK_POSITION = position;
  PLAY_BUTTON.classList.remove( "pausable" );
  PLAY_BUTTON.classList.add( "holding" );
  showPosition( position );
  placePlayhead( position );
}

function continueAfterFermata() {
  const held_context = AUDIO_CONTEXT;
  clearInterval( SCHEDULER_TIMER );
  HELD_NOTES.forEach( note => note.letGo() );
  HELD_NOTES = [];
  HIGHLIGHT_TIMEOUTS.forEach( clearTimeout );
  HIGHLIGHT_TIMEOUTS = [];
  SHEET.staves.forEach( staff => staff.events.forEach( event => highlight( event, false ) ) );
  setTimeout( () => held_context.close(), 400 );
  AUDIO_CONTEXT = null;
  HOLDING = false;
  if ( PLAYBACK_POSITION >= totalDurationOf( SHEET ) - EPSILON )
    finishPlayback();
  else
    startPlayback();
}

function pausePlayback() {
  PLAYBACK_POSITION = currentPosition();
  stopPlayback();
  showPosition( PLAYBACK_POSITION );
  placePlayhead( PLAYBACK_POSITION );
}

function finishPlayback() {
  stopPlayback();
  PLAYBACK_POSITION = 0;
  showPosition( 0 );
}

function stopPlayback() {
  PLAYING = false;
  HOLDING = false;
  HELD_NOTES = [];
  PLAY_BUTTON.classList.remove( "pausable" );
  PLAY_BUTTON.classList.remove( "holding" );

  clearInterval( SCHEDULER_TIMER );
  HIGHLIGHT_TIMEOUTS.forEach( clearTimeout );
  HIGHLIGHT_TIMEOUTS = [];
  SHEET.staves.forEach( staff => staff.events.forEach( event => highlight( event, false ) ) );
  resetMetronome();
  stopPlayhead();

  if ( AUDIO_CONTEXT ) {
    fadeOutAndClose( AUDIO_CONTEXT, AUDIO_MIX );
    AUDIO_CONTEXT = null;
    AUDIO_MIX = null;
  }
}

function fadeOutAndClose( context, mix ) {
  mix.master.gain.setTargetAtTime( 0, context.currentTime, 0.015 );
  setTimeout( () => context.close(), 150 );
}

PLAY_BUTTON.addEventListener( "click", () => {
  if ( HOLDING )
    continueAfterFermata();
  else if ( PLAYING )
    pausePlayback();
  else
    startPlayback();
});

function spaceTogglesPlayback( target ) {
  const typing = [ "SELECT", "TEXTAREA" ].includes( target.tagName );
  return OUTPUT.contains( target ) && !SOUND_PANEL.contains( target ) && !typing;
}

document.addEventListener( "keydown", event => {
  if ( event.code !== "Space" || !spaceTogglesPlayback( document.activeElement ) )
    return;
  event.preventDefault();
  PLAY_BUTTON.click();
});

