#!/usr/bin/env node

const HCCrawler = require( "headless-chrome-crawler" ),
      cliProgress = require( "cli-progress" ),
      fs = require( "fs" ),
      { name, version } = require( "./package.json" ),
      argv = require( "minimist" )( process.argv.slice( 2 ) ),
      normalizeLink = ( link ) => link.replace( /\/$/, "" ).replace( /\?.*$/, "" ),
      getBaseUrl = ( url ) => new URL( url ).origin,
      truncateUrl = ( url, max = 55 ) => {
        if ( url.length <= max ) { return url; }
        const half = Math.floor( ( max - 3 ) / 2 );
        return url.slice( 0, half ) + "..." + url.slice( -half );
      },
      isTTY = !!process.stdout.isTTY,
      showUsage = () => console.log( `${ name } <url> <keyword> [options]

where:

<url>              base URL (e.g. https://dsheiko.com)
<keyword>          keyword or regex pattern to search for
-i                 case-insensitive match
--regex            treat keyword as a regular expression
--depth N          limit crawl depth (default: unlimited)
--concurrency N    parallel pages (default: 1)
--max N            stop after N pages
--output file      write matched URLs to a file
--help, -h         show this help
` );

if ( argv.help || argv.h ) {
  showUsage();
  process.exit( 0 );
}

async function main( startUrl, keyword, opts ) {
  const { caseInsensitive, useRegex, depth, concurrency, maxPages, outputFile } = opts,
        links = new Set(),
        results = [],
        errors = [],
        startTime = Date.now(),
        baseUrl = getBaseUrl( startUrl ),
        startHostname = new URL( startUrl ).hostname,
        pattern = useRegex
          ? new RegExp( keyword, caseInsensitive ? "i" : "" )
          : null,
        matches = ( text ) => pattern
          ? pattern.test( text )
          : caseInsensitive
            ? text.toLowerCase().includes( keyword.toLowerCase() )
            : text.includes( keyword );

  const bar = isTTY
    ? new cliProgress.SingleBar( {
        format: " {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted} | {url}"
      }, cliProgress.Presets.shades_classic )
    : null;

  const crawler = await HCCrawler.launch({
    // --no-sandbox required in WSL2/Docker; ignoreHTTPSErrors needed because the
    // bundled Chromium (2018) has an outdated root cert store
    args: [ "--no-sandbox", "--disable-setuid-sandbox" ],
    ignoreHTTPSErrors: true,
    allowedDomains: [ startHostname ],
    waitUntil: "domcontentloaded",
    maxDepth: depth,
    maxConcurrency: concurrency,
    maxRequest: maxPages,
    evaluatePage: (() => ({
      body: $( "body" ).text(),
    })),
    onSuccess: ( result ) => {
      if ( matches( result.result.body ) ) {
        results.push( result.response.url );
      }
      result.links.forEach( ( link ) => {
        const nLink = normalizeLink( link );
        let hostname;
        try { hostname = new URL( nLink ).hostname; } catch ( e ) { return; }
        if ( hostname !== startHostname || links.has( nLink ) ) {
          return;
        }
        links.add( nLink );
        if ( bar ) { bar.setTotal( links.size ); }
        crawler.queue( nLink );
      });
      if ( bar ) { bar.increment( 1, { url: truncateUrl( result.response.url ) } ); }
    },
    onError: ( error ) => {
      const url = error.options && error.options.url ? error.options.url : "unknown";
      errors.push( url );
      if ( bar ) { bar.increment( 1, { url: `[error] ${ truncateUrl( url ) }` } ); }
    }
  });

  let summarized = false;
  const printSummary = () => {
    if ( summarized ) { return; }
    summarized = true;
    if ( bar ) {
      bar.update( links.size, { url: "" } );
      bar.stop();
    }
    const elapsed = ( ( Date.now() - startTime ) / 1000 ).toFixed( 1 );
    if ( results.length ) {
      console.log( `\nFound ${ results.length } match${ results.length === 1 ? "" : "es" }:` );
      results.forEach( url => console.log( `  ${ url }` ) );
      if ( outputFile ) {
        fs.writeFileSync( outputFile, results.join( "\n" ) + "\n" );
        console.log( `\nResults saved to ${ outputFile }` );
      }
    } else {
      console.log( `\nNo matches found.` );
    }
    if ( errors.length ) {
      console.log( `\nFailed to crawl (${ errors.length }):` );
      errors.forEach( url => console.log( `  ${ url }` ) );
    }
    console.log( `\n${ links.size } links processed in ${ elapsed }s` );
  };

  process.on( "SIGINT", async () => {
    try { await crawler.close(); } catch ( e ) { /* already closing */ }
    printSummary();
    process.exit( 0 );
  });

  crawler.on( "disconnected", printSummary );

  if ( isTTY ) { console.log( `looking for "${ keyword }" at ${ startUrl }` ); }
  links.add( startUrl );
  if ( bar ) { bar.start( 1, 0, { url: truncateUrl( startUrl ) } ); }
  await crawler.queue( startUrl );
  // small delay so onIdle() sees the queued item as in-flight before checking
  await new Promise( resolve => setTimeout( resolve, 500 ) );
  await crawler.onIdle();
  await crawler.close();
}

if ( isTTY ) {
  console.log( `${ name }@${ version } – A Command-Line Tool for Web Scraping & Searching\n` );
}

if ( argv._.length === 2 ) {
  const [ startUrl, keyword ] = argv._,
        normalized = normalizeLink( startUrl );

  if ( !/^https?:\/\//i.test( normalized ) ) {
    console.error( `Error: URL must use http:// or https://` );
    process.exit( 1 );
  }

  if ( argv.regex ) {
    try {
      new RegExp( keyword );
    } catch ( e ) {
      console.error( `Error: invalid regex — ${ e.message }` );
      process.exit( 1 );
    }
  }

  main( normalized, keyword, {
    caseInsensitive: !!argv.i,
    useRegex:        !!argv.regex,
    depth:           argv.depth != null ? parseInt( argv.depth, 10 ) : undefined,
    concurrency:     argv.concurrency != null ? parseInt( argv.concurrency, 10 ) : 1,
    maxPages:        argv.max != null ? parseInt( argv.max, 10 ) : undefined,
    outputFile:      argv.output || null,
  });
} else {
  showUsage();
}
