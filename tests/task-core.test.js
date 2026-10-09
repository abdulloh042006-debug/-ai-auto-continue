import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTask,getStepMeta,lastState,due,buildMessages,buildComment} from '../task-core.mjs';
const data = {version:1,prompt:'Loyihani bitir',start_at:'2026-10-10T05:00:00.000Z',max_steps:3};
const enc = Buffer.from(JSON.stringify(data)).toString('base64url');
const body = '<!-- AACS_TASK_V1:'+enc+' -->\nMy task';
test('decode original Issue task',()=>assert.equal(decodeTask(body).prompt,'Loyihani bitir'));
test('reject malformed tasks',()=>{
  assert.equal(decodeTask('no'),null);
  assert.equal(decodeTask('<!-- AACS_TASK_V1:bad -->'),null);
});
test('task time and max steps',()=>{
  const task=decodeTask(body);
  assert.equal(due(task,{step:0,status:'pending'},Date.parse(task.start_at)-1000),false);
  assert.equal(due(task,{step:0,status:'pending'},Date.parse(task.start_at)+1000),true);
  assert.equal(due(task,{step:3,status:'ok'},Date.parse(task.start_at)+1000),false);
  assert.equal(due(task,{step:1,status:'failed'},Date.parse(task.start_at)+1000),false);
});
test('Continue follows previous response regardless content',()=>{
  const task=decodeTask(body);
  const comments=[{user:{type:'Bot'},body:buildComment(1,'ok','I cannot do this',new Date().toISOString())}];
  assert.equal(lastState(comments).step,1);
  const messages=buildMessages(task,comments);
  assert.equal(messages.at(-1).content,'Continue');
  assert.equal(messages.at(-2).content,'I cannot do this');
});
test('pause on rate limit',()=>{
  const comment=buildComment(2,'backoff','Rate limit',new Date(Date.now()+300000).toISOString());
  const meta=getStepMeta(comment);
  assert.equal(due(decodeTask(body),meta,Date.now()),false);
});
