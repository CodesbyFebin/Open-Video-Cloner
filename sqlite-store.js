'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
function openStore(dir){
 fs.mkdirSync(dir,{recursive:true});
 const db=new DatabaseSync(path.join(dir,'state.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
 db.exec("CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL CHECK(kind IN ('projects','uploads','jobs')), id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(kind,id)) STRICT");
 db.exec('CREATE INDEX IF NOT EXISTS record_kind ON records(kind)');
 const select=db.prepare('SELECT json FROM records WHERE kind=? ORDER BY rowid');
 const insert=db.prepare('INSERT INTO records(kind,id,json) VALUES(?,?,?)');
 const replace=db.prepare('DELETE FROM records WHERE kind=?');
 const load=kind=>select.all(kind).map(x=>JSON.parse(x.json));
 function saveAll(data){
   db.exec('BEGIN IMMEDIATE');
   try{
     for(const [kind,items] of Object.entries(data)){
       if(!['projects','uploads','jobs'].includes(kind))throw Error('Invalid record kind');
       replace.run(kind);
       for(const item of items)insert.run(kind,item.id,JSON.stringify(item));
     }
     db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e}
 }
 const transition=(id,allowed,patch)=>{
   db.exec('BEGIN IMMEDIATE');
   try{
     const statement=db.prepare("SELECT json FROM records WHERE kind='jobs' AND id=?");
     const row=statement.get(id);if(!row){db.exec('ROLLBACK');return null}
     const j=JSON.parse(row.json);
     if(!allowed.includes(j.status)){db.exec('ROLLBACK');return null}
     const updated={...j,...patch};
     db.prepare("UPDATE records SET json=? WHERE kind='jobs' AND id=?").run(JSON.stringify(updated),id);
     db.exec('COMMIT');return updated;
   }catch(e){db.exec('ROLLBACK');throw e}
 };
 return {db,load,saveAll,transition,close:()=>db.close()};
}
module.exports={openStore};
