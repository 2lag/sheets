function followedStaffOf( sheet ) {
  const heard = sheet.staves.filter( staff => !staff.muted );
  return heard.find( staff => staff.clef === "treble" ) || heard[ 0 ] || sheet.staves[ 0 ];
}

function isComfortablyVisible( top ) {
  const visible_top = EDITOR.scrollTop + EDITOR.clientHeight * 0.15;
  const visible_bottom = EDITOR.scrollTop + EDITOR.clientHeight * 0.75;
  return top >= visible_top && top <= visible_bottom;
}

function followInEditor( event ) {
  const mark = event.textMarks?.[ 0 ];
  if ( !mark || !followedStaffOf( SHEET ).events.includes( event ) || isComfortablyVisible( mark.offsetTop ) )
    return;
  EDITOR.scrollTo( { top: mark.offsetTop - EDITOR.clientHeight / 3, behavior: "smooth" } );
}

function eventAtCursor() {
  const place = cursorPlace();
  const touched = event => ( event.token && touches( event, place ) ) || ( event.graceSources || [] ).some( source => touches( source, place ) );
  return SHEET.staves.flatMap( staff => staff.events ).find( touched );
}

function isInView( mark ) {
  const note = mark.getBoundingClientRect();
  const view = SCORE.getBoundingClientRect();
  return note.top >= view.top && note.bottom <= view.bottom;
}

function showEditedNote() {
  const mark = eventAtCursor()?.marks?.[ 0 ];
  if ( mark && !isInView( mark ) )
    mark.scrollIntoView( { block: "center", inline: "nearest", behavior: "smooth" } );
}

function toggleListening() {
  document.body.classList.toggle( "listening" );
}

LISTEN_BUTTON.addEventListener( "click", toggleListening );
