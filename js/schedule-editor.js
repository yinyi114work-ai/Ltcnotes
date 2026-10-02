// Compact recurring, multi-date and one-off service arrangements.
function supervisorServiceOptions(){
  const coded=typeof serviceData!=='undefined'?serviceData.filter(x=>/^(BA|GA|SC)/.test(x.code)).map(x=>x.code+'｜'+x.name):[];
  return coded.length?coded:SUPERVISOR_SERVICE_ITEMS;
}
function normalizeSupervisorArrangements(items){
  const time=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x||''))?String(x):'';
  const date=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00');return !Number.isNaN(d.getTime())&&supervisorDateStr(d)===x;};
  return (Array.isArray(items)?items:[]).filter(x=>x&&typeof x==='object').map((x,i)=>({
    id:String(x.id||'arrangement_'+i),type:['weekly','dates','once'].includes(x.type)?x.type:'weekly',enabled:x.enabled!==false,
    days:[...new Set((Array.isArray(x.days)?x.days:[]).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<7))].sort(),
    dates:[...new Set((Array.isArray(x.dates)?x.dates:[]).filter(date))].sort(),start:time(x.start),end:time(x.end),
    worker:String(x.worker||'').trim(),services:(Array.isArray(x.services)?x.services:[]).filter(t=>typeof t==='string'),note:String(x.note||'').trim()
  }));
}
function migrateSupervisorArrangements(weekly){
  const out=[];
  for(const x of normalizeSupervisorWeekSchedule(weekly)){
    // Empty old weekday placeholders are not actual arrangements.
    if(!x.checked&&!x.start&&!x.end&&!x.worker&&!x.services.length&&!x.note)continue;
    const match=out.find(y=>y.enabled===x.checked&&y.start===x.start&&y.end===x.end&&y.worker===x.worker&&JSON.stringify(y.services)===JSON.stringify(x.services)&&y.note===x.note);
    if(match){if(!match.days.includes(x.day))match.days.push(x.day);}
    else out.push({id:'legacy_'+out.length,type:'weekly',enabled:x.checked,days:[x.day],dates:[],start:x.start,end:x.end,worker:x.worker,services:x.services,note:x.note});
  }
  return normalizeSupervisorArrangements(out);
}
function supervisorArrangementWhen(x){
  return x.type==='weekly'?'每週'+x.days.map(d=>SUPERVISOR_WEEKDAYS[d].slice(1)).join('、'):(x.type==='once'?'單次 ':'多日 ')+x.dates.join('、');
}
function supervisorArrangementSummary(x){
  return (x.enabled?'':'暫停｜')+supervisorArrangementWhen(x)+'｜'+(x.start||'未填')+'–'+(x.end||'未填')+(x.worker?'｜'+x.worker:'')+(x.services.length?'｜'+x.services.join('＋'):'');
}
function supervisorArrangementsText(items,extra=''){
  return [...normalizeSupervisorArrangements(items).filter(x=>x.enabled).map(x=>supervisorArrangementSummary(x)+(x.note?'｜'+x.note:'')),extra.trim()].filter(Boolean).join('；');
}
function supervisorArrangementMatches(x,date){
  if(!x.enabled||!date)return false;
  return x.type==='weekly'?x.days.includes((new Date(date+'T12:00:00').getDay()+6)%7):x.dates.includes(date);
}
function arrangementDateHTML(date=''){
  return `<div class="arr-date-row"><input type="date" class="arr-date" aria-label="服務日期" value="${supervisorEscape(date)}"><button type="button" class="ghost-btn arr-date-remove" aria-label="移除此日期">×</button></div>`;
}
function arrangementHTML(x,open=false){
  const esc=supervisorEscape;
  const opts=[...new Set([...supervisorServiceOptions(),...x.services])];
  return `<details class="arr-card" data-id="${esc(x.id)}" ${open?'open':''}><summary>${esc(supervisorArrangementSummary(x))}</summary><div class="arr-body"><div class="grid-2"><label>安排類型<select class="arr-type"><option value="weekly" ${x.type==='weekly'?'selected':''}>固定每週</option><option value="dates" ${x.type==='dates'?'selected':''}>不規則多日</option><option value="once" ${x.type==='once'?'selected':''}>單次服務</option></select></label><label class="check-item"><input class="arr-enabled" type="checkbox" ${x.enabled?'checked':''}>啟用此安排</label></div><fieldset class="arr-days" ${x.type==='weekly'?'':'hidden'}><legend>服務星期（可複選）</legend><div class="arr-day-picks">${SUPERVISOR_WEEKDAYS.map((label,day)=>`<label class="check-item"><input type="checkbox" value="${day}" ${x.days.includes(day)?'checked':''}>${label}</label>`).join('')}</div></fieldset><div class="arr-dates" ${x.type==='weekly'?'hidden':''}><label>服務日期</label><div class="arr-date-list">${(x.dates.length?x.dates:['']).map(arrangementDateHTML).join('')}</div><button type="button" class="secondary-btn arr-date-add" ${x.type==='once'?'hidden':''}>＋新增日期</button></div><div class="grid-2"><label>開始時間<input class="arr-start" type="time" value="${x.start}"></label><label>結束時間<input class="arr-end" type="time" value="${x.end}"></label><label class="grid-full">此安排居服員<input class="arr-worker" maxlength="60" value="${esc(x.worker)}" placeholder="留白則交班帶入主責居服員"></label></div><details class="arr-services"><summary>選服務碼別／名稱（已選 ${x.services.length} 項）</summary><label>搜尋碼別／名稱<input class="arr-search" placeholder="例如 BA07、BA20、沐浴"></label><div class="checkbox-grid arr-service-list">${opts.map(t=>`<label class="check-item"><input class="arr-service" type="checkbox" value="${esc(t)}" ${x.services.includes(t)?'checked':''}>${esc(t)}</label>`).join('')}</div></details><label>安排備註<input class="arr-note" maxlength="1000" value="${esc(x.note)}" placeholder="其他服務、服務順序及注意事項"></label><div class="button-row"><button type="button" class="secondary-btn arr-collapse">完成／收合</button><button type="button" class="ghost-btn arr-remove">移除此安排</button></div></div></details>`;
}
function readSupervisorArrangement(el){
  return {id:el.dataset.id,type:el.querySelector('.arr-type').value,enabled:el.querySelector('.arr-enabled').checked,days:[...el.querySelectorAll('.arr-days input:checked')].map(x=>Number(x.value)),dates:[...el.querySelectorAll('.arr-date')].map(x=>x.value).filter(Boolean),start:el.querySelector('.arr-start').value,end:el.querySelector('.arr-end').value,worker:el.querySelector('.arr-worker').value.trim(),services:[...el.querySelectorAll('.arr-service:checked')].map(x=>x.value),note:el.querySelector('.arr-note').value.trim()};
}
function readSupervisorArrangements(){return normalizeSupervisorArrangements([...document.querySelectorAll('#supervisorWeekSchedule .arr-card')].map(readSupervisorArrangement));}
function supervisorArrangementError(x){
  if(!x.enabled)return '';
  if(x.type==='weekly'&&!x.days.length)return '請至少選一個服務星期';
  if(x.type!=='weekly'&&!x.dates.length)return '請選服務日期';
  if(x.type==='once'&&x.dates.length!==1)return '單次服務請保留一個日期，或改為不規則多日';
  if(!x.start||!x.end||x.end<=x.start)return '請填完整時段，結束時間須晚於開始';
  return '';
}
function renderSupervisorArrangements(items=[]){
  const box=$('supervisorWeekSchedule');
  box.innerHTML='<div class="arr-list">'+normalizeSupervisorArrangements(items).map(x=>arrangementHTML(x)).join('')+'</div><button type="button" class="secondary-btn arr-add">＋新增服務安排</button>';
  function update(el){const x=readSupervisorArrangement(el);el.querySelector(':scope > summary').textContent=supervisorArrangementSummary(x);el.querySelector('.arr-services > summary').textContent='選服務碼別／名稱（已選 '+x.services.length+' 項）';}
  box.onclick=e=>{
    const btn=e.target.closest('button');if(!btn)return;
    const el=btn.closest('.arr-card');
    if(btn.classList.contains('arr-add'))box.querySelector('.arr-list').insertAdjacentHTML('beforeend',arrangementHTML({id:'arr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),type:'weekly',enabled:true,days:[],dates:[],start:'',end:'',worker:'',services:[],note:''},true));
    if(btn.classList.contains('arr-remove')&&confirm('移除此安排？儲存個案後才會生效。'))el.remove();
    if(btn.classList.contains('arr-collapse')){const err=supervisorArrangementError(readSupervisorArrangement(el));if(err){showToast(err);return;}update(el);el.open=false;}
    if(btn.classList.contains('arr-date-add'))el.querySelector('.arr-date-list').insertAdjacentHTML('beforeend',arrangementDateHTML());
    if(btn.classList.contains('arr-date-remove')){btn.closest('.arr-date-row').remove();update(el);}
  };
  box.onchange=e=>{const el=e.target.closest('.arr-card');if(!el)return;const type=el.querySelector('.arr-type').value;el.querySelector('.arr-days').hidden=type!=='weekly';el.querySelector('.arr-dates').hidden=type==='weekly';el.querySelector('.arr-date-add').hidden=type==='once';update(el);};
  box.oninput=e=>{const el=e.target.closest('.arr-card');if(!el)return;if(e.target.classList.contains('arr-search')){const q=e.target.value.toLowerCase();el.querySelectorAll('.arr-service-list label').forEach(label=>label.hidden=!label.textContent.toLowerCase().includes(q)&&!label.querySelector('input').checked);}else update(el);};
}
