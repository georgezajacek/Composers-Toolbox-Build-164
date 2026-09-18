const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../Resources/dist');let checks=0;const errors=[];
function check(ok,label){assert.ok(ok,label);checks++;console.log('PASS',label)}
(async()=>{const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');let content=fs.readFileSync(f);if(f.endsWith('index-i8K__Uke.js'))content=content.toString()+'\nwindow.__qa={eval:code=>eval(code)}';res.end(content)}catch{res.statusCode=404;res.end()}}).listen(8878,'127.0.0.1');const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
try{
const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8878/threes/');await p.getByRole('button',{name:'SKIP',exact:true}).click();
check(await p.locator('.ct-chord-readout').count()===0,'Threes Explore has no chord inversion readout');
await p.evaluate(()=>{window.__played=[];for(const method of ['midiChordNow','pianoMidiNow']){const original=w[method];w[method]=function(m,...args){window.__played.push(...(Array.isArray(m)?m:[m]));return original.call(this,m,...args)}}});
for(const stage of ['1','2']){
 if(stage==='2')await p.locator('[data-suite-stage="2"]').first().click();
 for(const extent of ['3','7','9','11','13']){
  await p.locator('[data-extent="'+extent+'"]').first().click();
  const count=await p.locator('[data-inversion-key="chord"] option').count();let previousBass=-Infinity;
  for(let inv=0;inv<count;inv++){
   await p.evaluate(()=>{w.stop();window.__played=[]});
   await p.locator('[data-inversion-key="chord"] select').selectOption(String(inv));await p.waitForFunction(()=>window.__played.length>0);
   assert.deepEqual(await p.evaluate(()=>window.__played.map(m=>m%12)),await p.evaluate(inv=>ctInversions.rotate(h.get().selectedChord.pcs,inv),inv),'Picker itself auditions current chord size and inversion');
   const sel=stage==='1'?'[data-audition-chord]':'[data-working-chord-degree]';
   const btn=p.locator(sel).nth(1); // A non-tonic chord catches register and pitch-class errors.
   const expected=await p.evaluate(({stage,inv})=>{const pcs=ee(stage==='1'?h.get().source:h.get().working,1,Ne(h.get().chordExtent));return ctInversions.rotate(pcs,inv)}, {stage,inv});
   await p.evaluate(()=>{w.stop();window.__played=[]});await btn.click();await p.waitForFunction(()=>window.__played.length>0);
   const bass=await p.evaluate(()=>Math.min(...window.__played));assert.ok(bass>previousBass,'Successive inversions must rise, not drop an octave');previousBass=bass;const actual=await p.evaluate(()=>window.__played.map(m=>m%12));
   assert.deepEqual(actual,expected,'Threes stage '+stage+' extent '+extent+' inversion '+inv);
   const visible=await p.locator(sel).nth(1).evaluate((el,stage)=>stage==='1'?[...el.querySelectorAll('.chord-tone')].map(t=>Number(t.dataset.chordPc)):[...el.querySelectorAll('.chord-tone-stack>b')].map(t=>t.childNodes[t.childNodes.length-1].textContent.trim()),stage);
   if(stage==='1'){assert.deepEqual(visible,expected);const text=await p.locator(sel).nth(1).locator('.chord-tone').allTextContents();assert.deepEqual(text,await p.evaluate(pcs=>{const scale=_(h.get().reference);return pcs.map(pc=>scale.names[scale.pcs.indexOf(pc)])},expected),'Actual visible spelling after observers');}
   if(stage!=='1'){
    const readout=await p.locator('.ct-chord-readout').first().evaluate(el=>({notes:JSON.parse(el.dataset.pitches),gaps:JSON.parse(el.dataset.gaps),text:el.innerText}));
    assert.deepEqual(readout.notes,await p.evaluate(()=>window.__played),'Displayed register matches actual audio');
    assert.deepEqual(readout.gaps,readout.notes.slice(1).map((n,j)=>n-readout.notes[j]));
    assert.ok(readout.text.includes(readout.gaps.join(' · ')+' semitones'));
   }

  }
  check(true,'Threes '+(stage==='1'?'Explore':'Generate')+' '+extent+': every inversion sends the expected MIDI notes');
 }
}
// Arpeggio uses a separate route from block playback.
await p.locator('[data-extent="3"]').first().click();await p.locator('[data-inversion-key="chord"] select').selectOption('1');
await p.locator('[data-transform-chord-playback="arpeggio"]').first().click();await p.evaluate(()=>{w.stop();window.__played=[]});await p.locator('[data-working-chord-degree]').first().click();await p.waitForTimeout(1000);
check(await p.evaluate(()=>window.__played.length===3&&window.__played[0]%12===4),'Threes arpeggio uses inverted bass');
await p.locator('[data-suite-stage="3"]').first().click();check(await p.locator('[data-inversion-key*=scale]').count()===0,'Threes Compose scale picker absent');
let count=await p.locator('[data-inversion-key="compose-chord"] option').count();let lastComposeBass=-Infinity;
for(let inv=0;inv<count;inv++){
 await p.evaluate(()=>{w.stop();window.__played=[]});
 await p.locator('[data-inversion-key="compose-chord"] select').selectOption(String(inv));await p.waitForTimeout(count*300+200);
 check(await p.evaluate(inv=>{const c=Yt(h.get(),Z);return c.inversion===inv&&JSON.stringify(c.midis)===JSON.stringify(ctThreesInvertVoicing(c.inversionBase,c.inversionOrder,inv))},inv),'Threes Compose inversion '+inv+' updates chord');
 if(inv>0)check(await p.evaluate(()=>{const c=Yt(h.get(),Z);return c.midis[0]%12===c.inversionOrder[c.inversion]}),'Threes Compose inversion names the correct chord-tone bass');
 const stack=await p.locator('.ct-current-note-stack>b').evaluateAll(els=>els.map(el=>Number(el.dataset.chordMidi)).reverse());
 assert.deepEqual(stack,await p.evaluate(()=>ctThreesDisplayMidis(Yt(h.get(),Z))));assert.ok(stack[0]>lastComposeBass,'Composition bass must rise at each inversion');lastComposeBass=stack[0];assert.deepEqual(stack,await p.evaluate(()=>window.__played),'Compose note stack equals scheduled audio');
 const display=await p.locator('.ct-current-chord>.ct-chord-readout').evaluate(el=>({notes:JSON.parse(el.dataset.pitches),gaps:JSON.parse(el.dataset.gaps)}));assert.deepEqual(display.notes,stack);assert.deepEqual(display.gaps,stack.slice(1).map((n,j)=>n-stack[j]));

}
await p.close();
const i=await b.newPage({viewport:{width:1440,height:1000}});i.on('pageerror',e=>errors.push(e.message));await i.goto('http://127.0.0.1:8878/infinity/');await i.getByRole('button',{name:'SKIP',exact:true}).click();const ev=code=>i.evaluate(code=>window.__qa.eval(code),code);
await ev('window.__tones=[];window.__oldTone=v.tone;v.tone=function(hz,duration,delay,cents,...args){window.__tones.push(cents);return window.__oldTone.call(this,hz,duration,delay,cents,...args)}');
for(const stage of ['explore','generate']){
 if(stage==='generate')await i.locator('[data-suite-stage="generate"]').click();
 const count=await i.locator('[data-inversion-key="chord"] option').count();
 for(let inv=0;inv<count;inv++){
  await i.locator('[data-inversion-key="chord"] select').selectOption(String(inv));
  if(stage==='explore'){
   const row=i.locator('[data-degree-chord]').nth(1);const expected=(await row.getAttribute('data-degree-chord')).split(',').map(Number);
   await ev('v.stop();window.__tones=[]');await row.click();const actual=await ev('window.__tones');assert.deepEqual(actual,expected);
   const display=await i.locator('.ct-chord-readout').first().evaluate(el=>({notes:JSON.parse(el.dataset.pitches),gaps:JSON.parse(el.dataset.gaps),text:el.innerText}));
   display.notes.forEach((n,j)=>assert.ok(Math.abs(n-actual[j])<0.00001));
   assert.deepEqual(display.gaps,display.notes.slice(1).map((n,j)=>n-display.notes[j]));assert.ok(display.text.includes(display.gaps.map(n=>n.toFixed(2)).join(' · ')+' cents'));

  }else{
   await ev('v.stop();window.__tones=[];Ll()');const actual=await ev('window.__tones');const expected=await ev('ctInfinityPoolTones([...I].sort((a,b)=>a-b)).map(t=>t.cents)');assert.deepEqual(actual,expected);
   const display=await i.locator('.ct-chord-readout').first().evaluate(el=>({notes:JSON.parse(el.dataset.pitches),gaps:JSON.parse(el.dataset.gaps),text:el.innerText}));
   display.notes.forEach((n,j)=>assert.ok(Math.abs(n-actual[j])<0.00001));
   assert.deepEqual(display.gaps,display.notes.slice(1).map((n,j)=>n-display.notes[j]));assert.ok(display.text.includes(display.gaps.map(n=>n.toFixed(2)).join(' · ')+' cents'));

  }
 }
 check(true,'Infinity '+stage+': every inversion sends the displayed/selected cents to audio');
}
await i.locator('[data-suite-stage="compose"]').click();if(!await i.locator('[data-compose-harmony-drawer]').evaluate(e=>e.open))await i.locator('[data-compose-harmony-drawer]>summary').click();
count=await i.locator('[data-inversion-key="compose-chord"] option').count();
for(let inv=0;inv<count;inv++){
 await i.locator('[data-inversion-key="compose-chord"] select').selectOption(String(inv));await ev('v.stop();window.__tones=[]');await i.locator('[data-compose-builder-play="draft-chord"]').click();
 assert.deepEqual(await ev('window.__tones'),await ev('da().chordTones.map(t=>t.cents)'));
 const display=await i.locator('.ct-chord-readout').first().evaluate(el=>({notes:JSON.parse(el.dataset.pitches),gaps:JSON.parse(el.dataset.gaps)}));assert.deepEqual(display.notes,await ev('window.__tones'));assert.deepEqual(display.gaps,display.notes.slice(1).map((n,j)=>n-display.notes[j]));

}
check(true,'Infinity Compose: every inversion matches Build Harmony Play');

await ev('K=false;A="SCULPT";S();jc(1200,T*2,0)');
check(await i.locator('[data-center-ratio]').last().innerText()==='2/1','Infinity raised root ratio matches 1200 cents');
await ev('K=false;A="SCULPT";ctInfinityReadoutDegree=0;ne=3;rt=1;p={...p,equave:1200*Math.log2(3),tones:[Le(0),Le(500),Le(1000),Le(1200*Math.log2(3))]};U=$(p);S()');
await i.locator('[data-inversion-key="chord"] select').selectOption('1');
const nonOctave=await i.locator('.ct-chord-readout').first().evaluate(el=>({notes:JSON.parse(el.dataset.pitches),gaps:JSON.parse(el.dataset.gaps)}));
assert.ok(Math.abs(nonOctave.notes[2]-1200*Math.log2(3))<1e-8);assert.ok(Math.abs(nonOctave.gaps[1]-(1200*Math.log2(3)-1000))<1e-8);
check(true,'Infinity displayed inversion steps honor a non-octave equave');
await i.close();check(errors.length===0,'Matrix has no JavaScript runtime errors');console.log(JSON.stringify({checks,errors}));
}finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exit(1)});
