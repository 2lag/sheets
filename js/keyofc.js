let showInC = localStorage.getItem( "showInC" ) === "on";

function showKeyButton() {
  keyButton.classList.toggle( "on", showInC );
}

keyButton.addEventListener( "click", () => {
  showInC = !showInC;
  localStorage.setItem( "showInC", showInC ? "on" : "off" );
  showKeyButton();
  renderScore( sheet );
  if ( !playing && playbackPosition > 0 )
    placePlayhead( playbackPosition, false );
});

showKeyButton();
