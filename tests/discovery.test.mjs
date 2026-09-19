import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscoverySession, resolveTopicIds, parseDiscoveryQuery } from '../prototypes/emoji-card/discovery.js';
const source = [{kind:'movie',path:'/discover/movie',params:{with_genres:27}}];
const movie = id => ({id,kind:'movie'});

test('continues beyond an empty filtered page using total_pages', async()=>{
 const pages=[];
 const session=createDiscoverySession({sources:source,request:async(_,p)=>{pages.push(p.page);return {results:[movie(p.page)],total_pages:3,total_results:3}},accept:x=>x.id===3});
 assert.deepEqual((await session.next()).map(x=>x.id),[3]);assert.deepEqual(pages,[1,2,3]);assert.equal(session.hasMore,false);
});
test('leaves continuation available after bounded empty batches',async()=>{
 const session=createDiscoverySession({sources:source,request:async(_,p)=>({results:[movie(p.page)],total_pages:9,total_results:9}),accept:x=>x.id===9});
 assert.deepEqual(await session.next({maxRounds:2}),[]);assert.equal(session.hasMore,true);
 assert.deepEqual((await session.next({maxRounds:8})).map(x=>x.id),[9]);
});
test('deduplicates within a type but keeps matching TV and movie IDs',async()=>{
 const session=createDiscoverySession({sources:[...source,{kind:'tv',path:'/discover/tv'}],normalize:(x,kind)=>({...x,kind}),request:async()=>({results:[{id:7},{id:7}],total_pages:1,total_results:1})});
 assert.equal((await session.next()).length,2);assert.equal(session.loaded,2);
});
test('no implicit vote filter and no early stop for short pages',async()=>{
 const session=createDiscoverySession({sources:source,request:async(_,p)=>{assert.equal(p['vote_count.gte'],undefined);return {results:[movie(p.page)],total_pages:2,total_results:2}}});
 assert.equal((await session.next()).length,2);
});
test('rolls back a failed batch so retry cannot lose results',async()=>{
 let fail=true;
 const session=createDiscoverySession({sources:source,request:async(_,p)=>{if(p.page===2&&fail){fail=false;throw Error('network')};return {results:[movie(p.page)],total_pages:2,total_results:2}}});
 await assert.rejects(session.next(),/network/);assert.equal(session.loaded,0);assert.equal(session.hasMore,true);
 assert.deepEqual((await session.next()).map(x=>x.id),[1,2]);
});
test('aborted requests do not commit results',async()=>{
 const controller=new AbortController();const session=createDiscoverySession({signal:controller.signal,sources:source,request:async()=>{controller.abort();return {results:[movie(1)],total_pages:1}}});
 await assert.rejects(session.next(),{name:'AbortError'});assert.equal(session.loaded,0);
});
test('ghost topic resolves exact synonym IDs without accepting an unrelated first result',async()=>{
 const ids=await resolveTopicIds('ghost',async(_,p)=>({results:[{id:99,name:'ghost ship'},...(p.query==='ghost'?[{id:1,name:'ghost'}]:p.query==='haunted house'?[{id:2,name:'haunted house'}]:[])]}));
 assert.deepEqual(ids,[1,2]);
});
test('natural theme search handles accents and singular, preserves film titles',()=>{
 const genres=[{id:27,label:'Horreur'}];const topics=[['fantômes','','ghost']];
 assert.deepEqual(parseDiscoveryQuery('films horreur de fantome',genres,topics),{genres:[27],topic:'ghost',label:'Horreur · fantômes'});
 assert.equal(parseDiscoveryQuery('Ghost',genres,topics),null);
 assert.equal(parseDiscoveryQuery('Horreur à Amityville',genres,topics),null);
});
