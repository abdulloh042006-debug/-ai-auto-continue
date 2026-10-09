import {decodeTask,lastState,due,buildMessages,buildComment} from './task-core.mjs';
const token=process.env.GITHUB_TOKEN;
const repo=process.env.GITHUB_REPOSITORY;
const api='https://api.github.com';
const chat='https://models.github.ai/inference/chat/completions';

async function gh(endpoint,options={}) {
  const response=await fetch(api+endpoint,{
    ...options,headers:{
      'Accept':'application/vnd.github+json',
      'Authorization':'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',...(options.headers||{})
    }
  });
  if(!response.ok) throw new Error('GitHub HTTP '+response.status+': '+(await response.text()).slice(0,500));
  return response.status===204?null:response.json();
}

async function allPages(endpoint,limit=5){
  const values=[];
  for(let page=1;page<=limit;page++){
    const sep=endpoint.includes('?')?'&':'?';
    const data=await gh(endpoint+sep+'per_page=100&page='+page);
    values.push(...data);
    if(data.length<100)break;
  }
  return values;
}

async function askModel(messages){
  const response=await fetch(chat,{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+token,
      'Content-Type':'application/json',
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'
    },
    body:JSON.stringify({model:'openai/gpt-4o-mini',messages,max_tokens:1200,temperature:0.3})
  });
  if(!response.ok){
    const error=new Error('Model HTTP '+response.status+': '+(await response.text()).slice(0,600));
    error.status=response.status;
    const after=Number(response.headers.get('retry-after'));
    error.waitMinutes=Number.isFinite(after)&&after>0?Math.ceil(after/60):30;
    throw error;
  }
  const data=await response.json();
  const answer=data.choices?.[0]?.message?.content;
  if(!answer||typeof answer!=='string')throw new Error('Model returned no text');
  return answer;
}

function postComment(number,body){
  return gh('/repos/'+repo+'/issues/'+number+'/comments',{method:'POST',body:JSON.stringify({body})});
}

async function processTask(issue){
  if(issue.pull_request||issue.user?.login?.toLowerCase()!==repo.split('/')[0].toLowerCase())return;
  const task=decodeTask(issue.body);
  if(!task)return;
  const comments=await allPages('/repos/'+repo+'/issues/'+issue.number+'/comments',10);
  let state=lastState(comments);
  if(!due(task,state))return;
  // A job is finite; later scheduled jobs continue the same task.
  for(let i=0;i<3;i++){
    if(!due(task,state))break;
    const step=state.step+1;
    try{
      const answer=await askModel(buildMessages(task,comments));
      const done=task.max_steps>0&&step>=task.max_steps;
      const nextAt=done?null:new Date().toISOString();
      const status=done?'done':'ok';
      const created=await postComment(issue.number,buildComment(step,status,answer,nextAt));
      comments.push({...created,_local:true});
      state={step,status,next_at:nextAt};
      console.log('Issue #'+issue.number+', step '+step+': '+status);
    }catch(error){
      const retry=error.status===429||error.status===503||!error.status;
      const wait=error.status===429?Math.max(5,error.waitMinutes||30):30;
      const nextAt=retry?new Date(Date.now()+wait*60000).toISOString():null;
      const status=retry?'backoff':'failed';
      const msg=error.message+'\n\n'+(retry?'Keyingi urinish: '+nextAt:'Avtomatik davom ettirish to‘xtatildi.');
      await postComment(issue.number,buildComment(state.step,status,msg,nextAt));
      console.error('Issue #'+issue.number+': '+error.message);
      break;
    }
  }
}

export async function main(){
  if(!token||!repo||!/^[\w.-]+\/[\w.-]+$/.test(repo))throw new Error('Missing GITHUB_TOKEN or GITHUB_REPOSITORY');
  const issues=await allPages('/repos/'+repo+'/issues?state=open',2);
  for(const issue of issues){
    try{await processTask(issue);}
    catch(error){console.error('Issue #'+issue.number+': '+error.message);}
  }
  console.log('Finished checking scheduled AI tasks.');
}
if(process.argv[1]?.endsWith('runner.mjs'))main().catch(e=>{console.error(e);process.exitCode=1;});
