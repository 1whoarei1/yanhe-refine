import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCatalogImport} from '../src/watch/catalog-import.js';
const old=()=>({format:'yanhekt-session-index/v1',source:{kind:'self-collected'},partial:true,courses:[{id:1,name:'课程 A',teachers:['教师'],term:'2020-2021-2',sessions:[7,11,7]},{id:2,name:'课程 B',teachers:[],term:null,sessions:[8]}]});
test('session imports preserve noncontiguous ownership, remove duplicate IDs, and exclude arbitrary payload fields',()=>{
 const source=old();source.courses[0].token='must-not-persist';const result=validateCatalogImport(source);assert.equal(result.sessions,3);assert.deepEqual(result.data.courses[0].sessions,['7','11']);assert.equal(result.data.courses[1].term,null);assert.equal(JSON.stringify(result).includes('must-not-persist'),false);
});
test('ambiguous owners, duplicate courses and misleading legacy tables are rejected before storage',()=>{
 let source=old();source.courses[1].sessions=[7];assert.throws(()=>validateCatalogImport(source));source=old();source.courses[1].id=1;assert.throws(()=>validateCatalogImport(source));assert.throws(()=>validateCatalogImport({schema:1,courses:[{platform:'legacy',id:1,title:'旧表'}]}));
});
test('modern imports retain public metadata and never persist media, credentials or learning state',()=>{
 const result=validateCatalogImport({schema:1,courses:[{platform:'modern',id:1,title:'课程 A',teacher:'教师',term:'2026-2027-1',token:'secret',progress:999,url:'https://example.invalid/video'}]});assert.equal(result.courses,1);assert.equal(result.kind,'modern');assert.ok(!/secret|progress|example/.test(JSON.stringify(result)));assert.throws(()=>validateCatalogImport({schema:1,courses:[{platform:'modern',id:1,title:'A'},{platform:'modern',id:1,title:'B'}]}));
});
