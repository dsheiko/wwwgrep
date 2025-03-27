#!/usr/bin/env node

const HCCrawler = require( "headless-chrome-crawler" ),
      cliProgress = require( "cli-progress" ),
      { name, version } = require( "./package.json" ),
      argv = require( "minimist" )( process.argv.slice( 2 ) ),
      // create a new progress bar instance and use shades_classic theme
      bar = new cliProgress.SingleBar( {
            format: ' {bar} {percentage}% | {value}/{total} | {url}'
        }, cliProgress.Presets.shades_classic ),
      links = new Set(),
      normalizeLink = ( link ) => link.replace( /\/$/, "" ).replace( /\?.*$/, "" ),
      getBaseUrl = ( url ) => {
        const [ protocol, _, host ] = url.trim().split( "/" );
        return `${ protocol }//${ host }`;
      },
      results = [];

let counter = 1;


async function main( startUrl, keyword ) {
  const checkResult = ( r ) => {
        if ( r.result.body.includes( keyword ) ) {
            results.push( `- ${ r.response.url }` );
        }
      },
      baseUrl = getBaseUrl( startUrl ),
      crawler = await HCCrawler.launch({
        ignoreHTTPSErrors: true,
        // Function to be evaluated in browsers
        evaluatePage: (() => ({
          //title: $( "title" ).text(),
          body: $( "body" ).text(),
        })),
        // Function to be called with evaluated results from browsers
        onSuccess: ( result ) => {
            checkResult( result );
            result.links.forEach( ( link ) => {
                const nLink = normalizeLink( link );
                if ( nLink === startUrl || !nLink.startsWith( baseUrl ) ) {
                    return;
                }
                if ( links.has( nLink ) ) {
                    return;
                }
                links.add( nLink );
                crawler.queue( nLink );
            });
            bar.start( links.size, ++counter, { url: result.response.url } );
        },
        onError: ( error ) => {
          // console.error( "Something went wrong", error );
        }
        
    });

  crawler.on("disconnected", () => {
    bar.update( links.size, { url: "" } );
    bar.stop();    
    if ( results.length ) {
      console.log( `\nThe keyword found at` );
      results.forEach( l => console.log( l ) );
    } else {
      console.log( `\nThe keyword not found` );
    }
    console.log( `\n${ links.size } links processed` );
  });

  console.log( `looking for "${ keyword }" at ${ startUrl }` );
  links.add( startUrl );
  // Queue a request
  await crawler.queue( startUrl );
  setTimeout(async () => {  
    await crawler.onIdle(); // Resolved when no queue is left
    await crawler.close(); // Close the crawler  
  }, 500 );
}

console.log( `${ name }@${ version } – A Command-Line Tool for Web Scraping & Searching\n` );

if ( argv._.length === 2 ) {
  const [ startUrl, keyword ] = argv._;
  main( normalizeLink( startUrl ), keyword );
} else {
  console.log( `${ name } <url> <keyword>

where:

<url>           base URL (e.g. https://dsheiko.com)
<keyword>       keyword to look for (e.g. Puppetry)
`);
}