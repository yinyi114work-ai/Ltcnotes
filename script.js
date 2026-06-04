const $ = (id) => document.getElementById(id);
let lastVisitSections = {};

const visitFieldGroups = {
  physicalFields: [
    ['行走能力',['可獨立行走','使用輔具行走','需他人攙扶','輪椅代步','臥床']],
    ['移位能力',['可獨立移位','需口頭提醒','需部分協助','需完全協助']],
    ['上下樓梯',['可獨立上下樓','需扶手輔助','需他人協助','無法上下樓']],
    ['進食能力',['可自行進食','需備餐協助','需餵食協助','管灌餵食']],
    ['穿脫衣物',['可自行完成','需部分協助','需完全協助']],
    ['沐浴能力',['可自行完成','需部分協助','需完全協助']],
    ['如廁能力',['可自行如廁','需部分協助','需完全協助']],
    ['排尿狀況',['正常','尿失禁','使用尿布','留置導尿管']],
    ['排便狀況',['正常','偶有失禁','長期失禁','造口']],
    ['睡眠狀況',['睡眠良好','偶有失眠','夜間頻繁醒來','日夜顛倒','需安眠藥協助']],
    ['用藥管理',['可自行管理','家屬協助管理','居服員提醒服藥','常忘記服藥','需持續追蹤']],
    ['就醫狀況',['定期回診','近期住院','近期急診','近期病況變化','就醫交通需協助']],
    ['疼痛狀況',['無明顯疼痛','偶有疼痛','長期疼痛','疼痛需追蹤']],
    ['情緒狀況',['穩定','偶有焦慮','偶有憂鬱','易怒','情緒起伏大']],
    ['認知狀況',['意識清楚','記憶力下降','失智症','難以表達需求']],
    ['家庭支持',['家屬支持良好','家屬支持尚可','家屬支持有限','缺乏家庭支持']],
    ['經濟狀況',['穩定','尚可','有經濟壓力','未明確表示']]
  ],
  caregiverFields: [
    ['主要照顧者身分',['配偶','子女','外籍看護工','親友','無固定主要照顧者']],
    ['照顧負荷',['無明顯負荷','偶有壓力','負荷偏高','有喘息需求']],
    ['照顧能力',['照顧能力良好','照顧能力尚可','需加強照顧指導','需資源介入']],
    ['喘息需求',['暫無喘息需求','偶有喘息需求','有明確喘息需求','需持續評估']]
  ],
  serviceUseFields: [
    ['是否依計畫使用',['依計畫穩定使用','部分服務有調整','未依計畫使用','需持續追蹤']],
    ['是否有請假',['無明顯請假','偶有請假','經常請假','需確認原因']],
    ['是否有未使用服務',['無未使用服務','偶有未使用','經常未使用','需與個管討論']],
    ['居服員滿意度',['滿意','尚可','不滿意','需持續追蹤']],
    ['機構滿意度',['滿意','尚可','不滿意','需持續追蹤']],
    ['到班查核',['居服員準時到班','偶有延遲','需持續追蹤到班情形','家屬未反映異常']]
  ]
};

const environmentOptions = ['環境整潔','動線安全','浴室防滑需留意','採光通風良好','有跌倒風險','需輔具評估','需環改評估','暫無新增環境改善需求'];
const incidentOptions = ['跌倒','急診','住院','拒絕服務','家屬抱怨','失智遊走','居服員反映異常','無特殊異常事件'];
const needOptions = ['希望增加服務','希望減少服務','輔具需求','環改需求','喘息需求','短照需求','暫無新增需求'];

function initTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tool-section').forEach(s=>s.classList.remove('active'));
      btn.classList.add('active');
      const target = $(btn.dataset.target);
      if(target) target.classList.add('active');
    });
  });
}

function initQuota(){
  const cms = $('cmsSelect');
  if(!cms) return;
  cms.innerHTML = Object.entries(cmsLevels).map(([level,amount])=>`<option value="${level}">CMS ${level}｜${money(amount)}元</option>`).join('');
  const identities = Object.entries(identityRates).map(([key,obj])=>`<option value="${key}">${obj.label}</option>`).join('');
  $('identitySelect').innerHTML = identities;
  $('feeIdentity').innerHTML = identities;
  $('feeCms').innerHTML = Object.entries(cmsLevels).map(([level,amount])=>`<option value="${level}">CMS ${level}｜${money(amount)}元</option>`).join('');
  cms.addEventListener('change', updateQuota);
  $('identitySelect').addEventListener('change', updateQuota);
  updateQuota();
}

function updateQuota(){
  const quota = cmsLevels[$('cmsSelect').value] || 0;
  const rate = identityRates[$('identitySelect').value].rate;
  const selfPay = Math.floor(quota * rate);
  $('quotaAmount').textContent = money(quota);
  $('selfPayAmount').textContent = money(selfPay);
  $('subsidyAmount').textContent = money(quota - selfPay);
}

function serviceOptionHtml(){
  return serviceData.map(s=>`<option value="${s.code}">${s.code} ${s.name}｜${money(s.price)}元/${s.unit}</option>`).join('');
}

function renderServices(filter=''){
  if(!$('serviceList')) return;
  const q = filter.trim().toLowerCase();
  const list = serviceData.filter(s=>[s.code,s.name,s.category,s.desc,s.note,s.tip || ''].join(' ').toLowerCase().includes(q));
  $('serviceList').innerHTML = list.map(s=>`
    <article class="service-card">
      <h3>${s.code}｜${s.name}</h3>
      <div class="tag-row"><span class="tag">${s.category}</span><span class="tag">${money(s.price)}元／${s.unit}</span></div>
      <div class="mini-table">
        <div class="mini-cell"><span>第一類</span><strong>${money(s.selfPayFirst)}</strong></div>
        <div class="mini-cell"><span>第二類</span><strong>${money(s.selfPaySecond)}</strong></div>
        <div class="mini-cell"><span>第三類</span><strong>${money(s.selfPayThird)}</strong></div>
      </div>
      <p><strong>支付基準摘要：</strong>${s.desc}</p>
      <p><strong>注意事項：</strong>${s.note}</p>
      ${s.tip ? `<div class="supervisor-tip"><strong>☕ 居督碎碎唸：</strong><span>${s.tip}</span></div>` : ''}
      <p><strong>服務計畫：</strong>${s.plan}</p>
    </article>
  `).join('') || '<p class="card">查無符合的碼別。</p>';
}

