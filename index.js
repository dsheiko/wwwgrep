#!/usr/bin/env node

const HCCrawler = require( "headless-chrome-crawler" ),
      cliProgress = require( "cli-progress" ),
      { name, version } = require( "./package.json" ),
      argv = require( "minimist" )( process.argv.slice( 2 ) ),
      normalizeLink = ( link ) => link.replace( /\/$/, "" ).replace( /\?.*$/, "" ),
      getBaseUrl = ( url ) => new URL( url ).origin;

async function main( startUrl, keyword, insecure ) {
  const links = new Set(),
        results = [],
        errors = [],
        bar = new cliProgress.SingleBar( {
          format: ' {bar} {percentage}% | {value}/{total} | {url}'
        }, cliProgress.Presets.shades_classic ),
        baseUrl = getBaseUrl( startUrl );

  const crawler = await HCCrawler.launch({
    ignoreHTTPSErrors: insecure,
    evaluatePage: (() => ({
      body: $( "body" ).text(),
    })),
    onSuccess: ( result ) => {
      if ( result.result.body.includes( keyword ) ) {
        results.push( `- ${ result.response.url }` );
      }
      result.links.forEach( ( link ) => {
        const nLink = normalizeLink( link );
        if ( nLink === startUrl || !nLink.startsWith( baseUrl ) || links.has( nLink ) ) {
          return;
        }
        links.add( nLink );
        bar.setTotal( links.size );
        crawler.queue( nLink );
      });
      bar.increment( 1, { url: result.response.url } );
    },
    onError: ( error ) => {
      const url = error.options && error.options.url ? error.options.url : "unknown";
      errors.push( `- ${ url }` );
      bar.increment( 1, { url: `[error] ${ url }` } );
    }
  });

  crawler.on( "disconnected", () => {
    bar.update( links.size, { url: "" } );
    bar.stop();
    if ( results.length ) {
      console.log( `\nThe keyword found at` );
      results.forEach( l => console.log( l ) );
    } else {
      console.log( `\nThe keyword not found` );
    }
    if ( errors.length ) {
      console.log( `\nFailed to crawl (${ errors.length }):` );
      errors.forEach( l => console.log( l ) );
    }
    console.log( `\n${ links.size } links processed` );
  });

  console.log( `looking for "${ keyword }" at ${ startUrl }` );
  links.add( startUrl );
  bar.start( 1, 0, { url: startUrl } );
  await crawler.queue( startUrl );
  await crawler.onIdle();
  await crawler.close();
}

console.log( `${ name }@${ version } – A Command-Line Tool for Web Scraping & Searching\n` );

if ( argv._.length === 2 ) {
  const [ startUrl, keyword ] = argv._,
        insecure = !!argv.insecure,
        normalized = normalizeLink( startUrl );

  if ( !/^https?:\/\//i.test( normalized ) ) {
    console.error( `Error: URL must use http:// or https://` );
    process.exit( 1 );
  }

  main( normalized, keyword, insecure );
} else {
  console.log( `${ name } <url> <keyword> [--insecure]

where:

<url>           base URL (e.g. https://dsheiko.com)
<keyword>       keyword to look for (e.g. Puppetry)
--insecure      skip TLS certificate validation
`);
}
