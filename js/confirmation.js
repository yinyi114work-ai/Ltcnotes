// ===== 服務確認單與每週服務安排 =====
const CONFIRM_SETTINGS_KEY = 'longcareConfirmationSettingsV1';
let confirmationSerial = 0;

function getCurrentFeeServices(){
  return Array.from(document.querySelectorAll('#feeRows .fee-row')).map((row, index)=>{
    const code = row.querySelector('.fee-code')?.value || '';
    const count = Number(row.querySelector('.fee-count')?.value || 0);
    const svc = serviceData.find(item=>item.code === code);
    return svc ? {index, code, count, svc} : null;
  }).filter(Boolean);
}

function saveConfirmationSettings(){
  const data = {
    unit: v('confirmUnitName'),
    supervisor: v('confirmSupervisorName'),
    phone: v('confirmPhone'),
    email: v('confirmEmail')
  };
  localStorage.setItem(CONFIRM_SETTINGS_KEY, JSON.stringify(data));
  showToast('已儲存居家單位資訊');
}

function loadConfirmationSettings(){
  try{
    const data = JSON.parse(localStorage.getItem(CONFIRM_SETTINGS_KEY) || '{}');
    if($('confirmUnitName')) $('confirmUnitName').value = data.unit || '';
    if($('confirmSupervisorName')) $('confirmSupervisorName').value = data.supervisor || '';
    if($('confirmPhone')) $('confirmPhone').value = data.phone || '';
    if($('confirmEmail')) $('confirmEmail').value = data.email || '';
  }catch(err){
    console.warn('讀取服務確認單設定失敗', err);
  }
}

function scheduleServiceOptionsHtml(selectedCodes = []){
  const services = getCurrentFeeServices();
  if(!services.length){
    return '<p class="schedule-empty-service">請先在上方新增服務碼別。</p>';
  }
  return services.map(({code, svc})=>`
    <label class="schedule-service-option">
      <input type="checkbox" value="${code}" ${selectedCodes.includes(code) ? 'checked' : ''}>
      <span>${code} ${svc.name}</span>
    </label>
  `).join('');
}

function addScheduleRow(data = {}){
  const row = document.createElement('div');
  row.className = 'schedule-row';
  row.innerHTML = `
    <div class="schedule-days" aria-label="服務頻率">
      ${['一','二','三','四','五','六','日'].map((day, idx)=>`
        <label class="day-check">
          <input type="checkbox" value="${idx + 1}" ${(data.days || []).includes(idx + 1) ? 'checked' : ''}>
          <span>週${day}</span>
        </label>
      `).join('')}
    </div>
    <div class="schedule-time-fields">
      <label>開始時間<input class="schedule-start" type="time" value="${data.start || ''}"></label>
      <span class="time-separator">至</span>
      <label>結束時間<input class="schedule-end" type="time" value="${data.end || ''}"></label>
    </div>
    <div>
      <div class="schedule-label">服務項目</div>
      <div class="schedule-service-options">${scheduleServiceOptionsHtml(data.codes || [])}</div>
    </div>
    <button class="remove-row schedule-remove" type="button">刪除此時段</button>
  `;
  row.querySelector('.schedule-remove').addEventListener('click', ()=>row.remove());
  $('scheduleRows').prepend(row);
}

function refreshScheduleServiceOptions(){
  document.querySelectorAll('#scheduleRows .schedule-row').forEach(row=>{
    const selected = Array.from(row.querySelectorAll('.schedule-service-options input:checked')).map(x=>x.value);
    row.querySelector('.schedule-service-options').innerHTML = scheduleServiceOptionsHtml(selected);
  });
}

function getScheduleData(){
  return Array.from(document.querySelectorAll('#scheduleRows .schedule-row')).map(row=>{
    const days = Array.from(row.querySelectorAll('.schedule-days input:checked')).map(x=>Number(x.value)).sort((a,b)=>a-b);
    const codes = Array.from(row.querySelectorAll('.schedule-service-options input:checked')).map(x=>x.value);
    return {
      days,
      start: row.querySelector('.schedule-start')?.value || '',
      end: row.querySelector('.schedule-end')?.value || '',
      codes
    };
  }).filter(item=>item.days.length || item.start || item.end || item.codes.length);
}