function initCodeTool(){
  renderServices();
  const search = $('serviceSearch');
  if(search) search.addEventListener('input', e=>renderServices(e.target.value));
}

function addFeeRow(code='BA07', count=1){
  const wrap = document.createElement('div');
  wrap.className = 'fee-row';
  wrap.innerHTML = `
    <label>碼別<select class="fee-code">${serviceOptionHtml()}</select></label>
    <label>每月次數<input class="fee-count" type="number" min="0" step="1" value="${count}"></label>
    <button class="remove-row" type="button">刪除</button>
  `;
  wrap.querySelector('.fee-code').value = code;
  wrap.querySelector('.fee-code').addEventListener('change', updateFee);
  wrap.querySelector('.fee-count').addEventListener('input', updateFee);
  wrap.querySelector('.remove-row').addEventListener('click',()=>{wrap.remove();updateFee();});
  $('feeRows').appendChild(wrap);
  updateFee();
}

function updateFee(){
  const rate = identityRates[$('feeIdentity').value].rate;
  const quota = cmsLevels[$('feeCms').value] || 0;
  let total = 0;
  document.querySelectorAll('.fee-row').forEach(row=>{
    const code = row.querySelector('.fee-code').value;
    const count = Number(row.querySelector('.fee-count').value || 0);
    const service = serviceData.find(s=>s.code===code);
    if(service) total += service.price * count;
  });

  const withinQuota = Math.min(total, quota);
  const overage = Math.max(total - quota, 0);
  const selfPay = Math.floor(withinQuota * rate);
  const clientTotal = selfPay + overage;
  const remain = Math.max(quota - total, 0);

  $('feeTotal').textContent = money(total);
  $('feeQuota').textContent = money(quota);
  $('feeSelfPay').textContent = money(selfPay);
  $('feeOverage').textContent = money(overage);
  $('feeClientTotal').textContent = money(clientTotal);
  $('feeRemain').textContent = money(remain);

  const notice = $('feeNotice');
  $('feeOverage').closest('.result-card').classList.toggle('overage-alert', overage > 0);
  $('feeClientTotal').closest('.result-card').classList.toggle('overage-alert', overage > 0);
  if(overage > 0){
    notice.className = 'notice-card danger';
    notice.textContent = `⚠️ 已超出 CMS 額度 ${money(overage)} 元，超額部分需全額自費；預估自付總額為 ${money(clientTotal)} 元。`;
  }else{
    notice.className = 'notice-card success';
    notice.textContent = `✅ 目前尚未超出 CMS 額度，剩餘額度 ${money(remain)} 元；預估自付總額為 ${money(clientTotal)} 元。`;
  }
}

function initFeeTool(){
  if(!$('addFeeRow')) return;
  $('addFeeRow').addEventListener('click',()=>addFeeRow());
  $('feeIdentity').addEventListener('change',updateFee);
  $('feeCms').addEventListener('change',updateFee);
  addFeeRow('BA07',4);
}

function makeSelect(label, options, id){
  return `<label>${label}<select id="${id}">${options.map(o=>`<option>${o}</option>`).join('')}</select></label>`;
}
function checkHtml(label,id,value=''){
  return `<label class="check-item"><input type="checkbox" id="${id}" value="${value || label}"><span>${label}</span></label>`;
}
function initVisitFields(){
  Object.entries(visitFieldGroups).forEach(([container,fields])=>{
    const el = $(container);
    if(el) el.innerHTML = fields.map(([label,options],idx)=>makeSelect(label,options,`${container}_${idx}`)).join('');
  });
  $('environmentChecks').innerHTML = environmentOptions.map((x,i)=>checkHtml(x,`env_${i}`)).join('');
  $('incidentChecks').innerHTML = incidentOptions.map((x,i)=>checkHtml(x,`inc_${i}`)).join('');
  $('needChecks').innerHTML = needOptions.map((x,i)=>checkHtml(x,`need_${i}`)).join('');
  $('visitServiceChecks').innerHTML = serviceData.map(s=>checkHtml(`${s.code} ${s.name}`,`svc_${s.code}`,s.code)).join('');
  ['BA01','BA07','BA15'].forEach(code=>{ const el = $(`svc_${code}`); if(el) el.checked = true; });
}
function selectedChecks(containerId){
  const el = $(containerId);
  return el ? Array.from(el.querySelectorAll('input:checked')).map(i=>i.value || i.nextElementSibling.textContent.trim()) : [];
}
function getFieldTexts(containerId){
  const el = $(containerId);
  if(!el) return [];
  return Array.from(el.querySelectorAll('label')).map(label=>{
    const name = label.childNodes[0].textContent.trim();
    const value = label.querySelector('select').value;
    return {name,value};
  });
}
function sentenceFromFields(containerId){
  const fields = getFieldTexts(containerId);
  return fields.length ? fields.map(f=>`${f.name}為${f.value}`).join('，') + '。' : '';
}

