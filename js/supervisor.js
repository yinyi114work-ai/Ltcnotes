// ===== 居督工作台 v1.1 =====
const SUPERVISOR_STORAGE_KEY = 'longcareSupervisorTasksV1';
const SUPERVISOR_TYPE_META = {
  shift: { label: '找代班', icon: '🔄' },
  medical: { label: '陪同就醫人力', icon: '🏥' },
  supervision: { label: '居服員個督', icon: '👥' },
  homevisit: { label: '家訪', icon: '🏠' },
  phonevisit: { label: '電訪', icon: '☎' },
  mutation: { label: '異動通報', icon: '📄' },
  meeting: { label: '會議紀錄', icon: '📝' },
  discussion: { label: '個案討論', icon: '📋' },
  callback: { label: '回電', icon: '📞' },
  other: { label: '其他', icon: '⭐' }
};
const SUPERVISOR_PRIORITY_META = {
  urgent: { label: '急', rank: 0 },
  normal: { label: '一般', rank: 1 },
  low: { label: '不急', rank: 2 }
};
let supervisorTasks = [];
let supervisorSelectedDate = '';
let supervisorCalendarCursor = new Date();

function supervisorDateStr(date){
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function supervisorEscape(value){
  return String(value || '').replace(/[&<>'"]/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}
function loadSupervisorTasks(){
  try{
    const raw = JSON.parse(localStorage.getItem(SUPERVISOR_STORAGE_KEY) || '[]');
    supervisorTasks = Array.isArray(raw) ? raw.filter(item=>item && item.id).map(item=>({
      ...item,
      startTime: item.startTime || item.time || '',
      endTime: item.endTime || '',
      askedPeople: item.askedPeople || '',
      status: item.status === 'done' ? 'done' : 'pending'
    })) : [];
  }catch(e){ supervisorTasks = []; }
}
function saveSupervisorTasks(){ localStorage.setItem(SUPERVISOR_STORAGE_KEY, JSON.stringify(supervisorTasks)); }
function supervisorSort(tasks){
  return [...tasks].sort((a,b)=>{
    const doneCompare = Number(a.status === 'done') - Number(b.status === 'done');
    if(doneCompare) return doneCompare;
    const p = (SUPERVISOR_PRIORITY_META[a.priority]?.rank ?? 1) - (SUPERVISOR_PRIORITY_META[b.priority]?.rank ?? 1);
    if(p) return p;
    const dateA = `${a.date || '9999-12-31'}T${a.startTime || '23:59'}`;
    const dateB = `${b.date || '9999-12-31'}T${b.startTime || '23:59'}`;
    if(dateA !== dateB) return dateA.localeCompare(dateB);
    return Number(a.createdAt || 0) - Number(b.createdAt || 0);
  });
}
function openSupervisorForm(task){
  const form = $('supervisorTaskForm'); if(!form) return;
  form.hidden = false;
  $('supervisorFormTitle').textContent = task ? '編輯待辦' : '新增待辦';
  $('supervisorTaskId').value = task?.id || '';
  $('supervisorTaskType').value = task?.type || 'shift';
  $('supervisorTaskSubject').value = task?.subject || '';
  $('supervisorTaskDate').value = task?.date || supervisorSelectedDate || supervisorDateStr(new Date());
  $('supervisorTaskStartTime').value = task?.startTime || task?.time || '';
  $('supervisorTaskEndTime').value = task?.endTime || '';
  $('supervisorTaskPriority').value = task?.priority || 'normal';
  $('supervisorTaskStatus').value = task?.status === 'done' ? 'done' : 'pending';
  $('supervisorTaskAsked').value = task?.askedPeople || '';
  $('supervisorTaskNote').value = task?.note || '';
  $('supervisorTaskSubject').focus();
  form.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function closeSupervisorForm(){ const form=$('supervisorTaskForm'); if(form) form.hidden=true; if($('supervisorTaskId')) $('supervisorTaskId').value=''; }
function validateTimeRange(start,end){ return !start || !end || start < end; }
function saveSupervisorTask(){
  const subject=v('supervisorTaskSubject'), date=v('supervisorTaskDate');
  const startTime=v('supervisorTaskStartTime'), endTime=v('supervisorTaskEndTime');
  if(!subject){ showToast('請填寫個案或事項名稱'); $('supervisorTaskSubject').focus(); return; }
  if(!date){ showToast('請選擇日期'); $('supervisorTaskDate').focus(); return; }
  if(!validateTimeRange(startTime,endTime)){ showToast('結束時間需晚於開始時間'); $('supervisorTaskEndTime').focus(); return; }
  const id=v('supervisorTaskId'); const existing=supervisorTasks.find(task=>task.id===id);
  const item={
    id:id || `task_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    type:v('supervisorTaskType') || 'other', subject, date, startTime, endTime,
    priority:v('supervisorTaskPriority') || 'normal', status:v('supervisorTaskStatus')==='done'?'done':'pending',
    askedPeople:v('supervisorTaskAsked'), note:v('supervisorTaskNote'),
    scheduleCompleted: existing?.scheduleCompleted || false,
    mutationIncluded: existing?.mutationIncluded || false,
    createdAt:existing?.createdAt || Date.now(), updatedAt:Date.now()
  };
  if(existing) supervisorTasks=supervisorTasks.map(task=>task.id===id?item:task); else supervisorTasks.push(item);
  saveSupervisorTasks(); closeSupervisorForm(); renderSupervisorDashboard(); showToast(existing?'已更新待辦':'已新增待辦');
}
function openSupervisorCompleteModal(id){
  const task=supervisorTasks.find(item=>item.id===id); if(!task) return;
  const modal=$('supervisorCompleteModal');
  $('supervisorCompleteTaskId').value=id;
  $('supervisorCompleteSubject').textContent=`${SUPERVISOR_TYPE_META[task.type]?.label || '待辦'}｜${task.subject}`;
  $('supervisorScheduleCompleted').checked=!!task.scheduleCompleted;
  $('supervisorMutationIncluded').checked=!!task.mutationIncluded;
  const staffingTask=['shift','medical'].includes(task.type);
  $('supervisorScheduleCompleted').closest('label').hidden=!staffingTask;
  $('supervisorMutationIncluded').closest('label').hidden=!staffingTask;
  modal.hidden=false;
}
function closeSupervisorCompleteModal(){ const modal=$('supervisorCompleteModal'); if(modal) modal.hidden=true; }
function confirmSupervisorComplete(){
  const id=v('supervisorCompleteTaskId');
  supervisorTasks=supervisorTasks.map(task=>task.id===id?{
    ...task,status:'done',
    scheduleCompleted:$('supervisorScheduleCompleted').checked,
    mutationIncluded:$('supervisorMutationIncluded').checked,
    completedAt:Date.now(),updatedAt:Date.now()
  }:task);
  saveSupervisorTasks(); closeSupervisorCompleteModal(); renderSupervisorDashboard(); showToast('已標記完成');
}
function toggleSupervisorTask(id,checked){
  if(checked){ openSupervisorCompleteModal(id); return; }
  supervisorTasks=supervisorTasks.map(task=>task.id===id?{...task,status:'pending',updatedAt:Date.now()}:task);
  saveSupervisorTasks(); renderSupervisorDashboard();
}
function deleteSupervisorTask(id){
  const task=supervisorTasks.find(item=>item.id===id);
  if(!task || !window.confirm(`確定刪除「${task.subject}」？`)) return;
  supervisorTasks=supervisorTasks.filter(item=>item.id!==id); saveSupervisorTasks(); renderSupervisorDashboard(); showToast('已刪除待辦');
}
function isSupervisorOverdue(task){ return task.status!=='done' && task.date && task.date<supervisorDateStr(new Date()); }
function renderSupervisorStats(){
  const today=supervisorDateStr(new Date()); const pending=supervisorTasks.filter(t=>t.status!=='done');
  const urgent=pending.filter(t=>t.priority==='urgent').length, todayCount=pending.filter(t=>t.date===today).length, overdue=pending.filter(isSupervisorOverdue).length;
  $('supervisorStats').innerHTML=`<div class="supervisor-stat"><span>急件</span><strong>${urgent}</strong></div><div class="supervisor-stat"><span>今日待辦</span><strong>${todayCount}</strong></div><div class="supervisor-stat"><span>已逾期</span><strong>${overdue}</strong></div>`;
}
function renderSupervisorTasks(){
  const showCompleted=$('supervisorShowCompleted')?.checked;
  let tasks=supervisorTasks.filter(task=>showCompleted || task.status!=='done');
  if(supervisorSelectedDate) tasks=tasks.filter(task=>task.date===supervisorSelectedDate);
  tasks=supervisorSort(tasks);
  $('supervisorListTitle').textContent=supervisorSelectedDate?'當日待辦':'全部待辦';
  $('supervisorSelectedDateLabel').textContent=supervisorSelectedDate?supervisorSelectedDate.replaceAll('-','／'):'依急迫程度與日期排序';
  if(!tasks.length){ $('supervisorTaskList').innerHTML=`<div class="supervisor-empty">${supervisorSelectedDate?'這一天目前沒有待辦事項。':'目前沒有待辦事項，按「新增待辦」開始使用。'}</div>`; return; }
  $('supervisorTaskList').innerHTML=tasks.map(task=>{
    const type=SUPERVISOR_TYPE_META[task.type] || SUPERVISOR_TYPE_META.other;
    const overdue=isSupervisorOverdue(task);
    const timeText=task.startTime ? `${task.startTime}${task.endTime?`–${task.endTime}`:''}` : '';
    const completionNotes=task.status==='done' && ['shift','medical'].includes(task.type)
      ? `<div class="task-completion-note"><span>${task.scheduleCompleted?'✓':'○'} 已完成人力／排班</span><span>${task.mutationIncluded?'✓':'○'} 已列入異動通報</span></div>`:'';
    return `<article class="supervisor-task priority-${task.priority} ${overdue?'is-overdue':''} ${task.status==='done'?'is-done':''}" data-id="${supervisorEscape(task.id)}">
      <input class="task-check" type="checkbox" ${task.status==='done'?'checked':''} aria-label="標記完成">
      <div class="task-main">
        <div class="task-title-row"><span class="task-title">${supervisorEscape(task.subject)}</span><span class="task-type-badge">${type.icon} ${type.label}</span><span class="task-status-badge ${task.status}">${task.status==='done'?'已完成':'待處理'}</span></div>
        <div class="task-meta"><span>📅 ${supervisorEscape(task.date)}</span>${timeText?`<span>🕒 ${supervisorEscape(timeText)}</span>`:''}<span>${overdue?'⚠ 已逾期':`優先：${SUPERVISOR_PRIORITY_META[task.priority]?.label || '一般'}`}</span></div>
        ${task.askedPeople?`<div class="task-asked"><strong>已詢問：</strong>${supervisorEscape(task.askedPeople).replace(/\n/g,'<br>')}</div>`:''}
        ${task.note?`<p class="task-note">${supervisorEscape(task.note)}</p>`:''}${completionNotes}
      </div>
      <div class="task-actions"><button class="task-action edit" type="button">編輯</button><button class="task-action delete" type="button">刪除</button></div>
    </article>`;
  }).join('');
  document.querySelectorAll('#supervisorTaskList .supervisor-task').forEach(card=>{
    const id=card.dataset.id;
    card.querySelector('.task-check').addEventListener('change',e=>toggleSupervisorTask(id,e.target.checked));
    card.querySelector('.edit').addEventListener('click',()=>openSupervisorForm(supervisorTasks.find(task=>task.id===id)));
    card.querySelector('.delete').addEventListener('click',()=>deleteSupervisorTask(id));
  });
}
function renderSupervisorCalendar(){
  const title=$('calendarTitle'), calendar=$('supervisorCalendar'); if(!title || !calendar) return;
  const year=supervisorCalendarCursor.getFullYear(), month=supervisorCalendarCursor.getMonth();
  title.textContent=`${year}年 ${month+1}月`;
  const first=new Date(year,month,1), start=new Date(year,month,1-first.getDay()), today=supervisorDateStr(new Date()), cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i); const ds=supervisorDateStr(d);
    const dayTasks=supervisorTasks.filter(t=>t.date===ds && t.status!=='done');
    const priorities=['urgent','normal','low'].filter(p=>dayTasks.some(t=>t.priority===p));
    cells.push(`<button class="calendar-day ${d.getMonth()!==month?'other-month':''} ${ds===today?'today':''} ${ds===supervisorSelectedDate?'selected':''}" type="button" data-date="${ds}"><span class="calendar-day-number">${d.getDate()}</span><span class="calendar-dots">${priorities.map(p=>`<i class="calendar-dot ${p}"></i>`).join('')}</span></button>`);
  }
  calendar.innerHTML=cells.join('');
  calendar.querySelectorAll('.calendar-day').forEach(btn=>btn.addEventListener('click',()=>{
    supervisorSelectedDate=btn.dataset.date; const selected=new Date(`${supervisorSelectedDate}T00:00:00`);
    supervisorCalendarCursor=new Date(selected.getFullYear(),selected.getMonth(),1); renderSupervisorDashboard();
  }));
}
function renderSupervisorDashboard(){ renderSupervisorStats(); renderSupervisorTasks(); renderSupervisorCalendar(); }
function initSupervisorTool(){
  if(!$('supervisorTool')) return;
  loadSupervisorTasks(); supervisorCalendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  $('supervisorAddTask')?.addEventListener('click',()=>openSupervisorForm());
  $('supervisorCloseForm')?.addEventListener('click',closeSupervisorForm);
  $('supervisorCancelTask')?.addEventListener('click',closeSupervisorForm);
  $('supervisorSaveTask')?.addEventListener('click',saveSupervisorTask);
  $('supervisorShowCompleted')?.addEventListener('change',renderSupervisorTasks);
  $('supervisorShowAll')?.addEventListener('click',()=>{supervisorSelectedDate='';renderSupervisorDashboard();});
  $('calendarPrev')?.addEventListener('click',()=>{supervisorCalendarCursor.setMonth(supervisorCalendarCursor.getMonth()-1);renderSupervisorCalendar();});
  $('calendarNext')?.addEventListener('click',()=>{supervisorCalendarCursor.setMonth(supervisorCalendarCursor.getMonth()+1);renderSupervisorCalendar();});
  $('supervisorConfirmComplete')?.addEventListener('click',confirmSupervisorComplete);
  $('supervisorCancelComplete')?.addEventListener('click',closeSupervisorCompleteModal);
  document.querySelectorAll('[data-close-complete-modal]').forEach(el=>el.addEventListener('click',closeSupervisorCompleteModal));
  renderSupervisorDashboard();
}
