let RESUME_AFTER_SEEKING = false;

function placeSeekerThumb() {
  const track = SEEKER.getBoundingClientRect();
  const bar = TRANSPORT.getBoundingClientRect();
  const thumb = SEEKER_THUMB.getBoundingClientRect();
  const travel = track.width - thumb.width;
  const left = track.left - bar.left + travel * SEEKER.value / SEEKER.max;
  const top = track.top - bar.top + ( track.height - thumb.height ) / 2;
  const snap = pixels => Math.round( pixels * devicePixelRatio ) / devicePixelRatio;
  SEEKER_THUMB.style.transform = `translate( ${ snap( left ) }px, ${ snap( top ) }px )`;
}

function clockTimeOf( seconds ) {
  const whole_seconds = Math.floor( seconds );
  return `${ Math.floor( whole_seconds / 60 ) }:${ String( whole_seconds % 60 ).padStart( 2, "0" ) }`;
}

function showPosition( position ) {
  const pass_length = passLengthOf( SHEET );
  const shown = shownPositionOf( position );
  const seconds_per_whole_note = secondsPerWholeNoteOf( SHEET );
  const total = SHEET.loop ? "∞" : clockTimeOf( pass_length * seconds_per_whole_note );
  SEEKER.value = pass_length ? shown / pass_length * SEEKER.max : 0;
  CLOCK.textContent = `${ clockTimeOf( shown * seconds_per_whole_note ) } / ${ total }`;
  placeSeekerThumb();
}

function positionOfSeeker() {
  return SEEKER.value / SEEKER.max * passLengthOf( SHEET );
}

SEEKER.addEventListener( "input", () => {
  if ( HOLDING )
    stopPlayback();
  if ( PLAYING ) {
    RESUME_AFTER_SEEKING = true;
    stopPlayback();
  }
  PLAYBACK_POSITION = positionOfSeeker();
  placePlayhead( PLAYBACK_POSITION );
  showPosition( PLAYBACK_POSITION );
});

SEEKER.addEventListener( "change", () => {
  if ( RESUME_AFTER_SEEKING )
    startPlayback();
  RESUME_AFTER_SEEKING = false;
});

new ResizeObserver( placeSeekerThumb ).observe( TRANSPORT );
ERA_STYLE.addEventListener( "load", placeSeekerThumb );
