const POPUPS = [ volumePopup, swingPopup ];

function closePopups() {
  POPUPS.forEach( popup => popup.classList.remove( "open" ) );
}

function togglePopup( popup ) {
  const opening = !popup.classList.contains( "open" );
  closePopups();
  soundPanel.classList.remove( "open" );
  closeExportMenu();
  closeLookMenu();
  popup.classList.toggle( "open", opening );
}

volumeButton.addEventListener( "click", event => {
  event.stopPropagation();
  togglePopup( volumePopup );
});

swingButton.addEventListener( "click", event => {
  event.stopPropagation();
  togglePopup( swingPopup );
});

document.addEventListener( "click", event => {
  if ( !POPUPS.some( popup => popup.contains( event.target ) ) )
    closePopups();
});
