function followedStaffOf( sheet ) {
  const heard = sheet.staves.filter( staff => !staff.muted );
  return heard.find( staff => staff.clef === "treble" ) || heard[ 0 ] || sheet.staves[ 0 ];
}

function isComfortablyVisible( top ) {
  const visibleTop = editor.scrollTop + editor.clientHeight * 0.15;
  const visibleBottom = editor.scrollTop + editor.clientHeight * 0.75;
  return top >= visibleTop && top <= visibleBottom;
}

function followInEditor( event ) {
  const mark = event.textMarks?.[ 0 ];
  if ( !mark || !followedStaffOf( sheet ).events.includes( event ) || isComfortablyVisible( mark.offsetTop ) )
    return;
  editor.scrollTo( { top: mark.offsetTop - editor.clientHeight / 3, behavior: "smooth" } );
}

function eventAtCursor() {
  const place = cursorPlace();
  const touched = event => ( event.token && touches( event, place ) ) || ( event.graceSources || [] ).some( source => touches( source, place ) );
  return sheet.staves.flatMap( staff => staff.events ).find( touched );
}

function isInView( mark ) {
  const note = mark.getBoundingClientRect();
  const view = score.getBoundingClientRect();
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

listenButton.addEventListener( "click", toggleListening );
