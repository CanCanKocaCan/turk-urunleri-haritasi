// Run with NODE_PATH=/tmp/map-qa/node_modules node --test tests/app.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
test('combined filters, Turkish search, share restoration and empty state', async()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.com/',runScripts:'outside-only'});const w=dom.window;
 w.HTMLElement.prototype.scrollIntoView=function() {};
 const map={setView(){return this;},fitBounds(){},distance(){return 1000;}};
 const cluster={addTo(){return this;},clearLayers(){},addLayers(){},zoomToShowLayer(m,fn){fn();}};
 w.L={map:()=>map,tileLayer:()=>({addTo(){}}),markerClusterGroup:()=>cluster,divIcon:()=>({}),marker:()=>({bindPopup(){return this;},openPopup(){}})};
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(url,'utf8'))});
 vm.runInContext(fs.readFileSync('app.js','utf8'),dom.getInternalVMContext());
 await new Promise(r=>setTimeout(r,30));
 const d=w.document, search=d.getElementById('search');
 assert.match(d.getElementById('result-count').textContent,/64 yer/);
 search.value='beypazari';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#market-list li').length,1);
 d.querySelector('#market-list button').click();assert.ok(w.location.search.includes('place='));
 d.getElementById('reset').click();const country=d.getElementById('country');country.value='Avustralya';country.dispatchEvent(new w.Event('change'));const city=d.getElementById('city');city.value='Adelaide';city.dispatchEvent(new w.Event('change'));assert.match(d.getElementById('result-count').textContent,/4 yer/);
 d.querySelector('[data-mode=product]').click();assert.match(d.getElementById('result-count').textContent,/1 yer/);
 search.value='zzzz';search.dispatchEvent(new w.Event('input'));assert.match(d.getElementById('market-list').textContent,/Sonuç bulunamadı/);
 dom.window.close();
});
