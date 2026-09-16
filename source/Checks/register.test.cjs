const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../Resources/dist');let checks=0;const errors=[];
function check(ok,label){assert.ok(ok,label);checks++;console.log('PASS',label)}
(async()=>{const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');let content=fs.readFileSync(f);if(f.endsWith('index-i8K__Uke.js'))content=content.toString()+'\nwindow.__qa={eval:code=>eval(code)}';res.end(content)}catch{res.statusCode=404;res.end()}}).listen(8883,'127.0.0.1');const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
try{

const p=await b.newPage();await p.goto('http://127.0.0.1:8883/threes/');await p.getByRole('button',{name:'SKIP',exact:true}).click();await p.locator('[data-suite-stage="2"]').first().click();
await p.locator('[data-extent="7"]').first().click();await p.locator('[data-inversion-key="chord"] select').selectOption('3');await p.locator('[data-working-chord-degree]').first().click();const expected=await p.evaluate(()=>ctThreesChordMidis(h.get().selectedChord.pcs));await p.locator('[data-generate-chord-pool]').click();
await p.evaluate(()=>{w.stop();window.__played=[];const orig=w.midiChordNow;w.midiChordNow=function(midis,...args){window.__played.push(...midis);return orig.call(this,midis,...args)};ve(j.saved[j.saved.length-1])});await p.waitForFunction(()=>window.__played.length>0);assert.deepEqual(await p.evaluate(()=>window.__played),expected);check(true,'Generated chord retains its rising register when auditioned from Pool');
await p.locator('[data-suite-stage="3"]').first().click();check(await p.locator('.ct-grand-score,[data-score-below]').count()===0,'Lower notation screen and Score below button removed');
await p.locator('[data-rail-extensions]').selectOption('extent:13');
await p.locator('[data-inversion-key="compose-chord"] select').selectOption('0');
check(await p.evaluate(()=>{const c=Yt(h.get(),Z);return JSON.stringify(c.midis.map(m=>m+12))===JSON.stringify(w.comfortableMidis(c.midis))}),'Composition thirteenth starts one octave below the previous automatic register');
let bass=-Infinity;const count=await p.locator('[data-inversion-key="compose-chord"] option').count();
for(let inv=0;inv<count;inv++){
 await p.evaluate(()=>{w.stop();window.__played=[]});await p.locator('[data-inversion-key="compose-chord"] select').selectOption(String(inv));await p.waitForFunction(()=>window.__played.length>0);
 const notes=await p.evaluate(()=>window.__played);assert.ok(Math.min(...notes)>bass);bass=Math.min(...notes);assert.deepEqual(notes,await p.evaluate(()=>Yt(h.get(),Z).midis));
}
check(true,'Composition thirteenth inversions rise consistently and match the displayed pitches');
await p.locator('[data-suite-stage="2"]').first().click();await p.locator('[data-extent="13"]').first().click();await p.locator('[data-inversion-key="chord"] select').selectOption('0');
check(await p.evaluate(()=>{const midis=ctThreesChordMidis(h.get().selectedChord.pcs);return JSON.stringify(midis.map(m=>m+12))===JSON.stringify(w.comfortableMidis(midis))}),'Generate thirteenth starts one octave below the previous automatic register');
await p.locator('[data-suite-stage="1"]').first().click();
for(const extent of ['9','11','13']){await p.locator('[data-extent="'+extent+'"]').first().click();await p.locator('[data-inversion-key="chord"] select').selectOption('0');check(await p.evaluate(()=>{const scale=h.get().source,pcs=ee(scale,0,Ne(h.get().chordExtent)),ref=h.get().reference.root;return ctThreesChordMidis(pcs)[0]===w.middleMidi(ref,60)+k(pcs[0]-ref)-12}),'Explore '+extent+' starts one octave lower');}
await p.close();console.log(JSON.stringify({checks,errors}));
}finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exit(1)});
