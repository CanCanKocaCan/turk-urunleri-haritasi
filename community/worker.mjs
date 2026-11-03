// Cloudflare Worker: anonymous reports become GitHub issues for owner review.
export default {
  async fetch(request, env) {
    const headers = {'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN, 'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
    const reply=(status,text)=>new Response(text,{status,headers});
    if(request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return reply(403,'Origin rejected');
    if(request.method === 'OPTIONS') return reply(204,null);
    if(request.method !== 'POST') return reply(405,'POST required');
    // Edge rate limit binding is mandatory; fail closed if deployment is incomplete.
    if(!env.REPORT_LIMITER || !env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) return reply(503,'Not configured');
    const key=request.headers.get('CF-Connecting-IP');
    if(!key) return reply(400,'Missing client');
    if(!(await env.REPORT_LIMITER.limit({key})).success) return reply(429,'Try later');
    if(Number(request.headers.get('Content-Length'))>8192) return reply(413,'Too large');
    let data;
    try {
      const reader=request.body?.getReader(); if(!reader) return reply(400,'Missing body');
      let size=0; const chunks=[];
      while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>8192){await reader.cancel();return reply(413,'Too large');} chunks.push(value); }
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      data=JSON.parse(new TextDecoder().decode(bytes));
    } catch {return reply(400,'Invalid JSON');}
    if(!data || typeof data !== 'object' || data.company) return reply(400,'Invalid report');
    if(!['new','seen','missing','closed','correction'].includes(data.kind)) return reply(400,'Invalid kind');
    for(const [field,max] of Object.entries({place:160,location:160,details:2000,observedAt:10})) if(typeof data[field] !== 'string' || !data[field].trim() || data[field].length>max) return reply(400,'Invalid fields');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.observedAt) || !Number.isFinite(Date.parse(data.observedAt)) || data.observedAt>new Date().toISOString().slice(0,10)) return reply(400,'Invalid date');
    if(data.source && (typeof data.source!=='string' || data.source.length>500 || !/^https?:\/\/\S+$/.test(data.source))) return reply(400,'Invalid source');
    // Escape Markdown and mentions; submissions never modify published data.
    const clean=s=>String(s||'').replace(/@/g,'＠').replace(/[\\`*_{}\[\]<>#]/g,'\\$&');
    const body=`Anonymous community report — review before publishing.\n\n${Object.entries(data).filter(([k])=>k!=='company').map(([k,v])=>`${clean(k)}: ${clean(v)}`).join('\n\n')}`;
    try {
      const response=await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues`,{method:'POST',headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,'User-Agent':'turk-urunleri-community','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({title:`[Topluluk/${data.kind}] ${data.place.replace(/@/g,'＠').replace(/[\r\n]/g,' ')}`,body})});
      return response.ok ? reply(201,'Queued for review') : reply(502,'Queue unavailable');
    } catch {return reply(502,'Queue unavailable');}
  }
};