function makeVisitRecord(){
  const selectedCodes = selectedChecks('visitServiceChecks');
  const services = selectedCodes.map(code=>serviceData.find(s=>s.code===code)).filter(Boolean);
  const env = selectedChecks('environmentChecks');
  const inc = selectedChecks('incidentChecks');
  const needs = selectedChecks('needChecks');

  const healthNote = $('healthNote').value.trim();
  const environmentNote = $('environmentNote').value.trim();
  const extraNote = $('extraNote').value.trim();

  const serviceNames = services.map(s=>`${s.code}${s.name}`).join('、') || '目前未勾選特定服務碼別';
  const goals = [...new Set(services.map(s=>s.goal))];
  const plans = services.map(s=>`${s.code}：${s.plan}`);
  const followups = services.map(s=>s.followup);

  const purpose = $('visitPurpose').value;
  const adjust = $('needAdjust').value;

  const sections = [];
  sections.push(`一、個案狀況評估
本次家訪重點為${purpose}。個案狀況評估如下：${sentenceFromFields('physicalFields')}${healthNote ? '補充說明：' + healthNote + '。' : ''}`);
  sections.push(`二、居住環境與主要照顧者評估
本次訪視評估居住環境：${env.length ? env.join('、') : '未勾選環境項目'}。${environmentNote ? '補充說明：' + environmentNote + '。' : '後續持續留意居家動線及照顧安全。'}
主要照顧者評估：${sentenceFromFields('caregiverFields')}後續持續關注照顧者負荷及照顧資源使用情形。`);
  sections.push(`三、服務使用及執行情形
個案目前使用服務包含：${serviceNames}。${sentenceFromFields('serviceUseFields')}
${followups.join('')}`);
  sections.push(`四、居家服務目標
${goals.length ? goals.map((g,i)=>`${i+1}. ${g}`).join('\n') : '目前未勾選服務碼別，故未自動產生服務目標。'}`);
  sections.push(`五、服務計畫
${plans.length ? plans.map((p,i)=>`${i+1}. ${p}`).join('\n') : '目前未勾選服務碼別，故未自動產生服務計畫。'}`);
  const incidentText = inc.includes('無特殊異常事件') ? '近期無特殊異常事件。' : (inc.length ? `近期需追蹤異常事件包含：${inc.join('、')}。` : '未勾選異常事件。');
  const needText = needs.includes('暫無新增需求') ? '目前暫無新增需求。' : (needs.length ? `目前需求變化包含：${needs.join('、')}。` : '未勾選需求變化。');
  sections.push(`六、異常事件與需求變化
${incidentText}${needText}${adjust !== '暫無調整需求' ? '服務調整評估：' + adjust + '。' : '目前服務安排暫無調整需求。'}`);
  sections.push(`七、家訪結論及後續建議
本次家訪評估個案服務使用情形大致穩定，居服員服務執行狀況將持續依照顧計畫追蹤。後續將持續關注個案身心狀況、居住環境安全、主要照顧者負荷及服務需求變化，必要時再與相關單位討論服務調整。${extraNote ? '\n補充紀錄：' + extraNote : ''}`);

  lastVisitSections = {
    full: sections.join('\n\n'),
    assessment: sections.slice(0,3).join('\n\n'),
    plan: sections.slice(3,5).join('\n\n'),
    conclusion: sections.slice(5,7).join('\n\n')
  };
  $('visitOutput').value = lastVisitSections.full;
}

async function copyText(text, label='內容'){
  if(!text || !text.trim()){
    makeVisitRecord();
    text = lastVisitSections.full || $('visitOutput').value;
  }
  try{
    await navigator.clipboard.writeText(text);
    showToast(`已複製${label}`);
  }catch(err){
    const output = $('visitOutput') || $('mutationOutput');
    if(output){ output.focus(); output.select(); document.execCommand('copy'); }
    showToast(`已複製${label}`);
  }
}
function showToast(message){
  const oldToast = document.querySelector('.copy-toast');
  if(oldToast) oldToast.remove();
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(),1800);
}
function initVisitAccordion(){
  const blocks = Array.from(document.querySelectorAll('#visitTool .visit-block'));
  blocks.forEach(block=>{
    block.addEventListener('toggle',()=>{
      if(block.open) blocks.forEach(other=>{ if(other !== block) other.open = false; });
    });
  });
}
function initVisitTool(){
  if(!$('visitTool')) return;
  initVisitFields();
  initVisitAccordion();
  $('generateVisit').addEventListener('click',makeVisitRecord);
  $('copyVisit').addEventListener('click',()=>{ if(!$('visitOutput').value.trim()) makeVisitRecord(); copyText(lastVisitSections.full || $('visitOutput').value, '完整紀錄'); });
  $('copyPlan').addEventListener('click',()=>{ if(!$('visitOutput').value.trim()) makeVisitRecord(); copyText(lastVisitSections.plan, '服務計畫'); });
  $('copyConclusion').addEventListener('click',()=>{ if(!$('visitOutput').value.trim()) makeVisitRecord(); copyText(lastVisitSections.conclusion, '家訪結論'); });
  $('clearVisit').addEventListener('click',()=>{
    document.querySelectorAll('#visitTool textarea').forEach(t=>t.value='');
    document.querySelectorAll('#visitTool input[type="checkbox"]').forEach(c=>c.checked=false);
    $('visitOutput').value='';
    lastVisitSections = {};
  });
}

