let resumeAfterSeeking = false;

function placeSeekerThumb() {
  const track = seeker.getBoundingClientRect();
  const bar = transport.getBoundingClientRect();
  const thumb = seekerThumb.getBoundingClientRect();
  const travel = track.width - thumb.width;
  const left = track.left - bar.left + travel * seeker.value / seeker.max;
  const top = track.top - bar.top + ( track.height - thumb.height ) / 2;
  const snap = pixels => Math.round( pixels * devicePixelRatio ) / devicePixelRatio;
  seekerThumb.style.transform = `translate( ${ snap( left ) }px, ${ snap( top ) }px )`;
}

function clockTimeOf( seconds ) {
  const wholeSeconds = Math.floor( seconds );
  return `${ Math.floor( wholeSeconds / 60 ) }:${ String( wholeSeconds % 60 ).padStart( 2, "0" ) }`;
}

function showPosition( position ) {
  const passLength = passLengthOf( sheet );
  const shown = shownPositionOf( position );
  const secondsPerWholeNote = secondsPerWholeNoteOf( sheet );
  const total = sheet.loop ? "∞" : clockTimeOf( passLength * secondsPerWholeNote );
  seeker.value = passLength ? shown / passLength * seeker.max : 0;
  clock.textContent = `${ clockTimeOf( shown * secondsPerWholeNote ) } / ${ total }`;
  placeSeekerThumb();
}

function positionOfSeeker() {
  return seeker.value / seeker.max * passLengthOf( sheet );
}

seeker.addEventListener( "input", () => {
  if ( holding )
    stopPlayback();
  if ( playing ) {
    resumeAfterSeeking = true;
    stopPlayback();
  }
  playbackPosition = positionOfSeeker();
  placePlayhead( playbackPosition );
  showPosition( playbackPosition );
});

seeker.addEventListener( "change", () => {
  if ( resumeAfterSeeking )
    startPlayback();
  resumeAfterSeeking = false;
});

new ResizeObserver( placeSeekerThumb ).observe( transport );
eraStyle.addEventListener( "load", placeSeekerThumb );
