const enc=new TextEncoder();
const hex=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join("")};
async function sha(s){const d=await crypto.subtle.digest("SHA-256",enc.encode(s));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}
const json=(x,s=200,h={})=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json",...h}});
const cookie=(v,age)=>`cs_session=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
function getCookie(r){const m=(r.headers.get("Cookie")||"").match(/(?:^|;\s*)cs_session=([^;]+)/);return m?.[1]||null}
async function admin(r,e){const s=getCookie(r);if(!s)return false;const h=await sha(s);return !!await e.DB.prepare("SELECT id FROM sessions WHERE token_hash=? AND expires_at>?").bind(h,Date.now()).first()}
async function body(r){try{return await r.json()}catch{return {}}}
const resources={mods:["name","version","url"],tutorials:["title","url"],links:["name","url"],contributors:["name","url"]};

export default {async fetch(request,env){
 const u=new URL(request.url),p=u.pathname,m=request.method;
 if(!p.startsWith("/api/")) return env.ASSETS.fetch(request);
 if(p==="/api/v1/health") return json({ok:true,version:"v1"});
 if(p==="/api/v1/auth/login"&&m==="POST"){
   const b=await body(request);
   if(String(b.username||"")!==String(env.ADMIN_USERNAME||"")||String(b.password||"")!==String(env.ADMIN_PASSWORD||"")) return json({error:"Invalid credentials"},401);
   const s=hex(32),h=await sha(s),exp=Date.now()+86400000;
   await env.DB.prepare("INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)").bind(h,exp).run();
   return json({ok:true},200,{"Set-Cookie":cookie(s,86400)});
 }
 if(p==="/api/v1/auth/logout"&&m==="POST"){
   const s=getCookie(request);if(s)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha(s)).run();
   return json({ok:true},200,{"Set-Cookie":"cs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"});
 }
 if(p==="/api/v1/auth/me") return json({authenticated:await admin(request,env)});
 for(const [table,fields] of Object.entries(resources)){
   if(p===`/api/v1/${table}`&&m==="GET") return json((await env.DB.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all()).results);
   if(p===`/api/v1/${table}`&&m==="POST"){
     if(!await admin(request,env))return json({error:"Unauthorized"},401);
     const b=await body(request),v=fields.map(f=>String(b?.[f]??"").trim());if(!v[0])return json({error:`${fields[0]} is required`},400);
     const r=await env.DB.prepare(`INSERT INTO ${table} (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")})`).bind(...v).run();
     return json(await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(r.meta.last_row_id).first(),201);
   }
   const dm=p.match(new RegExp(`^/api/v1/${table}/(\\d+)$`));
   if(dm&&m==="DELETE"){if(!await admin(request,env))return json({error:"Unauthorized"},401);await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(dm[1]).run();return json({ok:true})}
 }
 if(p==="/api/v1/tokens"&&m==="GET"){if(!await admin(request,env))return json({error:"Unauthorized"},401);return json((await env.DB.prepare("SELECT id,name,created_at,revoked FROM tokens ORDER BY id DESC").all()).results)}
 if(p==="/api/v1/tokens"&&m==="POST"){if(!await admin(request,env))return json({error:"Unauthorized"},401);const b=await body(request),name=String(b?.name||"").trim();if(!name)return json({error:"name is required"},400);const t=hex(32);await env.DB.prepare("INSERT INTO tokens(name,token_hash) VALUES(?,?)").bind(name,await sha(t)).run();return json({name,token:t},201)}
 const rm=p.match(/^\/api\/v1\/tokens\/(\d+)\/revoke$/);
 if(rm&&m==="POST"){if(!await admin(request,env))return json({error:"Unauthorized"},401);await env.DB.prepare("UPDATE tokens SET revoked=1 WHERE id=?").bind(rm[1]).run();return json({ok:true})}
 return json({error:"Not found"},404);
}};