// ===== 異動通報產生器 =====
const mutPersonOptions = {
  '個案本人': ['個案本人'],
  '家屬': ['案配偶','案子','案女','案媳','案婿','案孫','案兄弟姊妹','主要照顧者','其他'],
  '專業人員': ['個管師','照專','社工師','護理師','復能治療師','醫師','出院準備個管師','其他'],
  '機構／單位': ['醫院','護理之家','日照中心','居服單位','個管單位','社福單位','其他'],
  '其他': ['其他']
};
function todayStr(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function nowTimeStr(){ const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function rocDate(dateStr){ if(!dateStr) return '○年○月○日'; const [y,m,d] = dateStr.split('-').map(Number); return y&&m&&d ? `${y-1911}年${m}月${d}日` : dateStr; }
function timeText(timeStr){ if(!timeStr) return ''; const [h,m] = timeStr.split(':'); return `${Number(h)}時${m}分`; }
function v(id){ return ($(id)?.value || '').trim(); }
function checkedValues(name){ return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(x=>x.value); }
function checkboxList(name, items){ return `<div class="checkbox-grid">${items.map((x,i)=>`<label class="check-item"><input type="checkbox" name="${name}" value="${x}" ${i===0?'checked':''}><span>${x}</span></label>`).join('')}</div>`; }
function optionList(items){ return items.map(x=>`<option>${x}</option>`).join(''); }
function commonNoticePrefix(){ return `於${rocDate(v('mutDate'))}${timeText(v('mutTime'))}接獲${getMutPersonText()}${v('mutMethod') === '來電' ? '來電' : v('mutMethod')}通知`; }
function getMutPersonText(){
  const type = v('mutPersonType'), detail = v('mutPersonDetail'), other = v('mutPersonOther');
  if(type === '個案本人') return '個案本人';
  if(detail === '其他' || type === '其他') return other || '其他人員';
  return detail || type;
}
function unitSignature(){
  const unit = v('mutUnitName'), name = v('mutContactName'), title = v('mutContactTitle'), phone = v('mutContactPhone');
  const lines = [];
  if(unit) lines.push(unit);
  if(name || title) lines.push(`聯繫人：${name}${name && title ? ' ' : ''}${title}`.trim());
  if(phone) lines.push(`電話：${phone}`);
  return lines.length ? `\n${lines.join('\n')}` : '';
}
function updateMutPersonDetail(){ const type = v('mutPersonType') || '個案本人'; $('mutPersonDetail').innerHTML = optionList(mutPersonOptions[type] || ['其他']); }
function saveMutSettings(){
  localStorage.setItem('ltcLabMutationSettings', JSON.stringify({unit:v('mutUnitName'), name:v('mutContactName'), title:v('mutContactTitle'), phone:v('mutContactPhone')}));
  showToast('已儲存單位資訊');
}
function loadMutSettings(){
  try{
    const data = JSON.parse(localStorage.getItem('ltcLabMutationSettings') || '{}');
    $('mutUnitName').value = data.unit || '';
    $('mutContactName').value = data.name || '';
    $('mutContactTitle').value = data.title || '';
    $('mutContactPhone').value = data.phone || '';
  }catch(e){}
}

function renderMutationSpecific(){
  const type = v('mutType');
  const form = $('mutationSpecificForm');
  const personCard = $('mutPersonCard');
  if(personCard) personCard.style.display = type === 'quota' ? 'none' : '';
  if(!form) return;

  const reasonPause = ['住院','外宿','出國','家屬自行照顧','個案拒絕服務','人力媒合中','個案死亡','其他'];
  const reasonEnd = ['個案死亡','入住機構','轉換服務單位','搬遷外縣市','不符合資格','拒絕服務','其他'];
  const reasonDelay = ['家屬時間無法配合','個案住院','個案失聯','服務區域無人力','指定居服員','持續媒合中','其他'];
  const reasonAdjust = ['個案需求改變','功能退化','功能改善','家屬需求改變','額度不足','其他'];
  const typeAdjust = ['增加服務','減少服務','更換碼別','調整頻率','調整時間'];
  const incidentSvc = ['送醫事件','照顧意外事件','藥物事件','治安事件','傷害事件','公共意外事件','違反專業倫理','其他'];
  const incidentAny = ['家庭暴力事件','性侵害事件','自殺意圖','自傷事件'];
  const harms = ['無受傷害','輕度','中度','重度','極重度','死亡'];
  const missed = ['個案外出','無人應門','個案拒絕服務','家屬取消','臨時就醫','個案失聯','其他'];

  const html = {
    pause: `<div class="card"><h3 class="card-title">暫停服務</h3><div class="grid-2">
      <label>暫停類型<select id="mutPauseKind"><option value="single">單次服務暫停</option><option value="period">期間暫停服務</option></select></label>
      <label>暫停原因<select id="mutPauseReason">${optionList(reasonPause)}</select></label>
      <label class="pause-single-field">暫停日期<input id="mutPauseDate" type="date"></label>
      <label class="pause-period-field">暫停起始日<input id="mutPauseStart" type="date"></label>
      <label class="pause-period-field">預計恢復日（可不填）<input id="mutPauseEnd" type="date"></label>
      <label>補充說明<input id="mutPauseNote" placeholder="例如：當日回診、住院治療、家屬暫自行照顧"></label>
    </div></div>`,
    end: `<div class="card"><h3 class="card-title">結束服務</h3><div class="grid-2">
      <label>結束原因<select id="mutEndReason">${optionList(reasonEnd)}</select></label>
      <label>結束服務日期<input id="mutEndDate" type="date"></label>
      <label>服務紀錄<select id="mutEndRecord"><option>已完成登打</option><option>尚未完成登打</option><option>無服務紀錄需登打</option></select></label>
      <label>預計完成登打日（尚未完成時填）<input id="mutEndRecordDate" type="date"></label>
    </div><p class="small-note">需要個管協助事項</p>${checkboxList('mutEndHelp',['協助結案流程','協助分配額度','協助轉介'])}</div>`,
    first: `<div class="card"><h3 class="card-title">第一次服務進場</h3><div class="grid-2">
      <label>接獲照會日期<input id="mutFirstReferralDate" type="date"></label>
      <label>聯繫日期<input id="mutFirstContactDate" type="date"></label>
      <label>聯繫時間<input id="mutFirstContactTime" type="time"></label>
      <label>預計第一次服務日期<input id="mutFirstServiceDate" type="date"></label>
      <label>預計第一次服務時間<input id="mutFirstServiceTime" type="time"></label>
      <label>補充說明<input id="mutFirstNote" placeholder="可不填"></label>
    </div></div>`,
    delay: `<div class="card"><h3 class="card-title">未能於時效內進場服務</h3><div class="grid-2">
      <label>接獲照會日期<input id="mutDelayReferralDate" type="date"></label>
      <label>無法時效內進場原因<select id="mutDelayReason">${optionList(reasonDelay)}</select></label>
      <label>預計第一次服務日期<input id="mutDelayServiceDate" type="date"></label>
      <label>預計第一次服務時間<input id="mutDelayServiceTime" type="time"></label>
      <label>補充說明<input id="mutDelayNote" placeholder="例如：持續與案家協調服務時間"></label>
    </div></div>`,
    adjust: `<div class="card"><h3 class="card-title">服務型態調整</h3><div class="grid-2">
      <label>調整原因<select id="mutAdjustReason">${optionList(reasonAdjust)}</select></label>
      <label>調整類型<select id="mutAdjustType">${optionList(typeAdjust)}</select></label>
      <label>調整日期<input id="mutAdjustDate" type="date"></label>
      <label>補充說明<input id="mutAdjustNote" placeholder="例如：沐浴需求增加、陪同外出需求減少"></label>
      <label>原核定碼別及支數<input id="mutAdjustOriginal" placeholder="例如：BA07每月8組"></label>
      <label>調整後碼別及支數<input id="mutAdjustNew" placeholder="例如：BA07每月12組"></label>
    </div></div>`,
    quota: `<div class="card"><h3 class="card-title">額度開立回報</h3>
      <p class="hint-text">彙整個案實際服務使用單位，提供個管師協助開立服務額度，以利後續核銷作業。</p>
      <div class="grid-2">
        <label>適用月份<input id="mutQuotaMonth" type="month"></label>
        <label>補充說明<input id="mutQuotaNote" placeholder="可不填，例如：本期服務使用穩定"></label>
      </div>
      <div class="button-row"><button id="addMutQuotaRow" class="secondary-btn" type="button">＋新增碼別</button></div>
      <div id="mutQuotaRows" class="mut-row-list"></div>
      <p id="mutQuotaCalc" class="small-note"></p></div>`,
    incident: `<div class="card"><h3 class="card-title">異常事件通報</h3><div class="grid-2">
      <label>是否為服務期間發生<select id="mutIncidentDuring"><option>是</option><option>否</option></select></label>
      <label>事件類型<select id="mutIncidentType">${optionList(incidentSvc)}</select></label>
      <label>事件發生／發現日期<input id="mutIncidentDate" type="date"></label>
      <label>事件發生／發現時間<input id="mutIncidentTime" type="time"></label>
      <label>發生地點<select id="mutIncidentPlace">${optionList(['案家','案家附近','醫院','社區','其他'])}</select></label>
      <label>發現人<select id="mutIncidentFinder">${optionList(['居服員','居督','家屬','個案','其他'])}</select></label>
      <label>傷害程度<select id="mutIncidentHarm">${optionList(harms)}</select></label>
      <label>導致結果<input id="mutIncidentResult" placeholder="例如：送醫、輕微擦傷、未造成傷害"></label>
    </div><label>事件發生經過<textarea id="mutIncidentProcess" placeholder="請簡要描述事件發生或發現經過"></textarea></label><p class="small-note">後續處置（可複選）</p>${checkboxList('mutIncidentAction',['已通知家屬','已通知個管','已通知照專','已送醫','已通報警政機關','持續追蹤','其他'])}</div>`,
    missed: `<div class="card"><h3 class="card-title">服務未遇</h3><div class="grid-2">
      <label>預計服務日期<input id="mutMissedDate" type="date"></label>
      <label>預計服務時間<input id="mutMissedTime" type="time"></label>
      <label>服務未遇原因<select id="mutMissedReason">${optionList(missed)}</select></label>
      <label>補充說明<input id="mutMissedNote" placeholder="例如：現場無人應門，電話聯繫未果"></label>
    </div></div>`
  }[type] || '';
  form.innerHTML = html;

  if(type === 'pause'){
    const pauseKind = $('mutPauseKind');
    const updatePauseFields = ()=>{
      const isSingle = pauseKind.value === 'single';
      document.querySelectorAll('.pause-single-field').forEach(el=>el.style.display = isSingle ? '' : 'none');
      document.querySelectorAll('.pause-period-field').forEach(el=>el.style.display = isSingle ? 'none' : '');
    };
    pauseKind.addEventListener('change', updatePauseFields);
    updatePauseFields();
  }
  if(type === 'quota'){
    $('addMutQuotaRow').addEventListener('click',()=>addMutQuotaRow());
    addMutQuotaRow('BA07', 1);
  }
  if(type === 'incident'){
    const during = $('mutIncidentDuring');
    const updateIncidentTypes = ()=>{ $('mutIncidentType').innerHTML = optionList(during.value === '是' ? incidentSvc : incidentAny); };
    during.addEventListener('change', updateIncidentTypes);
    updateIncidentTypes();
  }
}

function addMutQuotaRow(code='BA07', count=1){
  const wrap = document.createElement('div');
  wrap.className = 'mut-row';
  wrap.innerHTML = `<label>碼別<select class="mut-quota-code">${serviceOptionHtml()}</select></label><label>單位數<input class="mut-quota-count" type="number" min="0" step="1" value="${count}"></label><button class="remove-row" type="button">刪除</button>`;
  wrap.querySelector('.mut-quota-code').value = code;
  wrap.querySelector('.mut-quota-code').addEventListener('change', updateMutQuotaCalc);
  wrap.querySelector('.mut-quota-count').addEventListener('input', updateMutQuotaCalc);
  wrap.querySelector('.remove-row').addEventListener('click',()=>{wrap.remove();updateMutQuotaCalc();});
  $('mutQuotaRows').appendChild(wrap);
  updateMutQuotaCalc();
}
function getMutQuotaRows(){
  return Array.from(document.querySelectorAll('#mutQuotaRows .mut-row')).map(row=>{
    const code = row.querySelector('.mut-quota-code').value;
    const count = Number(row.querySelector('.mut-quota-count').value || 0);
    const svc = serviceData.find(s=>s.code===code);
    return {code, count, svc, subtotal: svc ? svc.price * count : 0};
  }).filter(x=>x.svc && x.count>0);
}
function updateMutQuotaCalc(){
  if(!$('mutQuotaCalc')) return;
  const rows = getMutQuotaRows();
  const totalUnits = rows.reduce((sum,x)=>sum+x.count,0);
  const totalAmount = rows.reduce((sum,x)=>sum+x.subtotal,0);
  $('mutQuotaCalc').textContent = `總使用單位：${money(totalUnits)}；預估使用金額：${money(totalAmount)}元。`;
}

function generateMutation(){
  const type = v('mutType');
  const prefix = commonNoticePrefix();
  let text = '';
  if(type === 'pause'){
    const note = v('mutPauseNote') ? `，${v('mutPauseNote')}` : '';
    if(v('mutPauseKind') === 'single'){
      text = `${prefix}，因${v('mutPauseReason')}${note}，故${rocDate(v('mutPauseDate'))}單次服務暫停，以上通報。`;
    }else{
      const end = v('mutPauseEnd') ? `，預計暫停至${rocDate(v('mutPauseEnd'))}` : '';
      text = `${prefix}，因${v('mutPauseReason')}${note}，故自${rocDate(v('mutPauseStart'))}起暫停服務${end}，以上通報。`;
    }
  }else if(type === 'end'){
    const record = v('mutEndRecord') === '尚未完成登打' ? `目前服務紀錄尚未完成登打，預計於${rocDate(v('mutEndRecordDate'))}前完成` : (v('mutEndRecord') === '無服務紀錄需登打' ? '本案無服務紀錄需登打' : '目前服務紀錄已完成登打');
    const help = checkedValues('mutEndHelp');
    text = `${prefix}，因${v('mutEndReason')}，故自${rocDate(v('mutEndDate'))}起結束服務。${record}${help.length ? `，並請個管師${help.join('、')}` : ''}，以上通報。`;
  }else if(type === 'first'){
    const note = v('mutFirstNote') ? `，${v('mutFirstNote')}` : '';
    text = `於${rocDate(v('mutFirstReferralDate'))}接獲照會，並於${rocDate(v('mutFirstContactDate'))}${timeText(v('mutFirstContactTime'))}與${getMutPersonText()}聯繫，預計於${rocDate(v('mutFirstServiceDate'))}${timeText(v('mutFirstServiceTime'))}提供第一次服務${note}，以上通報。`;
  }else if(type === 'delay'){
    const note = v('mutDelayNote') ? `，${v('mutDelayNote')}` : '，目前單位持續協調及媒合服務安排';
    text = `於${rocDate(v('mutDelayReferralDate'))}接獲照會，因${v('mutDelayReason')}，故未能於規定時效內提供第一次服務${note}，預計於${rocDate(v('mutDelayServiceDate'))}${timeText(v('mutDelayServiceTime'))}提供第一次服務，以上通報。`;
  }else if(type === 'adjust'){
    const note = v('mutAdjustNote') ? `，${v('mutAdjustNote')}` : '';
    text = `${prefix}，因${v('mutAdjustReason')}${note}，預計自${rocDate(v('mutAdjustDate'))}起${v('mutAdjustType')}。原核定為${v('mutAdjustOriginal') || '未填寫'}，調整後為${v('mutAdjustNew') || '未填寫'}，請個管師協助確認服務需求並調整照顧計畫，以上通報。`;
  }else if(type === 'quota'){
    const rows = getMutQuotaRows();
    const totalUnits = rows.reduce((sum,x)=>sum+x.count,0);
    const totalAmount = rows.reduce((sum,x)=>sum+x.subtotal,0);
    const details = rows.length ? rows.map(x=>`${x.code}${x.svc.name}，共使用${x.count}單位。`).join('\n') : '未填寫碼別及單位數。';
    const note = v('mutQuotaNote') ? `\n補充說明：${v('mutQuotaNote')}。` : '';
    text = `個案實際服務使用情形如下：

${details}

經統計，本期總使用單位為${money(totalUnits)}，預估使用金額為${money(totalAmount)}元。${note}
敬請協助開立服務額度，以利後續核銷作業，謝謝。`;
  }else if(type === 'incident'){
    const actions = checkedValues('mutIncidentAction');
    const during = v('mutIncidentDuring') === '是';
    const auto = during ? '已完成異常事件通報單並送照管中心備查' : '已於照管平台完成異動通報';
    text = `於${rocDate(v('mutIncidentDate'))}${timeText(v('mutIncidentTime'))}，${v('mutIncidentFinder')}發現個案於${v('mutIncidentPlace')}發生${v('mutIncidentType')}。事件經過：${v('mutIncidentProcess') || '未填寫'}。本事件傷害程度為${v('mutIncidentHarm')}，導致結果為${v('mutIncidentResult') || '未填寫'}。後續處置：${actions.length ? actions.join('、') : '未填寫'}，${auto}，以上通報。`;
  }else if(type === 'missed'){
    const note = v('mutMissedNote') ? `，${v('mutMissedNote')}` : '';
    text = `於${rocDate(v('mutMissedDate'))}${timeText(v('mutMissedTime'))}預計進場提供服務，惟因${v('mutMissedReason')}${note}，現場無法提供服務，服務單位已完成相關紀錄，以上通報。`;
  }
  $('mutationOutput').value = text + unitSignature();
}
function clearMutation(){
  document.querySelectorAll('#mutationTool input').forEach(inp=>{
    if(['mutUnitName','mutContactName','mutContactTitle','mutContactPhone'].includes(inp.id)) return;
    if(['date','time','month','number','text'].includes(inp.type)) inp.value = '';
  });
  document.querySelectorAll('#mutationTool textarea').forEach(t=>t.value='');
  $('mutationOutput').value = '';
  $('mutDate').value = todayStr();
  $('mutTime').value = nowTimeStr();
}
function initMutationTool(){
  if(!$('mutationTool')) return;
  loadMutSettings();
  $('mutDate').value = todayStr();
  $('mutTime').value = nowTimeStr();
  updateMutPersonDetail();
  renderMutationSpecific();
  $('mutPersonType').addEventListener('change', updateMutPersonDetail);
  $('mutType').addEventListener('change', renderMutationSpecific);
  $('saveMutSettings').addEventListener('click', saveMutSettings);
  $('generateMutation').addEventListener('click', generateMutation);
  $('copyMutation').addEventListener('click',()=>{ if(!$('mutationOutput').value.trim()) generateMutation(); copyText($('mutationOutput').value, '異動通報'); });
  $('clearMutation').addEventListener('click', clearMutation);
}


// ===== 長照小卡換證檢核器 =====
let lastRenewalText = '';
const CULTURE_CUTOFF_OLD_END = new Date(2024, 5, 2);  // 113/06/02
const CULTURE_CUTOFF_NEW_START = new Date(2024, 5, 3); // 113/06/03
const ONLINE_LIMIT_START = new Date(2026, 6, 1); // 115/07/01

function n(id){ return Number(($(id)?.value || 0)); }
function parseDateInput(id){
  const value = v(id);
  if(!value) return null;
  const [y,m,d] = value.split('-').map(Number);
  if(!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function formatDateTW(date){
  if(!(date instanceof Date) || isNaN(date)) return '未填寫';
  return `${date.getFullYear() - 1911}年${date.getMonth() + 1}月${date.getDate()}日`;
}
function addYears(date, years){
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}
function addMonths(date, months){
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}
function addDays(date, days){
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
function cultureCourseRowHtml(){
  return `<div class="renew-course-row">
    <label>上課日期<input class="culture-date" type="date"></label>
    <label>課程類別<select class="culture-type"><option value="old">舊制／多元文化族群</option><option value="indigenous">原住民族文化敏感度及能力</option><option value="multicultural">多元族群文化敏感度及能力</option></select></label>
    <label>積分<input class="culture-points" type="number" min="0" step="0.5" value="1"></label>
    <button class="remove-row" type="button">刪除</button>
  </div>`;
}
function addCultureCourseRow(){
  const wrap = document.createElement('div');
  wrap.innerHTML = cultureCourseRowHtml();
  const row = wrap.firstElementChild;
  row.querySelector('.remove-row').addEventListener('click',()=>row.remove());
  $('cultureCourseRows').appendChild(row);
}
function getCultureCourses(){
  return Array.from(document.querySelectorAll('#cultureCourseRows .renew-course-row')).map(row=>{
    const dateStr = row.querySelector('.culture-date').value;
    const [y,m,d] = dateStr ? dateStr.split('-').map(Number) : [];
    const date = y && m && d ? new Date(y, m - 1, d) : null;
    return {
      date,
      dateStr,
      type: row.querySelector('.culture-type').value,
      points: Number(row.querySelector('.culture-points').value || 0)
    };
  }).filter(x=>x.date && !isNaN(x.date) && x.points > 0);
}
function buildCardYears(start, end){
  const years = [];
  if(!start || !end || end < start) return years;
  for(let i=0; i<6; i++){
    const yStart = addYears(start, i);
    let yEnd = addDays(addYears(start, i + 1), -1);
    if(yStart > end) break;
    if(yEnd > end) yEnd = new Date(end.getTime());
    years.push({index:i+1, start:yStart, end:yEnd});
  }
  return years;
}
function courseInRange(course, start, end){
  return course.date >= start && course.date <= end;
}
function checkRenewal(){
  const issues = [];
  const okItems = [];
  const cultureIssues = [];
  const start = parseDateInput('renewStart');
  const end = parseDateInput('renewEnd');

  const total = n('renewTotalPoints');
  const online = n('renewOnlinePoints');
  const onlineLimitApplies = !!(end && end >= ONLINE_LIMIT_START);
  const onlineExcess = onlineLimitApplies ? Math.max(online - 80, 0) : 0;
  const countedTotal = Math.max(total - onlineExcess, 0);

  const quality = n('renewQuality');
  const ethics = n('renewEthics');
  const law = n('renewLaw');
  const qelTotal = quality + ethics + law;
  const qelCounted = Math.min(qelTotal, 36);
  const fire = n('renewFire');
  const emergency = n('renewEmergency');
  const infection = n('renewInfection');
  const gender = n('renewGender');
  const requiredTotal = fire + emergency + infection + gender;

  if(!start) issues.push('未填寫小卡生效日。');
  if(!end) issues.push('未填寫小卡到期日。');
  if(start && end && end < start) issues.push('小卡到期日不可早於生效日。');

  if(onlineLimitApplies){
    if(online > 80){
      issues.push(`115/07/01 起網路課程最高採認 80 點；目前填寫 ${online} 點，超過 ${onlineExcess} 點不列計，採計後總積分為 ${countedTotal} 點。`);
    }else{
      okItems.push(`網路課程 ${online} 點，未超過 80 點採認上限。`);
    }
  }

  if(countedTotal >= 120) okItems.push(`六年總積分採計 ${countedTotal} 點，已達 120 點。`);
  else issues.push(`六年總積分採計目前 ${countedTotal} 點，尚缺 ${Math.max(120-countedTotal,0)} 點。`);

  if(quality > 0 && ethics > 0 && law > 0 && qelTotal >= 24){
    okItems.push(`專業品質／倫理／法規合計 ${qelTotal} 點，採計 ${qelCounted} 點，符合至少 24 點且各項不為 0。`);
  }else{
    const missing = [];
    if(quality <= 0) missing.push('專業品質');
    if(ethics <= 0) missing.push('專業倫理');
    if(law <= 0) missing.push('專業法規');
    if(qelTotal < 24) issues.push(`專業品質／倫理／法規合計目前 ${qelTotal} 點，尚缺 ${24-qelTotal} 點。`);
    if(missing.length) issues.push(`${missing.join('、')}目前為 0 點，需至少有積分。`);
  }

  if(fire > 0 && emergency > 0 && infection > 0 && gender > 0 && requiredTotal >= 10){
    okItems.push(`消防／緊急／感染／性別合計 ${requiredTotal} 點，符合至少 10 點且各項不為 0。`);
  }else{
    const missing = [];
    if(fire <= 0) missing.push('消防安全');
    if(emergency <= 0) missing.push('緊急應變');
    if(infection <= 0) missing.push('感染管制');
    if(gender <= 0) missing.push('性別敏感度');
    if(requiredTotal < 10) issues.push(`消防／緊急／感染／性別合計目前 ${requiredTotal} 點，尚缺 ${10-requiredTotal} 點。`);
    if(missing.length) issues.push(`${missing.join('、')}目前為 0 點，需至少完成一堂／有積分。`);
  }

  const courses = getCultureCourses();
  const oldCultureTotal = courses
    .filter(c=>c.type === 'old' && c.date <= CULTURE_CUTOFF_OLD_END)
    .reduce((sum,c)=>sum+c.points,0);
  if(oldCultureTotal >= 2) okItems.push(`113/06/02 以前舊制／多元文化族群課程合計 ${oldCultureTotal} 點，已達 2 點。`);
  else cultureIssues.push(`113/06/02 以前舊制／多元文化族群課程合計 ${oldCultureTotal} 點，尚缺 ${Math.max(2-oldCultureTotal,0)} 點。`);

  const yearLines = [];
  if(start && end && end >= CULTURE_CUTOFF_NEW_START){
    const years = buildCardYears(start, end).filter(y=>y.end >= CULTURE_CUTOFF_NEW_START);
    years.forEach(y=>{
      const checkStart = y.start < CULTURE_CUTOFF_NEW_START ? CULTURE_CUTOFF_NEW_START : y.start;
      const indigenous = courses.filter(c=>c.type === 'indigenous' && courseInRange(c, checkStart, y.end)).reduce((sum,c)=>sum+c.points,0);
      const multicultural = courses.filter(c=>c.type === 'multicultural' && courseInRange(c, checkStart, y.end)).reduce((sum,c)=>sum+c.points,0);
      const line = `第${y.index}年度（${formatDateTW(checkStart)}～${formatDateTW(y.end)}）：原民 ${indigenous} 點／多元 ${multicultural} 點`;
      yearLines.push(`${indigenous >= 1 && multicultural >= 1 ? '✅' : '❌'} ${line}`);
      if(indigenous < 1) cultureIssues.push(`第${y.index}年度缺原住民族文化敏感度及能力 ${1-indigenous} 點。`);
      if(multicultural < 1) cultureIssues.push(`第${y.index}年度缺多元族群文化敏感度及能力 ${1-multicultural} 點。`);
    });
    if(years.length && yearLines.every(line=>line.startsWith('✅'))) okItems.push('113/06/03 以後各小卡年度之原民／多元課程皆已達標。');
  }

  issues.push(...cultureIssues);
  const hasCultureIssue = cultureIssues.length > 0;
  let canApplyDate = '請先填寫小卡到期日';
  if(end){
    canApplyDate = hasCultureIssue ? formatDateTW(addDays(end, 1)) : formatDateTW(addMonths(end, -6));
  }
  const finalOk = issues.length === 0;
  const resultTitle = finalOk ? '✅ 初步符合換證條件' : '⚠️ 尚未符合換證條件';
  const summary = $('renewalSummary');
  summary.className = `renewal-summary ${finalOk ? 'success' : 'danger'}`;
  summary.textContent = `${resultTitle}｜${hasCultureIssue ? '原民／多元未完成者，最快為到期後隔天且補足積分後辦理' : '最早可於 ' + canApplyDate + ' 申請換證'}`;

  const text = `${resultTitle}

一、小卡資料
生效日：${start ? formatDateTW(start) : '未填寫'}
到期日：${end ? formatDateTW(end) : '未填寫'}
${hasCultureIssue ? '最快可辦理時間：' + canApplyDate + '（需補足原民／多元積分後）' : '最早可申請換證日：' + canApplyDate}

二、積分檢核
六年總積分：${total} 點
網路課程積分：${online} 點${onlineLimitApplies ? `（115/07/01 起最高採認 80 點；採計後總積分 ${countedTotal} 點）` : '（未適用115/07/01後80點上限）'}

三、已符合項目
${okItems.length ? okItems.map(x=>'✅ '+x).join('\n') : '尚無完全符合項目。'}

四、待補足／需確認項目
${issues.length ? issues.map(x=>'❌ '+x).join('\n') : '無。'}

五、原民／多元年度檢核
113/06/02以前舊制合計：${oldCultureTotal} 點
${yearLines.length ? yearLines.join('\n') : '此小卡效期未涵蓋 113/06/03 以後，或尚未填寫小卡效期。'}

提醒：本工具僅依輸入資料進行初步檢核，實際積分採認、課程類別歸屬及換證資格，仍以衛福部系統資料及地方主管機關審查結果為準。`;
  lastRenewalText = text;
  $('renewalOutput').value = text;
}
function clearRenewal(){
  document.querySelectorAll('#renewalTool input').forEach(inp=>inp.value='');
  $('cultureCourseRows').innerHTML = '';
  $('renewalOutput').value = '';
  lastRenewalText = '';
  $('renewalSummary').className = 'renewal-summary';
  $('renewalSummary').textContent = '請輸入資料後按下「檢核換證資格」。';
  addCultureCourseRow();
}
async function copyRenewalResult(){
  if(!$('renewalOutput').value.trim()) checkRenewal();
  try{
    await navigator.clipboard.writeText($('renewalOutput').value);
    showToast('已複製檢核結果');
  }catch(err){
    $('renewalOutput').focus();
    $('renewalOutput').select();
    document.execCommand('copy');
    showToast('已複製檢核結果');
  }
}
function initRenewalTool(){
  if(!$('renewalTool')) return;
  $('addCultureCourse').addEventListener('click', addCultureCourseRow);
  $('checkRenewal').addEventListener('click', checkRenewal);
  $('copyRenewal').addEventListener('click', copyRenewalResult);
  $('clearRenewal').addEventListener('click', clearRenewal);
  addCultureCourseRow();
}

window.addEventListener('DOMContentLoaded',()=>{
  initTabs();
  initQuota();
  initCodeTool();
  initFeeTool();
  initVisitTool();
  initMutationTool();
  initRenewalTool();
});
