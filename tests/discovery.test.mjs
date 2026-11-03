import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

function bounds(s=-35.1,w=138.4,n=-34.8,e=138.8) {
 return {getSouth:()=>s,getWest:()=>w,getNorth:()=>n,getEast:()=>e};
}
async function setup(url='https://example.com/') {
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url,runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLElement.prototype.setPointerCapture=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const events={},markers=[];
 const map={setView(){return this;},fitBounds(){},panTo(){},distance(){return 1000;},getBounds:()=>bounds(),on(name,fn){events[name]=fn;return this;}};
 const cluster={addTo(){return this;},clearLayers(){},addLayers(){},zoomToShowLayer(m,fn){fn();},getVisibleParent:m=>m};
 w.L={map:()=>map,tileLayer:()=>({addTo(){}}),markerClusterGroup:()=>cluster,divIcon:()=>({}),latLngBounds:([[s,w],[n,e]])=>bounds(s,w,n,e),marker:(coords)=>{
  const element=d.createElement('div');element.className='type-marker';d.getElementById('map').appendChild(element);
  const handlers={},marker={coords,handlers,element,on(name,fn){handlers[name]=fn;return this;},getElement:()=>element,setZIndexOffset(){}};markers.push(marker);return marker;
 }};
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(url,'utf8'))});
 vm.runInContext(fs.readFileSync('app.js','utf8'),dom.getInternalVMContext());
 await new Promise(r=>setTimeout(r,30));
 const input=q=>{const el=d.getElementById('search');el.value=q;el.dispatchEvent(new w.Event('input'));return el;};
 return {dom,w,d,map,events,markers,input,run:code=>vm.runInContext(code,dom.getInternalVMContext())};
}
test('suggestions support Turkish text, keyboard selection, city scope and dismiss',async t=>{
 const {dom,w,d,input}=await setup();t.after(()=>dom.window.close());
 const search=input('bey');
 assert.match(d.getElementById('suggestions').textContent,/Ürünler.*Beypazarı/s);
 search.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',cancelable:true}));
 assert.equal(search.getAttribute('aria-activedescendant'),'suggestion-0');
 search.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',cancelable:true}));
 assert.equal(search.value,'Beypazarı maden suyu');assert.equal(d.querySelectorAll('.result-card').length,1);
 assert.ok(d.getElementById('suggestions').hidden);assert.ok(w.location.search.includes('mode=product'));
 d.getElementById('reset').click();input('adel');
 d.querySelector('#suggestions [role=option]').click();
 assert.equal(d.getElementById('country').value,'Avustralya');assert.equal(d.getElementById('city').value,'Adelaide');
 assert.equal(d.querySelectorAll('.result-card').length,4);
 d.getElementById('reset').click();input('Istanbul');assert.equal(d.getElementById('suggestions').hidden,false);
 search.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(search.getAttribute('aria-expanded'),'false');
 input('<img src=x onerror=alert(1)>');assert.equal(d.querySelector('#suggestions img'),null);
});
test('filter chips are removable while drawer is closed and reset clears them',async t=>{
 const {dom,d}=await setup('https://example.com/?country=Avustralya&city=Adelaide&type=market&mode=product');t.after(()=>dom.window.close());
 d.getElementById('panel-toggle').click();assert.equal(d.getElementById('sidebar').inert,true);
 assert.equal(d.querySelectorAll('#active-filters button').length,4);
 d.querySelector('[aria-label="Market filtresini kaldır"]').click();
 assert.equal(d.querySelector('[aria-label="Market filtresini kaldır"]'),null);
 assert.equal(d.getElementById('sidebar').inert,true);
 d.querySelector('[aria-label="Ürün bul filtresini kaldır"]').click();assert.equal(d.querySelectorAll('.result-card').length,4);
 d.getElementById('reset').click();assert.equal(d.querySelectorAll('#active-filters button').length,0);
});
test('area search snapshots bounds, persists in URL and can be removed or restored',async t=>{
 const {dom,w,d,events}=await setup();t.after(()=>dom.window.close());
 const total=d.querySelectorAll('.result-card').length;
 events.moveend();assert.equal(d.getElementById('search-area').hidden,false);
 d.getElementById('search-area').click();assert.equal(d.querySelectorAll('.result-card').length,4);
 assert.equal(d.getElementById('search-area').hidden,true);assert.ok(w.location.search.includes('bounds='));
 const url=w.location.href;
 events.moveend();assert.equal(d.querySelectorAll('.result-card').length,4);
 d.querySelector('[aria-label="Haritadaki bölge filtresini kaldır"]').click();assert.equal(d.querySelectorAll('.result-card').length,total);
 const restored=await setup(url);t.after(()=>restored.dom.window.close());assert.equal(restored.d.querySelectorAll('.result-card').length,4);
 const invalid=await setup('https://example.com/?bounds=broken');t.after(()=>invalid.dom.window.close());assert.equal(invalid.d.querySelectorAll('.result-card').length,total);
});
test('area handles antimeridian and excludes unlocated records',async t=>{
 const {dom,run}=await setup();t.after(()=>dom.window.close());
 assert.equal(run("areaBounds=parseAreaBounds('-50,170,0,200');inArea({lat:-40,lng:-175})"),true);
 assert.equal(run("inArea({lat:-40,lng:150})"),false);
 assert.equal(run("inArea({lat:null,lng:null})"),false);
});
test('marker and card focus highlight each other; marker click opens detail',async t=>{
 const {dom,w,d,markers}=await setup();t.after(()=>dom.window.close());
 const card=d.querySelector('.result-card'),marker=markers[0];
 card.dispatchEvent(new w.Event('mouseenter'));assert.ok(marker.element.classList.contains('is-highlighted'));
 card.dispatchEvent(new w.Event('mouseleave'));assert.equal(marker.element.classList.contains('is-highlighted'),false);
 marker.handlers.mouseover();assert.ok(card.classList.contains('is-highlighted'));
 marker.handlers.click();assert.equal(d.getElementById('place-detail').hidden,false);
 assert.match(d.getElementById('place-detail').textContent,/Antepli/);
 d.getElementById('back-results').click();assert.equal(d.getElementById('market-list').hidden,false);assert.equal(w.location.search.includes('place='),false);
});
test('observation dates never fabricate freshness and report form carries product/place',async t=>{
 const {dom,d,input,run}=await setup();t.after(()=>dom.window.close());
 assert.match(run("freshnessHtml('2020-01-01')"),/90 günden eski/);
 assert.match(run("freshnessHtml('2099-01-01')"),/bilinmiyor/);
 assert.match(run("freshnessHtml('2026-02-31')"),/bilinmiyor/);
 assert.match(run("freshnessHtml(new Date().toISOString().slice(0,10))"),/recent/);
 input('beypazari');d.querySelector('.result-card').click();
 assert.match(d.getElementById('place-detail').textContent,/Görülme tarihi bilinmiyor/);
 d.querySelector('.seen-product').click();const form=d.getElementById('contribution-form');
 assert.equal(d.getElementById('contribution').open,true);assert.equal(form.elements.kind.value,'seen');
 assert.equal(form.elements.place.value,'Saray Market & Butchery');assert.equal(form.elements.details.value,'Beypazarı maden suyu');
 assert.ok(form.elements.observedAt.value);assert.match(d.getElementById('form-status').textContent,/dosya/);
});
test('mobile sheet has keyboard resizing and pointer drag snapping',async t=>{
 const {dom,w,d}=await setup();t.after(()=>dom.window.close());const handle=d.getElementById('sheet-handle');
 handle.click();assert.ok(d.body.classList.contains('sheet-expanded'));
 handle.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',cancelable:true}));assert.equal(handle.getAttribute('aria-expanded'),'false');
 const event=(type,y)=>{const e=new w.Event(type);Object.assign(e,{clientY:y,pointerId:1,pointerType:'touch'});handle.dispatchEvent(e);};
 event('pointerdown',500);event('pointermove',300);assert.match(d.getElementById('sidebar').style.getPropertyValue('--sheet-height'),/200px/);
 event('pointercancel',300);assert.equal(d.getElementById('sidebar').style.getPropertyValue('--sheet-height'),'');
 event('pointerdown',500);event('pointermove',-100);event('pointerup',-100);assert.equal(handle.getAttribute('aria-expanded'),'true');
});
test('close button and outside press dismiss panels without resetting search or filters',async t=>{
 const {dom,w,d,input}=await setup('https://example.com/?country=Avustralya&city=Adelaide');t.after(()=>dom.window.close());
 d.getElementById('filter-toggle').click();assert.equal(d.getElementById('advanced-filters').open,true);
 d.getElementById('close-panel').click();assert.equal(d.getElementById('sidebar').inert,true);
 assert.equal(d.getElementById('advanced-filters').open,false);assert.equal(d.getElementById('filter-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(d.getElementById('city').value,'Adelaide');assert.equal(d.querySelectorAll('.result-card').length,4);
 d.getElementById('panel-toggle').click();
 d.querySelector('.drawer-content').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));assert.equal(d.getElementById('sidebar').inert,false);
 d.getElementById('map').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));assert.equal(d.getElementById('sidebar').inert,true);
 input('bey');d.getElementById('close-suggestions').click();assert.equal(d.getElementById('suggestion-popup').hidden,true);assert.equal(d.getElementById('search').value,'bey');
 input('bey');d.getElementById('map').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));assert.equal(d.getElementById('suggestion-popup').hidden,true);
 d.getElementById('filter-toggle').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));d.getElementById('filter-toggle').click();
 assert.equal(d.getElementById('sidebar').inert,false);assert.equal(d.getElementById('advanced-filters').open,true);
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.getElementById('sidebar').inert,true);
});
test('suggestion Escape closes only popup; marker can reopen dismissed detail',async t=>{
 const {dom,w,d,input,markers}=await setup();t.after(()=>dom.window.close());
 const inputEl=input('bey');
 inputEl.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal(d.getElementById('suggestions').hidden,true);assert.equal(d.getElementById('panel-toggle').getAttribute('aria-expanded'),'true');
 d.getElementById('close-panel').click();markers[0].handlers.click();
 assert.equal(d.getElementById('sidebar').inert,false);assert.equal(d.getElementById('place-detail').hidden,false);
});
test('contribution closes by top X or backdrop; inside interaction preserves form',async t=>{
 const {dom,w,d}=await setup();t.after(()=>dom.window.close());
 const dialog=d.getElementById('contribution');dialog.getBoundingClientRect=()=>({left:100,right:500,top:100,bottom:600});
 d.getElementById('contribute').click();d.querySelector('[name=place]').value='Taslak';
 d.querySelector('[name=place]').dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:150,clientY:200}));
 d.querySelector('[name=place]').click();assert.equal(dialog.open,true);
 dialog.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:20,clientY:20}));
 dialog.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:20,clientY:20}));assert.equal(dialog.open,false);
 assert.equal(d.querySelector('[name=place]').value,'Taslak');
 d.getElementById('contribute').click();d.getElementById('close-contribution').click();assert.equal(dialog.open,false);
});
test('US state filter narrows cities, combines with search and restores shared state',async t=>{
 const {dom,w,d,input}=await setup('https://example.com/?country=ABD&state=NJ');t.after(()=>dom.window.close());
 const state=d.getElementById('state'),city=d.getElementById('city');
 assert.equal(state.disabled,false);assert.equal(state.value,'NJ');assert.equal(d.querySelectorAll('.result-card').length,10);
 assert.ok([...city.options].some(o=>o.value==='Paterson'));assert.ok(![...city.options].some(o=>o.value==='New York'));
 input('sultan');assert.equal(d.querySelectorAll('.result-card').length,1);assert.match(w.location.search,/state=NJ/);
 const restored=await setup(w.location.href);t.after(()=>restored.dom.window.close());assert.equal(restored.d.querySelectorAll('.result-card').length,1);
 d.getElementById('reset').click();
 const country=d.getElementById('country');country.value='ABD';country.dispatchEvent(new w.Event('change'));
 state.value='NY';state.dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelectorAll('.result-card').length,6);assert.deepEqual([...city.options].map(o=>o.value),['','New York']);
 d.getElementById('panel-toggle').click();d.querySelector('[aria-label="New York (NY) filtresini kaldır"]').click();assert.equal(state.value,'');assert.equal(d.querySelectorAll('.result-card').length,20);
});
test('Australian states and ACT use country-specific options and reset incompatible cities',async t=>{
 const {dom,w,d}=await setup('https://example.com/?country=Avustralya&state=SA&city=Adelaide');t.after(()=>dom.window.close());
 const state=d.getElementById('state'),country=d.getElementById('country'),city=d.getElementById('city');
 assert.equal(state.value,'SA');assert.equal(city.value,'Adelaide');assert.equal(d.querySelectorAll('.result-card').length,4);
 state.value='ACT';state.dispatchEvent(new w.Event('change'));assert.equal(city.value,'');assert.equal(d.querySelectorAll('.result-card').length,3);
 assert.ok(![...state.options].some(o=>o.value==='NJ'));
 country.value='ABD';country.dispatchEvent(new w.Event('change'));assert.equal(state.value,'');assert.equal(city.value,'');
 assert.ok([...state.options].some(o=>o.value==='NJ'));assert.ok(![...state.options].some(o=>o.value==='SA'));
 country.value='Japonya';country.dispatchEvent(new w.Event('change'));assert.equal(state.disabled,true);assert.equal(d.getElementById('state-filter').hidden,true);assert.equal(state.value,'');
});
test('state suggestions, legacy NJ links and stable place IDs survive city migration',async t=>{
 const {dom,d,input}=await setup();t.after(()=>dom.window.close());
 input('New Jersey');const options=d.querySelectorAll('#suggestions [role=option]');assert.equal(options.length,1);options[0].click();
 assert.equal(d.getElementById('country').value,'ABD');assert.equal(d.getElementById('state').value,'NJ');assert.equal(d.getElementById('search').value,'');assert.equal(d.querySelectorAll('.result-card').length,10);
 const legacy=await setup('https://example.com/?country=ABD&city=New%20Jersey&place=abd-new-jersey-2');t.after(()=>legacy.dom.window.close());
 assert.equal(legacy.d.getElementById('state').value,'NJ');assert.match(legacy.d.getElementById('place-detail').textContent,/Taskin Bakery/);assert.match(legacy.d.getElementById('place-detail').textContent,/Paterson, New Jersey, ABD/);
 const invalid=await setup('https://example.com/?country=Avustralya&state=NJ');t.after(()=>invalid.dom.window.close());assert.equal(invalid.d.getElementById('state').value,'');
});
