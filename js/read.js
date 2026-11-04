function base64OfBytes( bytes ) {
  return btoa( Array.from( bytes, byte => String.fromCharCode( byte ) ).join( "" ) );
}

function bytesOfBase64( encoded ) {
  return Uint8Array.from( atob( encoded ), character => character.charCodeAt( 0 ) );
}

function base64Encode( text ) {
  return base64OfBytes( new TextEncoder().encode( text ) );
}

function base64Decode( encoded ) {
  return new TextDecoder().decode( bytesOfBase64( encoded ) );
}

function urlSafe( encoded ) {
  return encoded.replaceAll( "+", "-" ).replaceAll( "/", "_" ).replace( /=+$/, "" );
}

function fromUrlSafe( encoded ) {
  return encoded.replaceAll( "-", "+" ).replaceAll( "_", "/" );
}

async function compressedOf( text ) {
  const stream = new Blob( [ text ] ).stream().pipeThrough( new CompressionStream( "deflate-raw" ) );
  const bytes = new Uint8Array( await new Response( stream ).arrayBuffer() );
  return urlSafe( base64OfBytes( bytes ) );
}

async function decompressedOf( encoded ) {
  const bytes = bytesOfBase64( fromUrlSafe( encoded ) );
  const stream = new Blob( [ bytes ] ).stream().pipeThrough( new DecompressionStream( "deflate-raw" ) );
  return new Response( stream ).text();
}

async function sheetFromLink() {
  const parameters = new URLSearchParams( location.search );
  try {
    if ( parameters.has( "s" ) )
      return await decompressedOf( parameters.get( "s" ) );
    if ( parameters.has( "sheet" ) )
      return base64Decode( parameters.get( "sheet" ) );
  } catch {
    return null;
  }
  return null;
}

async function loadSheet() {
  const text = await sheetFromLink() ?? localStorage.getItem( "sheet" );
  if ( text )
    EDITOR.value = text;
}

async function shareLinkOf( text ) {
  const url = new URL( location );
  url.searchParams.delete( "sheet" );
  url.searchParams.set( "s", await compressedOf( text ) );
  return url;
}

function copyWithoutClipboard( text ) {
  const field = document.createElement( "textarea" );
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append( field );
  field.select();
  const copied = document.execCommand( "copy" );
  field.remove();
  return copied;
}

async function copyText( text ) {
  try {
    await navigator.clipboard.writeText( text );
    return true;
  } catch {
    return copyWithoutClipboard( text );
  }
}

let LATEST_REMEMBERED = 0;

function saveLocally( text ) {
  try {
    localStorage.setItem( "sheet", text );
    return true;
  } catch {
    return false;
  }
}

async function rememberSheet( text ) {
  saveLocally( text );
  const attempt = ++LATEST_REMEMBERED;
  const link = await shareLinkOf( text );
  if ( attempt === LATEST_REMEMBERED )
    history.replaceState( null, "", link );
}

const SHEET_LOADED = loadSheet();
