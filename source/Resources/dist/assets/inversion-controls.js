/* Shared, deterministic inversion operations. Pitch content and tuning are preserved. */
window.ctInversions=Object.freeze({
 index(value,count){return Number.isInteger(value)&&count>0?Math.max(0,Math.min(value,count-1)):0},
 rotate(values,amount){const n=this.index(amount,values.length);return values.slice(n).concat(values.slice(0,n))},
 lift(values,amount,period){
  const result=[...values].sort((a,b)=>a-b),n=this.index(amount,result.length);
  if(!Number.isFinite(period)||period<=0)return result;
  for(let i=0;i<n;i++){let lowest=result.shift();while(result.length&&lowest<=result[result.length-1])lowest+=period;result.push(lowest)}
  return result;
 },
 shift(tone,cents){
  if(Math.abs(cents-tone.cents)<1e-8)return {...tone};
  const factor=Math.pow(2,(cents-tone.cents)/1200),integer=Math.round(factor);
  const exact=tone.num&&tone.den&&Math.abs(factor-integer)<1e-8&&Number.isSafeInteger(tone.num*integer);
  return {...tone,cents,ratio:Math.pow(2,cents/1200),num:exact?tone.num*integer:undefined,den:exact?tone.den:undefined,raw:exact?(tone.num*integer)+'/'+tone.den:cents.toFixed(5)};
 },
 tones(tones,amount,equave){
  const n=this.index(amount,tones.length);if(!n)return tones.map(t=>({...t}));
  const ordered=[...tones].sort((a,b)=>a.cents-b.cents),rotated=this.rotate(ordered,n);
  let previous=-Infinity;
  return rotated.map(tone=>{let cents=tone.cents;while(cents<=previous)cents+=equave;previous=cents;return this.shift(tone,cents)});
 },
 readout(host,tones,unit){
  if(!host)return;
  let box=host.querySelector(':scope > .ct-chord-readout');
  if(!box){box=document.createElement('div');box.className='ct-chord-readout';box.setAttribute('aria-live','polite');host.append(box)}
  box.replaceChildren();
  box.dataset.pitches=JSON.stringify(tones.map(t=>t.pitch));
  const gaps=tones.slice(1).map((t,i)=>t.pitch-tones[i].pitch);
  box.dataset.gaps=JSON.stringify(gaps);
  if(!tones.length){box.textContent='Select chord notes';return}
  const notes=document.createElement('span');notes.className='ct-chord-readout-notes';notes.textContent='LOW → HIGH  '+tones.map(t=>t.label).join(' · ');
  const steps=document.createElement('span');steps.className='ct-chord-readout-steps';steps.textContent='STEPS  '+gaps.map(n=>unit==='cents'?n.toFixed(2):String(n)).join(' · ')+' '+unit;
  box.append(notes,steps);
 },
 mount(host,title,count,value,kind,change,key){
  if(!host||host.querySelector(':scope > [data-inversion-key="'+key+'"]'))return;
  const label=document.createElement('label');label.className='ct-inversion-picker';label.dataset.inversionKey=key;
  const text=document.createElement('span');text.textContent=title;label.append(text);
  const select=document.createElement('select');select.setAttribute('aria-label',title);select.disabled=count<2;
  for(let i=0;i<Math.max(1,count);i++){const option=document.createElement('option');option.value=String(i);option.textContent=i===0?(kind==='chord'?'Root position':'Original'):i+(i===1?'st':i===2?'nd':i===3?'rd':'th')+' inversion';select.append(option)}
  select.value=String(this.index(value,count));label.append(select);
  for(const event of ['click','pointerdown','keydown'])label.addEventListener(event,e=>e.stopPropagation());
  select.addEventListener('change',event=>{event.stopPropagation();change(Number(select.value));const replacement=document.querySelector('[data-inversion-key="'+key+'"] select');replacement?.focus({preventScroll:true})});
  host.append(label);
 }
});
