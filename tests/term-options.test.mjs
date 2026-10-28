import test from 'node:test';
import assert from 'node:assert/strict';
import {courseTermOptions,isModernTerm} from '../src/catalog-core.js';
test('modern semester choices keep the trial and real semesters without mixing in old-platform placeholders',()=>{
 const rows=[{platform:'modern',term:'2021-2022试用'},{platform:'modern',term:'2026-2027-1'},{platform:'modern',term:'2026-2027-1'},{platform:'modern',term:'2020-2021-2'},{platform:'modern',term:'2024-2025（未标注学期）'},{platform:'modern',term:''},{platform:'legacy',term:'2020-2021-2'},{platform:'legacy',term:'2023-2024（未标注学期）'}];
 assert.deepEqual(courseTermOptions(rows,'modern'),['2026-2027-1','2021-2022试用']);
 assert.deepEqual(courseTermOptions(rows,'legacy'),['2020-2021-2']);assert.equal(rows.length,8);
 for(const name of ['2021-2022 试用','2021-2022 第一学期','2025-2026-2','2022-2023 暑期'])assert.ok(isModernTerm(name),name);
 for(const name of ['2024-2025','2020-2021-1','2019-2020（未标注学期）','2024-2024-1','未标注学期','2026-2027（未标记学期）'])assert.equal(isModernTerm(name),false,name);
});

test('all-platform and learning selectors exclude both placeholder spellings and bare academic years without removing valid old terms',()=>{
 const rows=[{source:'lms',term:'2026-2027-1'},{source:'lexue',term:'2020-2021-2'},{platform:'modern',term:'2025-2026（未标注学期）'},{platform:'legacy',term:'2024-2025（未标记学期）'},{source:'lms',term:'2023-2024'},{platform:'modern',term:'2020-2021-1'}];
 assert.deepEqual(courseTermOptions(rows),['2026-2027-1','2020-2021-2']);assert.equal(rows.length,6);
});
