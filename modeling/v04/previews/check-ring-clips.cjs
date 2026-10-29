const {chromium}=require('C:/Users/Macaroon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 let browser;try{browser=await chromium.launch({headless:true});}catch{browser=await chromium.launch({channel:'msedge',headless:true});}
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [736,360]){
  await page.setViewportSize({width,height:1000});
  await page.goto('file:///C:/Users/Macaroon/.codex/visualizations/2026/10/27/01a17e29-557a-7b90-ac22-3cc5602eb60f/hidden-ring-clips-preview.html');
  const frame=page.frameLocator('iframe');await frame.locator('.section path').first().waitFor();
  for(const state of ['insert','release','locked']){await frame.locator('[data-state="'+state+'"]').click();if(await frame.locator('[data-state="'+state+'"]').getAttribute('aria-pressed')!=='true')throw Error('state failed');}
  await page.screenshot({path:'C:/Users/Macaroon/.codex/visualizations/2026/10/27/01a17e29-557a-7b90-ac22-3cc5602eb60f/hidden-ring-clips-'+width+'.png',fullPage:true});
  console.log(JSON.stringify({width,overflow:await frame.locator('#ring-clips-explainer').evaluate(e=>e.scrollWidth>e.clientWidth),errors}));
 }
 await browser.close();if(errors.length)process.exitCode=1;
})();
