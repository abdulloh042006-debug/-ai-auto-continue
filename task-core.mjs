// Shared, side-effect-free task logic. No private credentials in this module.
export const PREFIX = 'AACS_TASK_V1:';
export const META_PREFIX = 'AACS_STEP_V1:';
export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export function decodeTask(body) {
  if (typeof body !== 'string') return null;
  const match = body.match(/<!--\s*AACS_TASK_V1:([A-Za-z0-9_-]+)\s*-->/);
  if (!match) return null;
  try {
    const json = Buffer.from(match[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const value = JSON.parse(json);
    if (value.version !== 1 || typeof value.prompt !== 'string' || !value.prompt.trim()) return null;
    if (value.prompt.length > 3000 || typeof value.start_at !== 'string') return null;
    if (!Number.isFinite(Date.parse(value.start_at))) return null;
    if (!Number.isInteger(value.max_steps) || value.max_steps < 0 || value.max_steps > 1000) return null;
    if (value.model && value.model !== DEFAULT_MODEL) return null;
    return {...value, model: DEFAULT_MODEL};
  } catch { return null; }
}

export function getStepMeta(body) {
  if (typeof body !== 'string') return null;
  const match = body.match(/<!--\s*AACS_STEP_V1:(\{[^\n]*\})\s*-->/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[1]);
    return Number.isInteger(obj.step) && obj.step >= 0 && typeof obj.status === 'string' ? obj : null;
  } catch { return null; }
}

export function lastState(comments) {
  const own = (comments || []).filter(c => c.user?.type === 'Bot' || c._local === true);
  for (let i = own.length - 1; i >= 0; i--) {
    const meta = getStepMeta(own[i].body);
    if (meta) return meta;
  }
  return {step:0, status:'pending', next_at:null};
}

export function due(task, state, now = Date.now()) {
  if (state.status === 'failed' || state.status === 'done') return false;
  if (task.max_steps > 0 && state.step >= task.max_steps) return false;
  const next = state.next_at || task.start_at;
  return Number.isFinite(Date.parse(next)) && Date.parse(next) <= now;
}

export function buildMessages(task, comments) {
  const instruction = 'You are continuing a single project task across multiple steps. Respect the original user request. Each subsequent user message is simply "Continue". Work incrementally; explain what was actually done vs merely suggested. Do not claim to have changed files or run commands without tools. Never reveal secrets.';
  const messages = [{role:'system',content:instruction},{role:'user',content:task.prompt.slice(0,3000)}];
  const replies = (comments || [])
    .filter(c => (c.user?.type === 'Bot' || c._local === true) && getStepMeta(c.body)?.status === 'ok')
    .slice(-5);
  for (const reply of replies) {
    const body = reply.body.replace(/<!--\s*AACS_STEP_V1:[^\n]*-->/,'').trim()
      .replace(/^### AI javobi \(qadam \d+\)\s*/,'').trim();
    messages.push({role:'assistant',content:body.slice(0,2800)});
    messages.push({role:'user',content:'Continue'});
  }
  return messages;
}

export function buildComment(step, status, message, nextAt = null) {
  const meta = JSON.stringify({step, status, next_at:nextAt});
  const title = status === 'ok' ? '### AI javobi (qadam '+step+')' : '### Vazifa holati: '+status;
  return '<!-- '+META_PREFIX+meta+' -->\n'+title+'\n\n'+String(message).slice(0,40000);
}
