import express from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const db = new Database(path.join(__dirname, '../data/platform.db'));

db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS mods (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, version TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tutorials (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS contributors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked INTEGER NOT NULL DEFAULT 0);
`);

app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'development-only-secret', resave:false, saveUninitialized:false, cookie:{httpOnly:true,sameSite:'lax',secure:false,maxAge:86400000} }));

const admin = (req,res,next)=> req.session.authenticated ? next() : res.status(401).json({error:'Unauthorized'});
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

app.post('/api/v1/auth/login',(req,res)=>{
  const {username,password}=req.body||{};
  if(username === (process.env.ADMIN_USERNAME||'admin') && password === (process.env.ADMIN_PASSWORD||'change-me')) { req.session.authenticated=true; return res.json({ok:true}); }
  res.status(401).json({error:'Invalid credentials'});
});
app.post('/api/v1/auth/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/v1/auth/me',(req,res)=>res.json({authenticated:!!req.session.authenticated}));

const resources={
  mods:['name','version','url'], tutorials:['title','url'], links:['name','url'], contributors:['name','url']
};
for(const [table,fields] of Object.entries(resources)){
  app.get(`/api/v1/${table}`,(req,res)=>res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all()));
  app.post(`/api/v1/${table}`,admin,(req,res)=>{
    const values=fields.map(f=>String(req.body?.[f]??'').trim());
    if(!values[0]) return res.status(400).json({error:`${fields[0]} is required`});
    const cols=fields.join(','); const marks=fields.map(()=>'?').join(',');
    const result=db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${marks})`).run(...values);
    res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(result.lastInsertRowid));
  });
  app.delete(`/api/v1/${table}/:id`,admin,(req,res)=>{db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);res.json({ok:true});});
}

app.get('/api/v1/tokens',admin,(req,res)=>res.json(db.prepare('SELECT id,name,created_at,revoked FROM tokens ORDER BY id DESC').all()));
app.post('/api/v1/tokens',admin,(req,res)=>{
  const name=String(req.body?.name||'').trim(); if(!name)return res.status(400).json({error:'name is required'});
  const token=crypto.randomBytes(32).toString('hex'); db.prepare('INSERT INTO tokens(name,token_hash) VALUES(?,?)').run(name,hash(token));
  res.status(201).json({name,token});
});
app.post('/api/v1/tokens/:id/revoke',admin,(req,res)=>{db.prepare('UPDATE tokens SET revoked=1 WHERE id=?').run(req.params.id);res.json({ok:true});});

// Future API modules can be mounted here without changing the core app.
app.get('/api/v1/health',(req,res)=>res.json({ok:true,version:'v1'}));

app.use(express.static(path.join(__dirname,'../../web')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../../web/index.html')));
const port=Number(process.env.PORT||8787);
app.listen(port,()=>console.log(`Mod platform running on http://localhost:${port}`));
