import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../community/worker.mjs';
const points=[];
const env={ALLOWED_ORIGIN:'https://cancankocacan.github.io',GITHUB_TOKEN:'test',GITHUB_REPOSITORY:'test/test',REPORT_LIMITER:{limit:async()=>({success:true})},SEARCH_LIMITER:{limit:async()=>({success:true})},SEARCHES:{writeDataPoint:p=>points.push(p)}};
const report={kind:'seen',place:'Market',location:'Adelaide',details:'Beypazarı',observedAt:'2026-01-01'};
const request=(data,origin=env.ALLOWED_ORIGIN,path='/')=>new Request(`https://example.com${path}`,{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(data)});
test('rejects untrusted origin, bad input, oversized body and missing configuration',async()=>{
 assert.equal((await worker.fetch(request(report,'https://other.example'),env)).status,403);
 assert.equal((await worker.fetch(request({...report,kind:'invalid'}),env)).status,400);
 assert.equal((await worker.fetch(request({...report,details:'x'.repeat(9000)}),env)).status,413);
 assert.equal((await worker.fetch(request(report),{...env,REPORT_LIMITER:null})).status,503);
 assert.equal((await worker.fetch(request(report),{...env,REPORT_LIMITER:{limit:async()=>({success:false})}})).status,429);
});
test('queues moderated report without IP, escapes mentions, surfaces upstream failure',async()=>{
 const original=globalThis.fetch;let queued;
 try {globalThis.fetch=async(url,options)=>{queued=JSON.parse(options.body);return new Response('{}',{status:201});};
 assert.equal((await worker.fetch(request({...report,details:'@owner <script>'}),env)).status,201);
 assert.ok(!queued.body.includes('192.0.2.1'));assert.ok(!queued.body.includes('@owner'));
 assert.equal((await worker.fetch(request({...report,kind:'remove'}),env)).status,201);assert.match(queued.title,/^\[Topluluk\/remove\]/);
 globalThis.fetch=async()=>new Response('',{status:500});assert.equal((await worker.fetch(request(report),env)).status,502);
 } finally {globalThis.fetch=original;}
});
test('counts anonymous searches without identifiers and rejects bad input',async()=>{
 const search=(data,e=env)=>worker.fetch(request(data,env.ALLOWED_ORIGIN,'/search'),e);
 assert.equal((await search({q:'  BEYPAZARI ',country:'Avustralya',state:'',city:'Perth',mode:'product',results:0})).status,204);
 assert.deepEqual(points.at(-1),{blobs:['beypazarı','Avustralya','','Perth','product'],doubles:[0],indexes:['none']});
 assert.ok(!JSON.stringify(points).includes('192.0.2.1'));
 assert.equal((await search({q:'x',results:1})).status,400);
 assert.equal((await search({q:'simit',results:-1})).status,400);
 assert.equal((await search({q:'simit',results:1,pad:'x'.repeat(2000)})).status,413);
 assert.equal((await worker.fetch(request({q:'simit',results:1},'https://other.example','/search'),env)).status,403);
 assert.equal((await search({q:'simit',results:1},{...env,SEARCHES:null})).status,503);
 assert.equal((await search({q:'simit',results:1},{...env,SEARCH_LIMITER:{limit:async()=>({success:false})}})).status,429);
});
