const ERAS = [ "1.0", "2.0", "3.0", "4.0" ];

function applyTheme( theme ) {
  document.body.classList.toggle( "dark", theme === "night" );
}

function applyEra( era ) {
  ERA_STYLE.href = `css/web${ era[ 0 ] }.css`;
  ERA_BUTTON.textContent = era;
}

THEME_BUTTON.addEventListener( "click", () => {
  const theme = document.body.classList.contains( "dark" ) ? "day" : "night";
  localStorage.setItem( "theme", theme );
  applyTheme( theme );
});

ERA_BUTTON.addEventListener( "click", () => {
  const era = ERAS[ ( ERAS.indexOf( ERA_BUTTON.textContent ) + 1 ) % ERAS.length ];
  localStorage.setItem( "era", era );
  applyEra( era );
});

applyTheme( localStorage.getItem( "theme" ) === "night" ? "night" : "day" );
applyEra( ERAS.includes( localStorage.getItem( "era" ) ) ? localStorage.getItem( "era" ) : "4.0" );
