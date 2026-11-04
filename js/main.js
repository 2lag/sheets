let sheet = parseSheet( "" );
let pendingRender = null;
let problemMarks = [];

function columnOf( problem, lineText ) {
  if ( Number.isInteger( problem.column ) )
    return problem.column;
  return Math.max( 0, lineText.indexOf( problem.token ) );
}

function problemRangeOf( problem, lineText ) {
  const start = columnOf( problem, lineText );
  const mark = document.createElement( "mark" );
  mark.dataset.reason = `${ problem.token }: ${ problem.reason }`;
  problemMarks.push( mark );
  return { start, end: Math.max( start + 1, start + String( problem.token ).length ), element: mark };
}

function noteRangesOn( lineNumber, events ) {
  const ranges = new Map();
  events.forEach( event => sourcesOf( event )
    .filter( source => source.line === lineNumber && source.token )
    .forEach( source => {
      if ( !ranges.has( source.column ) )
        ranges.set( source.column, { start: source.column, end: source.column + source.token.length, element: document.createElement( "span" ) } );
      event.textMarks.push( ranges.get( source.column ).element );
    }));
  return [ ...ranges.values() ];
}

function sourcesOf( event ) {
  return [ event, ...( event.graceSources || [] ) ];
}

function markedLine( lineText, ranges ) {
  const pieces = [];
  let written = 0;
  ranges
    .sort( ( a, b ) => a.start - b.start )
    .forEach( ( { start, end, element } ) => {
      if ( start < written )
        return;
      if ( end > start )
        element.textContent = lineText.slice( start, end ) || " ";
      pieces.push( lineText.slice( written, start ), element );
      written = end;
    });
  pieces.push( lineText.slice( written ) );
  return pieces;
}

function showMarks( problems, parsed ) {
  problemMarks = [];
  const events = parsed.staves.flatMap( staff => staff.events );
  events.forEach( event => event.textMarks = [] );
  const measureStarts = measureStartsOf( parsed );
  const lines = editor.value.split( "\n" );
  const pieces = lines.flatMap( ( lineText, index ) => {
    const problemRanges = problems.filter( problem => problem.line === index + 1 ).map( problem => problemRangeOf( problem, lineText ) );
    const ranges = [ ...barRangesOn( index + 1, lineText, measureStarts ), ...problemRanges, ...noteRangesOn( index + 1, events ) ];
    return [ ...markedLine( lineText, ranges ), "\n" ];
  });
  highlights.replaceChildren( ...pieces, " " );
  followEditorScroll();
}

function followEditorScroll() {
  highlights.scrollTop = editor.scrollTop;
  highlights.scrollLeft = editor.scrollLeft;
}

function markUnder( x, y ) {
  return problemMarks.find( mark => [ ...mark.getClientRects() ].some( box =>
    x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
  ));
}

function showProblemTip( event ) {
  const mark = markUnder( event.clientX, event.clientY );
  problemTip.classList.toggle( "shown", Boolean( mark ) );
  if ( !mark )
    return;
  problemTip.textContent = mark.dataset.reason;
  problemTip.style.left = event.clientX + 12 + "px";
  problemTip.style.top = event.clientY + 16 + "px";
}

function hideProblemTip() {
  problemTip.classList.remove( "shown" );
}

function refreshScore() {
  stopPlayback();
  sheet = parseSheet( editor.value );
  renderScore( sheet );
  playbackPosition = Math.min( playbackPosition, totalDurationOf( sheet ) );
  showPosition( playbackPosition );
  if ( playbackPosition > 0 )
    placePlayhead( playbackPosition, false );
  showMarks( sheet.problems, sheet );
  rememberSheet( editor.value );
  showNoteHint();
  showSheetInstruments();
}

function refreshSoon() {
  clearTimeout( pendingRender );
  pendingRender = setTimeout( () => {
    refreshScore();
    showEditedNote();
  }, 150 );
}

function resizePanels( event ) {
  const bounds = workspace.getBoundingClientRect();
  const percent = ( event.clientX - bounds.left ) / bounds.width * 100;
  writing.style.width = Math.min( 80, Math.max( 15, percent ) ) + "%";
}

function stopResizing() {
  document.body.classList.remove( "resizing" );
  document.removeEventListener( "pointermove", resizePanels );
}

function closeExportMenu() {
  exportMenu.classList.remove( "open" );
}

function placeMenu( menu ) {
  menu.style.top = `${ header.getBoundingClientRect().bottom }px`;
}

new ResizeObserver( () => [ exportMenu, lookMenu ].forEach( placeMenu ) ).observe( header );

function closeLookMenu() {
  lookMenu.classList.remove( "open" );
}

splitter.addEventListener( "pointerdown", event => {
  event.preventDefault();
  document.body.classList.add( "resizing" );
  document.addEventListener( "pointermove", resizePanels );
  document.addEventListener( "pointerup", stopResizing, { once: true } );
});

exportButton.addEventListener( "click", event => {
  event.stopPropagation();
  soundPanel.classList.remove( "open" );
  closeLookMenu();
  closePopups();
  placeMenu( exportMenu );
  exportMenu.classList.toggle( "open" );
});

lookButton.addEventListener( "click", event => {
  event.stopPropagation();
  soundPanel.classList.remove( "open" );
  closeExportMenu();
  closePopups();
  placeMenu( lookMenu );
  lookMenu.classList.toggle( "open" );
});

document.addEventListener( "click", event => {
  if ( !exportMenu.contains( event.target ) )
    closeExportMenu();
  if ( !lookMenu.contains( event.target ) )
    closeLookMenu();
});

helpButton.addEventListener( "click", () => help.showModal() );
closeHelpButton.addEventListener( "click", () => help.close() );

help.addEventListener( "click", event => {
  const box = help.getBoundingClientRect();
  const clickedOutside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  if ( event.target === help && clickedOutside )
    help.close();
});

editor.addEventListener( "input", () => {
  showMarks( [], parseSheet( editor.value ) );
  refreshSoon();
});
editor.addEventListener( "scroll", followEditorScroll );
editor.addEventListener( "mousemove", showProblemTip );
editor.addEventListener( "mouseleave", hideProblemTip );
Promise.allSettled( [ document.fonts.load( "28px Bravura" ), sheetLoaded ] ).then( refreshScore );
