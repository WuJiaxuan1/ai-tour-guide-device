const {chromium}=require('C:/Users/Macaroon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
(async()=>{
 let browser;try{browser=await chromium.launch({headless:true})}catch(e){browser=await chromium.launch({headless:true,channel:'msedge'})}
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL('C:/Users/Macaroon/.codex/visualizations/2026/10/27/01a17e29-557a-7b90-ac22-3cc5602eb60f/front-rim-measurement-preview.html').href);
 const root=page.frameLocator('iframe').locator('#stopwatch-rim-measurement');
 for(const width of [800,360]){
  await page.setViewportSize({width,height:1000});await root.locator('circle').first().waitFor();
  await root.screenshot({path:`F:/coding_projects/ai-tour-guide-device/modeling/v01/previews/front-rim-measurement-${width}.png`});
  console.log(JSON.stringify({viewport:width,dimensions:await root.boundingBox(),svgCount:await root.locator('svg').count()}));
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('BROWSER_RENDER_OK');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
