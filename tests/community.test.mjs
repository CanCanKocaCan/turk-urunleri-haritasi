import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../community/worker.mjs';
const env={ALLOWED_ORIGIN:'https://cancankocacan.github.io',GITHUB_TOKEN:'test',GITHUB_REPOSITORY:'test/test',REPORT_LIMITER:{limit:async()=>({success:true})}};
const report={kind:'seen',place:'Market',location:'Adelaide',details:'Beypazarı',observedAt:'2026-01-01'};
const request=(data,origin=env.ALLOWED_ORIGIN)=>new Request('https://example.com',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(data)});
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
 globalThis.fetch=async()=>new Response('',{status:500});assert.equal((await worker.fetch(request(report),env)).status,502);
 } finally {globalThis.fetch=original;}
});