function formatWeekdays(days){
  const names = {1:'週一',2:'週二',3:'週三',4:'週四',5:'週五',6:'週六',7:'週日'};
  if(!days.length) return '未填寫';
  const sorted = [...new Set(days)].sort((a,b)=>a-b);
  if(sorted.length === 7) return '每日';
  const consecutive = sorted.every((day, idx)=>idx === 0 || day === sorted[idx-1] + 1);
  if(consecutive && sorted.length >= 3){
    return `${names[sorted[0]]}至${names[sorted[sorted.length-1]]}`;
  }
  return sorted.map(day=>names[day]).join('、');
}

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function makeConfirmationNumber(){
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  confirmationSerial = (confirmationSerial + 1) % 1000;
  return `SC-${date}-${String(confirmationSerial || 1).padStart(3,'0')}`;
}

function buildConfirmationDocument(){
  const feeServices = getCurrentFeeServices();
  if(!feeServices.length){
    showToast('請先新增至少一項服務碼別');
    return false;
  }

  const rate = identityRates[$('feeIdentity').value]?.rate || 0;
  const quota = cmsLevels[$('feeCms').value] || 0;
  let total = 0;

  const serviceRows = feeServices.map(({code, count, svc})=>{
    const subtotal = svc.price * count;
    const selfPay = Math.floor(Math.min(subtotal, Math.max(quota - total, 0)) * rate);
    total += subtotal;
    return `
      <tr>
        <td>${escapeHtml(code)}</td>
        <td class="text-left">${escapeHtml(svc.name)}</td>
        <td>${money(svc.price)}</td>
        <td>${money(count)}</td>
        <td>${money(subtotal)}</td>
        <td>${money(selfPay)}</td>
      </tr>`;
  }).join('');

  const withinQuota = Math.min(total, quota);
  const overage = Math.max(total - quota, 0);
  const selfPay = Math.floor(withinQuota * rate);
  const clientTotal = selfPay + overage;
  const remain = Math.max(quota - total, 0);

  const schedules = getScheduleData();
  const scheduleRows = schedules.length ? schedules.map(item=>`
    <tr>
      <td>${escapeHtml(formatWeekdays(item.days))}</td>
      <td>${escapeHtml(item.start && item.end ? `${item.start}-${item.end}` : (item.start || item.end || '未填寫'))}</td>
      <td class="text-left">${escapeHtml(item.codes.length ? item.codes.join('＋') : '未填寫')}</td>
    </tr>
  `).join('') : `
    <tr class="blank-schedule-row">
      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
    </tr>
    <tr class="blank-schedule-row">
      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
    </tr>`;

  const cmsText = `CMS ${$('feeCms').value}`;
  const identityText = identityRates[$('feeIdentity').value]?.label || '';
  const now = new Date();
  const createdText = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  $('confirmationDocument').innerHTML = `
    <header class="confirm-doc-header">
      <img src="logo.png" alt="Longcare.Notes 長照研究室 Logo" class="confirm-doc-logo">
      <div class="confirm-doc-heading">
        <h1>長照服務內容及費用預估確認單</h1>
        <p>Longcare.Notes｜長照研究室公益工具</p>
      </div>
      <div class="confirm-doc-meta">
        <div>編號：${makeConfirmationNumber()}</div>
        <div>建立：${createdText}</div>
      </div>
    </header>

    <section class="confirm-info-grid">
      <div><strong>個案姓名／代號</strong><span>${escapeHtml(v('confirmClientName') || '________________')}</span></div>
      <div><strong>確認單類型</strong><span>${escapeHtml(v('confirmVersionType'))}</span></div>
      <div><strong>CMS 等級</strong><span>${escapeHtml(cmsText)}</span></div>
      <div><strong>身分類別</strong><span>${escapeHtml(identityText)}</span></div>
      <div><strong>服務期間</strong><span>${escapeHtml(v('confirmStartDate') || '____/__/__')} 至 ${escapeHtml(v('confirmEndDate') || '____/__/__')}</span></div>
      <div><strong>居家服務單位</strong><span>${escapeHtml(v('confirmUnitName') || '________________')}</span></div>
      <div><strong>居家督導員</strong><span>${escapeHtml(v('confirmSupervisorName') || '________________')}</span></div>
      <div><strong>聯絡資訊</strong><span>${escapeHtml([v('confirmPhone'), v('confirmEmail')].filter(Boolean).join('／') || '________________')}</span></div>
    </section>

    <h2 class="confirm-section-title">一、每月服務內容與費用預估</h2>
    <table class="confirm-table">
      <thead><tr><th>碼別</th><th>服務項目</th><th>單價</th><th>預計次數</th><th>預估使用額度</th><th>預估部分負擔</th></tr></thead>
      <tbody>${serviceRows}</tbody>
    </table>

    <section class="confirm-summary-grid">
      <div><span>CMS 可用額度</span><strong>NT$ ${money(quota)}</strong></div>
      <div><span>預估使用額度</span><strong>NT$ ${money(total)}</strong></div>
      <div><span>預估剩餘額度</span><strong>NT$ ${money(remain)}</strong></div>
      <div><span>額度內部分負擔</span><strong>NT$ ${money(selfPay)}</strong></div>
      <div><span>超額自費</span><strong>NT$ ${money(overage)}</strong></div>
      <div class="confirm-total"><span>預估自付總額</span><strong>NT$ ${money(clientTotal)}</strong></div>
    </section>

    <h2 class="confirm-section-title">二、每週預計服務安排</h2>
    <table class="confirm-table schedule-confirm-table">
      <thead><tr><th>服務頻率</th><th>服務時間</th><th>服務項目</th></tr></thead>
      <tbody>${scheduleRows}</tbody>
    </table>

    <section class="confirm-notes">
      <strong>說明：</strong>
      <ol>
        <li>本確認單依目前服務規劃及使用者輸入內容進行費用預估。</li>
        <li>實際服務內容、次數及費用，仍依核定照顧計畫、當月實際服務紀錄及最新規定計算。</li>
        <li>服務時段得依個案需求、居服員排班及雙方協議調整。</li>
      </ol>
    </section>

    <section class="confirm-signatures">
      <div><span>個案／家屬簽名</span><b></b></div>
      <div><span>居家督導員簽名</span><b></b></div>
      <div><span>確認日期</span><b>　　　年　　　月　　　日</b></div>
    </section>

    <footer class="confirm-doc-footer">
      <img src="logo.png" alt="" class="confirm-footer-logo">
      <div>
        <strong>Longcare.Notes｜長照研究室</strong>
        <span>本文件由公益工具於使用者裝置本機產生，不會上傳個案資料，亦不使用 AI API。</span>
      </div>
    </footer>
  `;
  return true;
}

