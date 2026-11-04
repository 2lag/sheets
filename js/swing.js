let swingAmount = Number( localStorage.getItem( "swing" ) ) || 0.5;

function showSwing() {
  swingSlider.value = Math.round( swingAmount * 100 );
  swingReadout.textContent = swingAmount > 0.5 ? `${ swingSlider.value }%` : "off";
  swingButton.classList.toggle( "on", swingAmount > 0.5 );
}

swingSlider.addEventListener( "input", () => {
  swingAmount = swingSlider.value / 100;
  localStorage.setItem( "swing", swingAmount );
  showSwing();
  restartPlaybackSoon();
});

showSwing();
