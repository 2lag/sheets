const playhead = document.createElementNS( "http://www.w3.org/2000/svg", "rect" );
let playheadFrame = null;
let playheadSystem = null;

playhead.setAttribute( "class", "playhead" );
playhead.setAttribute( "width", 0.5 * SPACE );
playhead.setAttribute( "rx", 0.25 * SPACE );

function playheadXAt( time ) {
  const index = Math.max( 0, playheadStops.findLastIndex( stop => stop.time <= time + EPSILON ) );
  const stop = playheadStops[ index ];
  const next = playheadStops[ index + 1 ];
  if ( !next || next.system !== stop.system )
    return { x: stop.x, system: stop.system };
  const progress = ( time - stop.time ) / ( next.time - stop.time );
  return { x: stop.x + ( next.x - stop.x ) * Math.min( 1, progress ), system: stop.system };
}

function placePlayhead( time, followIt = true ) {
  if ( !playheadStops.length )
    return;
  const { x, system } = playheadXAt( scorePositionOf( time ) );
  playhead.setAttribute( "x", x - 0.25 * SPACE );
  if ( system === playheadSystem )
    return;
  playheadSystem = system;
  const top = system.y + system.staffTops[ 0 ] - 2 * SPACE;
  const bottom = system.y + system.staffTops.at( -1 ) + 6 * SPACE;
  playhead.setAttribute( "y", top );
  playhead.setAttribute( "height", bottom - top );
  system.page.appendChild( playhead );
  if ( followIt )
    playhead.scrollIntoView( { block: "center", inline: "nearest", behavior: "smooth" } );
}

function startPlayhead() {
  const follow = () => {
    if ( !playing )
      return;
    const position = currentPosition();
    placePlayhead( position );
    showPosition( position );
    playheadFrame = requestAnimationFrame( follow );
  };
  follow();
}

function stopPlayhead() {
  cancelAnimationFrame( playheadFrame );
  playheadSystem = null;
  playhead.remove();
}
