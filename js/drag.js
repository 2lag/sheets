const GRABBABLE_EXCEPT = [ "INPUT", "SELECT", "OPTION", "BUTTON", "TEXTAREA" ];
let dragOffset = null;

function hasTitleBar() {
  return getComputedStyle( soundTitle ).display !== "none";
}

function canGrab( target ) {
  if ( hasTitleBar() )
    return soundTitle.contains( target );
  return !GRABBABLE_EXCEPT.includes( target.tagName );
}

function placeSoundPanel( left, top ) {
  const box = soundPanel.getBoundingClientRect();
  const keptLeft = Math.min( Math.max( 0, left ), innerWidth - box.width );
  const keptTop = Math.min( Math.max( 0, top ), innerHeight - Math.min( box.height, 48 ) );
  soundPanel.classList.add( "moved" );
  Object.assign( soundPanel.style, { left: `${ keptLeft }px`, top: `${ keptTop }px` } );
}

soundPanel.addEventListener( "pointerdown", event => {
  if ( !canGrab( event.target ) )
    return;
  event.preventDefault();
  const box = soundPanel.getBoundingClientRect();
  dragOffset = { x: event.clientX - box.left, y: event.clientY - box.top };
  soundPanel.setPointerCapture( event.pointerId );
  document.body.classList.add( "dragging" );
});

soundPanel.addEventListener( "pointermove", event => {
  if ( dragOffset )
    placeSoundPanel( event.clientX - dragOffset.x, event.clientY - dragOffset.y );
});

soundPanel.addEventListener( "pointerup", () => {
  dragOffset = null;
  document.body.classList.remove( "dragging" );
});

addEventListener( "resize", () => {
  if ( soundPanel.classList.contains( "moved" ) )
    placeSoundPanel( parseFloat( soundPanel.style.left ), parseFloat( soundPanel.style.top ) );
});
