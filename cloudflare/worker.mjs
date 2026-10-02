const NOTION_AUTH_URL='https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL='https://api.notion.com/v1/oauth/token';
const NOTION_API='https://api.notion.com/v1';
const NOTION_VERSION='2026-03-11';
const APP_ORIGIN='https://yinyi114work-ai.github.io';
const APP_RETURN='https://yinyi114work-ai.github.io/Ltcnotes/';
const SYNC_TITLE='長照研究室｜居督小工具資料';
const encoder=new TextEncoder();
const decoder=new TextDecoder();
export default {
  async fetch(request,env){
    try{
      await ensureTables(env);
      const url=new URL(request.url);
      if(request.method==='OPTIONS'){
        return cors(new Response(null,{status:204}),request);
      }
      let res;
      if(url.pathname==='/'||url.pathname==='/health'){
        res=json({
          ok:true,
          service:'長照研究室｜居督 Notion Connector',
          status:'running',
          database:'connected',
          encryptionKey:env.TOKEN_ENCRYPTION_KEY?'configured':'not_configured',
          sync:'supervisor-v1',
          workerVersion:'supervisor-notion-v1'
        });
      }
      else if(url.pathname==='/auth/notion/start'){
        res=await startOAuth(env,url);
      }
      else if(url.pathname==='/auth/notion/callback'){
        res=await finishOAuth(request,env);
      }
      else if(url.pathname==='/api/notion/status'){
        res=await notionStatus(request,env);
      }
      else if(url.pathname==='/api/notion/state'&&request.method==='GET'){
        res=await getRemoteState(request,env);
      }
      else if(url.pathname==='/api/notion/state'&&request.method==='PUT'){
        res=await putRemoteState(request,env);
      }
      else if(url.pathname==='/api/notion/disconnect'&&request.method==='POST'){
        res=await disconnectNotion(request,env);
      }
      else{
        res=json({ok:false,error:'not_found'},404);
      }
      return cors(res,request);
    }catch(e){
      console.error('Notion connector request failed',e?.name||'Error');
      return cors(
        json({
          ok:false,
          error:'internal_error',
          message:'同步處理失敗，請檢查 Worker 設定、Notion 授權及網路後再試。'
        },500),
        request
      );
    }
  }
};
async function ensureTables(env){
  if(!env.DB){
    throw new Error('D1 binding DB is missing.');
  }
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notion_connections (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        workspace_name TEXT,
        bot_id TEXT,
        owner_json TEXT,
        access_token_encrypted TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sync_locks (
        workspace_key TEXT PRIMARY KEY,
        holder TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `)
  ]);
  const now=Date.now();
  await env.DB.prepare(
    'DELETE FROM oauth_states WHERE expires_at < ?'
  ).bind(now).run();
  await env.DB.prepare(
    'DELETE FROM sessions WHERE expires_at < ?'
  ).bind(now).run();
}
async function startOAuth(env,url){
  requireOAuthConfig(env);
  const state=randomToken(32);
  const now=Date.now();
  await env.DB.prepare(
    'INSERT INTO oauth_states (state,created_at,expires_at) VALUES (?,?,?)'
  )
  .bind(
    state,
    now,
    now+10*60*1000
  )
  .run();
  const authUrl=new URL(NOTION_AUTH_URL);
  authUrl.searchParams.set(
    'client_id',
    env.NOTION_CLIENT_ID
  );
  authUrl.searchParams.set(
    'response_type',
    'code'
  );
  authUrl.searchParams.set(
    'owner',
    'user'
  );
  authUrl.searchParams.set(
    'redirect_uri',
    env.NOTION_REDIRECT_URI
  );
  authUrl.searchParams.set(
    'state',
    state
  );
  return new Response(null,{status:302,headers:{Location:authUrl.toString(),'Set-Cookie':`supervisor_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,'Cache-Control':'no-store'}});
}
async function finishOAuth(request,env){
  requireOAuthConfig(env);
  if(!env.TOKEN_ENCRYPTION_KEY){
    return htmlPage(
      '尚未完成安全設定',
      'TOKEN_ENCRYPTION_KEY 尚未設定。',
      false
    );
  }
  const url=new URL(request.url);
  const code=url.searchParams.get('code');
  const state=url.searchParams.get('state');
  const oauthError=url.searchParams.get('error');
  if(oauthError){
    return htmlPage(
      'Notion 授權未完成',
      oauthError,
      false
    );
  }
  if(!code||!state){
    return htmlPage(
      '授權資料不完整',
      '缺少 OAuth code 或 state。',
      false
    );
  }
  const cookie=request.headers.get('Cookie')||'';
  if(!cookie.split(';').some(x=>x.trim()===`supervisor_oauth_state=${state}`))return htmlPage('安全驗證失敗','請使用同一瀏覽器重新開始連結。',false);
  const row=await env.DB.prepare(
    'DELETE FROM oauth_states WHERE state=? RETURNING state,expires_at'
  )
  .bind(state)
  .first();
  if(!row||Number(row.expires_at)<Date.now()){
    return htmlPage(
      '安全驗證失敗',
      '授權已逾時，請回小工具重新連結。',
      false
    );
  }
  await env.DB.prepare(
    'DELETE FROM oauth_states WHERE state=?'
  )
  .bind(state)
  .run();
  const basic=btoa(
    `${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`
  );
  const r=await fetch(
    NOTION_TOKEN_URL,
    {
      method:'POST',
      headers:{
        Authorization:`Basic ${basic}`,
        'Content-Type':'application/json',
        Accept:'application/json'
      },
      body:JSON.stringify({
        grant_type:'authorization_code',
        code,
        redirect_uri:env.NOTION_REDIRECT_URI
      })
    }
  );
  const data=await r.json();
  if(!r.ok||!data.access_token){
    return htmlPage(
      'Notion 連線失敗',
      '授權碼交換失敗，請重新連結。',
      false
    );
  }
  const id=crypto.randomUUID();
  const now=Date.now();
  const encrypted=await encryptText(
    data.access_token,
    env.TOKEN_ENCRYPTION_KEY
  );
  await env.DB.prepare(`
    INSERT INTO notion_connections (
      id,
      workspace_id,
      workspace_name,
      bot_id,
      owner_json,
      access_token_encrypted,
      created_at,
      updated_at
    )
    VALUES (?,?,?,?,?,?,?,?)
  `)
  .bind(
    id,
    data.workspace_id||null,
    data.workspace_name||null,
    data.bot_id||null,
    JSON.stringify(data.owner||null),
    encrypted,
    now,
    now
  )
  .run();
  const sid=randomToken(32);
  await env.DB.prepare(`
    INSERT INTO sessions (
      session_id,
      connection_id,
      created_at,
      expires_at
    )
    VALUES (?,?,?,?)
  `)
  .bind(
    sid,
    id,
    now,
    now+90*24*60*60*1000
  )
  .run();
  const target=
    `${APP_RETURN}#supervisor_notion_session=${encodeURIComponent(sid)}`;
  return new Response(
`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notion 已連線</title>
<style>
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#f7f6f3;
  margin:0;
  padding:40px;
  color:#272727;
}
.card{
  max-width:520px;
  margin:auto;
  background:#fff;
  padding:30px;
  border-radius:18px;
  border:1px solid #e8e5df;
}
a{
  display:inline-block;
  margin-top:12px;
  padding:12px 18px;
  background:#222;
  color:#fff;
  text-decoration:none;
  border-radius:10px;
}
</style>
</head>
<body>
<div class="card">
  <h1>✓ Notion 已連線</h1>
  <p>
    授權成功。正在回到居督小工具……
  </p>
  <a href="${target}">
    回到居督小工具
  </a>
</div>
<script>
setTimeout(function(){
  location.href=${JSON.stringify(target)};
},1200);
</script>
</body>
</html>`,
    {
      headers:{
        'Content-Type':'text/html; charset=utf-8',
        'Cache-Control':'no-store'
      }
    }
  );
}
async function authSession(request,env){
  const h=request.headers.get('Authorization')||'';
  if(!h.startsWith('Bearer ')){
    return null;
  }
  const sid=h.slice(7).trim();
  if(!sid){
    return null;
  }
  const row=await env.DB.prepare(`
    SELECT
      s.session_id,
      s.connection_id,
      s.expires_at,
      n.workspace_name,
      n.access_token_encrypted
    FROM sessions s
    JOIN notion_connections n
      ON n.id=s.connection_id
    WHERE s.session_id=?
  `)
  .bind(sid)
  .first();
  if(
    !row||
    Number(row.expires_at)<Date.now()
  ){
    return null;
  }
  row.access_token=await decryptText(
    row.access_token_encrypted,
    env.TOKEN_ENCRYPTION_KEY
  );
  return row;
}
async function notionStatus(request,env){
  const s=await authSession(request,env);
  return json({
    ok:true,
    connected:!!s,
    workspaceName:s?.workspace_name||null
  });
}
async function disconnectNotion(request,env){
  const s=await authSession(request,env);
  if(s){
    await env.DB.prepare(
      'DELETE FROM sessions WHERE session_id=?'
    )
    .bind(s.session_id)
    .run();
    await env.DB.prepare(
      'DELETE FROM notion_connections WHERE id=?'
    )
    .bind(s.connection_id)
    .run();
  }
  return json({
    ok:true,
    connected:false
  });
}
async function notionFetch(
  token,
  path,
  opts={}
){
  let r;
  for(let attempt=0;attempt<4;attempt++){
    r=await fetch(`${NOTION_API}${path}`,{
      ...opts,
      headers:{Authorization:`Bearer ${token}`,'Notion-Version':NOTION_VERSION,
        'Content-Type':'application/json',...(opts.headers||{})}
    });
    if(r.status!==429)break;
    if(attempt===3)break;
    const wait=Math.min(10000,Math.max(1000,Number(r.headers.get('Retry-After')||0)*1000||1000*(attempt+1)));
    await new Promise(resolve=>setTimeout(resolve,wait));
  }
  const text=await r.text();
  let data={};
  try{
    data=text
      ?JSON.parse(text)
      :{};
  }catch{
    data={raw:text};
  }
  if(!r.ok){
    throw new Error(
      `Notion API ${r.status}: ${
        data.message||
        data.code||
        'request failed'
      }`
    );
  }
  return data;
}
const STRUCTURED_DB_TITLES={cases:'居督個案與交班',visits:'每月訪視追蹤',todos:'居督待辦與排程'};
function titleProp(v){
  const s=String(v??'').trim()||'未命名';
  return {title:[{type:'text',text:{content:s.slice(0,1900)}}]};
}
function textProp(v){
  const s=String(v??'').trim();
  return {rich_text:s?Array.from({length:Math.ceil(s.length/1900)},(_,i)=>({type:'text',text:{content:s.slice(i*1900,(i+1)*1900)}})):[]};
}
function selectProp(v){
  const s=String(v??'').trim();
  return {select:s?{name:s.slice(0,100)}:null};
}
function dateProp(v){
  const s=String(v??'').trim();
  return {date:s?{start:s}:null};
}
function numberProp(v){
  if(v===''||v===null||v===undefined)return {number:null};
  const n=Number(v);
  return {number:Number.isFinite(n)?n:null};
}
function checkProp(v){return {checkbox:!!v};}
function emojiIcon(emoji){return {type:'emoji',emoji};}
function pageTitle(p){
  const prop=Object.values(p.properties||{}).find(x=>x.type==='title');
  return prop?.title?.map(x=>x.plain_text||'').join('')||'';
}
function databaseTitle(db){
  return (db.title||[]).map(x=>x.plain_text||'').join('');
}
async function searchObject(token,query,value){
  const results=[];let cursor=null;
  do{
    const body={query,page_size:100,filter:{property:'object',value}};
    if(cursor)body.start_cursor=cursor;
    const response=await notionFetch(token,'/search',{method:'POST',body:JSON.stringify(body)});
    results.push(...(response.results||[]));cursor=response.has_more?response.next_cursor:null;
  }while(cursor);
  return {results};
}
async function findSyncPage(token){
  const s=await searchObject(token,SYNC_TITLE,'page');
  const matches=(s.results||[]).filter(p=>pageTitle(p)===SYNC_TITLE);
  if(matches.length>1)throw new Error('找到多個同名同步頁面，已暫停以避免寫錯位置。');
  return matches[0]||null;
}
async function findParentPage(token){
  const s=await notionFetch(token,'/search',{
    method:'POST',
    body:JSON.stringify({
      page_size:50,
      filter:{property:'object',value:'page'},
      sort:{direction:'descending',timestamp:'last_edited_time'}
    })
  });
  return (s.results||[]).find(p=>pageTitle(p)!==SYNC_TITLE)||null;
}
async function ensureSyncPage(token){
  let page=await findSyncPage(token);
  if(page)return page;
  const parent=await findParentPage(token);
  if(!parent)throw new Error('找不到可寫入的 Notion 頁面。請重新授權並至少允許一個頁面。');
  return notionFetch(token,'/pages',{
    method:'POST',
    body:JSON.stringify({
      parent:{type:'page_id',page_id:parent.id},
      properties:{title:{title:[{type:'text',text:{content:SYNC_TITLE}}]}},
      children:[{
        object:'block',type:'paragraph',
        paragraph:{rich_text:[{type:'text',text:{content:'此頁由長照研究室居督小工具自動建立。下方資料庫由同步功能維護；日常資料仍建議於居督小工具編輯。'}}]}
      }]
    })
  });
}
async function findDatabase(token,title,parentPageId=null){
  if(!parentPageId)throw new Error('必須指定資料庫所在的同步頁面。');
  const children=await childBlocks(token,parentPageId);
  const child=children.find(b=>b.type==='child_database'&&b.child_database?.title===title);
  return child?getDatabase(token,child.id):null;
}
async function getDatabase(token,id){return notionFetch(token,`/databases/${id}`);}
function dataSourceIdOf(db){return db?.data_sources?.[0]?.id||null;}
const CASE_COLUMNS=['個案','狀態','居服員','服務時間','個案體況','服務細節','交班備註','內部備註','更新時間','系統ID'];
async function configureInitialTable(token,databaseId,columns){
  const listed=await notionFetch(token,`/views?database_id=${encodeURIComponent(databaseId)}`);
  const viewId=listed.results?.[0]?.id;
  if(!viewId)throw new Error('找不到新資料庫的預設表格。');
  await notionFetch(token,`/views/${viewId}`,{
    method:'PATCH',body:JSON.stringify({configuration:{
      type:'table',properties:columns.map(name=>({
        property_id:name,visible:name!=='系統ID'
      }))
    }})
  });
}
async function ensureDatabase(token,parentPageId,title,properties,emoji){
  let db=await findDatabase(token,title,parentPageId);
  if(db){
    db=await getDatabase(token,db.id);
    if(db.parent?.page_id!==parentPageId)db=null;
  }
  if(db){
    const dsId=dataSourceIdOf(db);
    if(!dsId)throw new Error(`${title} 找不到 data source。`);
    if(!db.icon&&emoji)await notionFetch(token,`/databases/${db.id}`,{
      method:'PATCH',body:JSON.stringify({icon:emojiIcon(emoji)})
    });
    return {databaseId:db.id,dataSourceId:dsId};
  }
  db=await notionFetch(token,'/databases',{
    method:'POST',
    body:JSON.stringify({
      parent:{type:'page_id',page_id:parentPageId},
      title:[{type:'text',text:{content:title}}],
      icon:emojiIcon(emoji),
      is_inline:true,
      initial_data_source:{properties}
    })
  });
  let dsId=dataSourceIdOf(db);
  if(!dsId){db=await getDatabase(token,db.id);dsId=dataSourceIdOf(db);}
  if(!dsId)throw new Error(`${title} 建立後找不到 data source。`);
  if(title===STRUCTURED_DB_TITLES.cases){
    // Only touch the auto-created view. A returning user's custom layout remains intact.
    try{await configureInitialTable(token,db.id,CASE_COLUMNS);}
    catch(error){console.error('Notion default table layout:',error);}
  }
  return {databaseId:db.id,dataSourceId:dsId};
}
async function ensureStructuredWorkspace(token){
  const root=await ensureSyncPage(token);
  const cases=await ensureDatabase(token,root.id,STRUCTURED_DB_TITLES.cases,{
    '個案':{title:{}},'系統ID':{rich_text:{}},'狀態':{select:{options:[]}},'居服員':{rich_text:{}},'服務時間':{rich_text:{}},'開始服務日':{date:{}},'最近家訪日':{date:{}},'個案體況':{rich_text:{}},'服務細節':{rich_text:{}},'交班備註':{rich_text:{}},'內部備註':{rich_text:{}},'更新時間':{date:{}}
  },'👥');
  const visits=await ensureDatabase(token,root.id,STRUCTURED_DB_TITLES.visits,{
    '紀錄':{title:{}},'系統ID':{rich_text:{}},'個案ID':{rich_text:{}},'月份':{rich_text:{}},'家訪完成':{checkbox:{}},'電訪完成':{checkbox:{}},'排定日期':{date:{}},'排定時間':{rich_text:{}}
  },'🏠');
  const todos=await ensureDatabase(token,root.id,STRUCTURED_DB_TITLES.todos,{
    '待辦事項':{title:{}},'系統ID':{rich_text:{}},'個案ID':{rich_text:{}},'日期':{date:{}},'時段':{rich_text:{}},'類型':{rich_text:{}},'已完成':{checkbox:{}},'備註':{rich_text:{}}
  },'✅');
  return {root,cases,visits,todos};
}
async function queryAll(token,dataSourceId){
  const out=[];let cursor=null;
  do{
    const body={page_size:100}; if(cursor)body.start_cursor=cursor;
    const d=await notionFetch(token,`/data_sources/${dataSourceId}/query`,{
      method:'POST',body:JSON.stringify(body)
    });
    out.push(...(d.results||[])); cursor=d.has_more?d.next_cursor:null;
  }while(cursor);
  return out;
}
function plainProp(page,name){
  const p=page?.properties?.[name]; if(!p)return '';
  if(p.type==='title')return (p.title||[]).map(x=>x.plain_text||'').join('');
  if(p.type==='rich_text')return (p.rich_text||[]).map(x=>x.plain_text||'').join('');
  if(p.type==='select')return p.select?.name||'';
  if(p.type==='date')return p.date?.start||'';
  if(p.type==='number')return p.number??'';
  if(p.type==='checkbox')return !!p.checkbox;
  return '';
}
async function upsertRows(token,dataSourceId,rows){
  const pages=await queryAll(token,dataSourceId);
  const byId=new Map();
  for(const p of pages){
    const id=plainProp(p,'系統ID');
    if(id)byId.set(id,p);
  }
  for(const row of rows){
    if(!row.id)continue;
    const old=byId.get(row.id);
    if(old){
      const changed=Object.entries(row.properties).some(([key,prop])=>{
        const value=prop.title?.map(x=>x.text.content).join('')??
          prop.rich_text?.map(x=>x.text.content).join('')??
          prop.select?.name??prop.date?.start??prop.number??prop.checkbox??'';
        return String(plainProp(old,key))!==String(value);
      });
      if(changed||(!old.icon&&row.icon))await notionFetch(token,`/pages/${old.id}`,{
        method:'PATCH',body:JSON.stringify({
          ...(changed?{properties:row.properties}:{}),
          ...(!old.icon&&row.icon?{icon:row.icon}:{})
        })
      });
    }else{
      await notionFetch(token,'/pages',{
        method:'POST',
        body:JSON.stringify({parent:{type:'data_source_id',data_source_id:dataSourceId},properties:row.properties,icon:row.icon})
      });
    }
  }
  const keep=new Set(rows.map(row=>row.id));
  for(const [id,page] of byId){
    if(!keep.has(id))await notionFetch(token,`/pages/${page.id}`,{
      method:'PATCH',body:JSON.stringify({in_trash:true})
    });
  }
}
function buildRows(payload){
  const cases=payload.cases.map(c=>({id:c.id,icon:emojiIcon('👤'),properties:{
    '個案':titleProp(c.name),'系統ID':textProp(c.id),'狀態':selectProp(c.status==='paused'?'暫停服務':c.status==='closed'?'已結案':'服務中'),'居服員':textProp(c.homeCareWorker),'服務時間':textProp(c.serviceSchedule),'開始服務日':dateProp(c.startDate),'最近家訪日':dateProp(c.lastVisitDate),'個案體況':textProp(c.condition),'服務細節':textProp(c.serviceDetails),'交班備註':textProp(c.handoverNote),'內部備註':textProp(c.note),'更新時間':dateProp(new Date(c.updatedAt||Date.now()).toISOString())
  }}));
  const visits=[];
  for(const c of payload.cases)for(const [month,r] of Object.entries(c.followups||{})){
    const id=c.id+':'+month;const legacy=!!r.completed&&!('homeCompleted' in r)&&!('phoneCompleted' in r);
    visits.push({id,icon:emojiIcon('🏠'),properties:{'紀錄':titleProp((c.name||'')+' '+month),'系統ID':textProp(id),'個案ID':textProp(c.id),'月份':textProp(month),'家訪完成':checkProp(r.homeCompleted||(legacy&&r.type==='homevisit')),'電訪完成':checkProp(r.phoneCompleted||(legacy&&r.type==='phonevisit')),'排定日期':dateProp(r.scheduledDate),'排定時間':textProp(r.scheduledTime)}});
  }
  const todos=payload.todos.map(t=>({id:t.id,icon:emojiIcon('📌'),properties:{'待辦事項':titleProp(t.subject),'系統ID':textProp(t.id),'個案ID':textProp(t.caseId),'日期':dateProp(t.date),'時段':textProp([t.startTime,t.endTime].filter(Boolean).join('–')),'類型':textProp(t.type),'已完成':checkProp(t.status==='done'),'備註':textProp(t.note)}}));
  return {cases,visits,todos};
}
// The complete state lives in versioned Notion code blocks. Tables are a readable
// projection. The final manifest is appended only after every data block exists.
async function childBlocks(token,pageId){
  const out=[];let cursor=null;
  do{
    const q=new URLSearchParams({page_size:'100'});if(cursor)q.set('start_cursor',cursor);
    const d=await notionFetch(token,`/blocks/${pageId}/children?${q}`);
    out.push(...(d.results||[]));cursor=d.has_more?d.next_cursor:null;
  }while(cursor);
  return out;
}
const BACKUP_TITLE='系統備份｜請勿編輯';
async function backupPage(token,root,create=false){
  const children=await childBlocks(token,root.id);
  const found=children.find(b=>b.type==='child_page'&&b.child_page?.title===BACKUP_TITLE);
  if(found)return {id:found.id};
  if(!create)return null;
  return notionFetch(token,'/pages',{method:'POST',body:JSON.stringify({
    parent:{type:'page_id',page_id:root.id},
    properties:{title:{title:[{type:'text',text:{content:BACKUP_TITLE}}]}},
    children:[{object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:'由居督小工具維護完整資料，請勿直接修改此頁。個案資訊請在主頁表格閱讀。'}}]}}]
  })});
}
function blockText(b){return (b[b.type]?.rich_text||[]).map(x=>x.plain_text??x.text?.content??'').join('');}
async function digest(text){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
  return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
async function readSnapshot(token,root){
  const backup=await backupPage(token,root);
  const blocks=backup?await childBlocks(token,backup.id):await childBlocks(token,root.id);
  const chunks=new Map(),manifests=[];
  for(const b of blocks){
    if(b.type!=='code')continue;
    const t=blockText(b);
    const part=/^LTC_SUPERVISOR_V1_DATA:([^:]+):(\d+):([\s\S]*)$/.exec(t);
    if(part){const a=chunks.get(part[1])||[];a[Number(part[2])]=part[3];chunks.set(part[1],a);}
    const head=/^LTC_SUPERVISOR_V1_META:([^:]+):(\d+):([a-f0-9]{64})$/.exec(t);
    if(head)manifests.push({revision:head[1],count:Number(head[2]),hash:head[3]});
  }
  for(const m of manifests.reverse().slice(0,1)){
    const parts=chunks.get(m.revision);
    if(!parts||parts.length!==m.count||parts.some(x=>typeof x!=='string'))continue;
    const source=parts.join('');if(await digest(source)!==m.hash)continue;
    const state=JSON.parse(source);
    if(state.app!=='ltc-supervisor'||!Array.isArray(state.cases)||!Array.isArray(state.visits)||!Array.isArray(state.todos)||!Array.isArray(state.homeVisits))continue;
    return {revision:m.revision,state};
  }
  if(manifests.length||chunks.size)throw new Error('Notion 同步快照不完整，已停止讀取以保護資料。');
  return null;
}
function codeBlock(content){return {object:'block',type:'code',code:{language:'json',rich_text:[{type:'text',text:{content}}]}};}
async function appendSnapshot(token,root,state){
  const backup=await backupPage(token,root,true);
  const revision=crypto.randomUUID(),source=JSON.stringify(state),parts=[];
  for(let i=0;i<source.length;i+=1700)parts.push(codeBlock(`LTC_SUPERVISOR_V1_DATA:${revision}:${parts.length}:${source.slice(i,i+1700)}`));
  for(let i=0;i<parts.length;i+=100)await notionFetch(token,`/blocks/${backup.id}/children`,{
    method:'PATCH',body:JSON.stringify({children:parts.slice(i,i+100)})
  });
  await notionFetch(token,`/blocks/${backup.id}/children`,{
    method:'PATCH',body:JSON.stringify({children:[codeBlock(`LTC_SUPERVISOR_V1_META:${revision}:${parts.length}:${await digest(source)}`)]})
  });
  return revision;
}
async function withWorkspaceLock(env,key,operation){
  const holder=crypto.randomUUID(),now=Date.now();
  const result=await env.DB.prepare(`INSERT INTO sync_locks(workspace_key,holder,expires_at) VALUES(?,?,?)
    ON CONFLICT(workspace_key) DO UPDATE SET holder=excluded.holder,expires_at=excluded.expires_at
    WHERE sync_locks.expires_at < ?`).bind(key,holder,now+10*60*1000,now).run();
  if(!result.meta?.changes)return json({ok:false,error:'sync_busy'},409);
  try{return await operation();}
  finally{await env.DB.prepare('DELETE FROM sync_locks WHERE workspace_key=? AND holder=?').bind(key,holder).run();}
}
async function getRemoteState(request,env){
  const s=await authSession(request,env);
  if(!s)return json({ok:false,error:'unauthorized'},401);
  const root=await findSyncPage(s.access_token);
  if(!root)return json({ok:true,exists:false,revision:null,state:null});
  const snapshot=await readSnapshot(s.access_token,root);
  return json({ok:true,exists:!!snapshot,revision:snapshot?.revision||null,
    state:snapshot?.state||null,format:'snapshot-and-tables',pageId:root.id});
}
async function putRemoteState(request,env){
  const s=await authSession(request,env);
  if(!s)return json({ok:false,error:'unauthorized'},401);
  const body=await request.json(),payload=body?.state;
  if(payload?.app!=='ltc-supervisor'||!Array.isArray(payload.cases)||!Array.isArray(payload.visits)||!Array.isArray(payload.todos)||!Array.isArray(payload.homeVisits)){
    return json({ok:false,error:'invalid_state'},400);
  }
  const ids=(rows)=>rows.every(x=>x&&typeof x.id==='string'&&x.id.length>0)&&new Set(rows.map(x=>x.id)).size===rows.length;
  if(!ids(payload.cases)||!ids(payload.todos))return json({ok:false,error:'invalid_ids'},400);
  const root=await ensureSyncPage(s.access_token);
  return withWorkspaceLock(env,root.id,async()=>{
    const current=await readSnapshot(s.access_token,root);
    if((current?.revision||null)!==(body.baseRevision||null))
      return json({ok:false,error:'sync_conflict',revision:current?.revision||null},409);
    const clean={version:1,app:'ltc-supervisor',cases:payload.cases,visits:payload.visits,todos:payload.todos,
      homeVisits:payload.homeVisits,settings:payload.settings||{}};
    const ws=await ensureStructuredWorkspace(s.access_token),rows=buildRows(clean);
    await upsertRows(s.access_token,ws.cases.dataSourceId,rows.cases);
    await upsertRows(s.access_token,ws.visits.dataSourceId,rows.visits);
    await upsertRows(s.access_token,ws.todos.dataSourceId,rows.todos);
    const revision=await appendSnapshot(s.access_token,root,clean);
    return json({ok:true,revision,savedAt:new Date().toISOString(),pageId:root.id,
      format:'snapshot-and-tables',counts:{cases:rows.cases.length,visits:rows.visits.length,todos:rows.todos.length}});
  });
}
function requireOAuthConfig(env){
  for(
    const k of [
      'NOTION_CLIENT_ID',
      'NOTION_CLIENT_SECRET',
      'NOTION_REDIRECT_URI'
    ]
  ){
    if(!env[k]){
      throw new Error(
        `${k} is missing.`
      );
    }
  }
}
async function getEncryptionKey(
  secret
){
  const raw=await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(secret)
  );
  return crypto.subtle.importKey(
    'raw',
    raw,
    {
      name:'AES-GCM'
    },
    false,
    [
      'encrypt',
      'decrypt'
    ]
  );
}
async function encryptText(
  text,
  secret
){
  const key=await getEncryptionKey(
    secret
  );
  const iv=crypto.getRandomValues(
    new Uint8Array(12)
  );
  const ct=await crypto.subtle.encrypt(
    {
      name:'AES-GCM',
      iv
    },
    key,
    encoder.encode(text)
  );
  return `${
    bytesToBase64(iv)
  }.${
    bytesToBase64(
      new Uint8Array(ct)
    )
  }`;
}
async function decryptText(
  value,
  secret
){
  const [a,b]=value.split('.');
  const key=await getEncryptionKey(
    secret
  );
  const pt=await crypto.subtle.decrypt(
    {
      name:'AES-GCM',
      iv:base64ToBytes(a)
    },
    key,
    base64ToBytes(b)
  );
  return decoder.decode(pt);
}
function randomToken(n=32){
  const b=new Uint8Array(n);
  crypto.getRandomValues(b);
  return bytesToBase64(b)
    .replace(/\+/g,'-')
    .replace(/\//g,'_')
    .replace(/=+$/g,'');
}
function bytesToBase64(bytes){
  let s='';
  for(const b of bytes){
    s+=String.fromCharCode(b);
  }
  return btoa(s);
}
function base64ToBytes(v){
  const s=atob(v);
  const b=new Uint8Array(
    s.length
  );
  for(
    let i=0;
    i<s.length;
    i++
  ){
    b[i]=s.charCodeAt(i);
  }
  return b;
}
function json(
  data,
  status=200
){
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers:{
        'Content-Type':
          'application/json; charset=utf-8',
        'Cache-Control':
          'no-store'
      }
    }
  );
}
function cors(
  res,
  request
){
  const origin=
    request.headers.get('Origin');
  if(origin===APP_ORIGIN){
    const h=
      new Headers(res.headers);
    h.set(
      'Access-Control-Allow-Origin',
      APP_ORIGIN
    );
    h.set(
      'Vary',
      'Origin'
    );
    h.set(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type'
    );
    h.set(
      'Access-Control-Allow-Methods',
      'GET, PUT, POST, OPTIONS'
    );
    return new Response(
      res.body,
      {
        status:res.status,
        statusText:res.statusText,
        headers:h
      }
    );
  }
  return res;
}
function htmlPage(
  title,
  msg,
  ok
){
  return new Response(
`<!doctype html>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>${title}</title>
<body
  style="font-family:sans-serif;padding:40px"
>
<h1>
  ${ok?'✓ ':''}${title}
</h1>
<p>
  ${msg}
</p>
</body>`,
    {
      status:ok?200:400,
      headers:{
        'Content-Type':
          'text/html; charset=utf-8'
      }
    }
  );
}