function openConfirmationPreview(){
  if(!buildConfirmationDocument()) return;
  const section = $('confirmationPreviewSection');
  section.classList.add('active');
  section.setAttribute('aria-hidden','false');
  section.scrollIntoView({behavior:'smooth', block:'start'});
}

function closeConfirmationPreview(){
  const section = $('confirmationPreviewSection');
  section.classList.remove('active');
  section.setAttribute('aria-hidden','true');
}

function printConfirmation(){
  if(!$('confirmationPreviewSection').classList.contains('active')){
    if(!buildConfirmationDocument()) return;
    $('confirmationPreviewSection').classList.add('active');
  }
  document.body.classList.add('printing-confirmation');
  window.print();
  setTimeout(()=>document.body.classList.remove('printing-confirmation'), 500);
}

function initConfirmationTool(){
  if(!$('scheduleRows')) return;
  loadConfirmationSettings();

  const today = todayStr();
  if($('confirmStartDate') && !$('confirmStartDate').value) $('confirmStartDate').value = today;

  $('saveConfirmSettings')?.addEventListener('click', saveConfirmationSettings);
  $('addScheduleRow')?.addEventListener('click', ()=>addScheduleRow());
  $('previewConfirmation')?.addEventListener('click', openConfirmationPreview);
  $('printConfirmation')?.addEventListener('click', printConfirmation);
  $('closeConfirmationPreview')?.addEventListener('click', closeConfirmationPreview);
  $('printConfirmationFromPreview')?.addEventListener('click', printConfirmation);

  addScheduleRow();
}
