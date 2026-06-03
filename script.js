const $ = (id) => document.getElementById(id);

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
    ['疼痛狀況',['無明顯疼痛','偶有疼痛','長期疼痛','疼痛需追蹤']]
  ],
  psychFields: [
    ['情緒狀況',['穩定','偶有焦慮','偶有憂鬱','易怒','情緒起伏大']],
    ['服務接受度',['願意接受服務','偶有拒絕','經常拒絕','需持續建立關係']],
    ['認知狀況',['意識清楚','記憶力下降','失智症','難以表達需求']]
  ],
  spiritualFields: [
    ['生活滿意度',['滿意目前生活','尚可','不滿意','未明確表達']],
    ['信仰支持',['有固定信仰','偶爾參與宗教活動','無特殊信仰','未提及']],
    ['生活目標感',['對生活有期待','尚可','較缺乏動力','需持續關注']]
  ],
  socialFields: [
    ['家庭支持',['家屬支持良好','家屬支持尚可','家屬支持有限','缺乏家庭支持']],
    ['社區參與',['有參與據點','有參與活動','少有外出','幾乎無社會參與']],
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
      $(btn.dataset.target).classList.add('active');
    });
  });
}

function initQuota(){
  const cms = $('cmsSelect');
  cms.innerHTML = Object.entries(cmsLevels).map(([level,amount])=>`<option value="${level}">CMS ${level}｜${money(amount)}元</option>`).join('');
  const identities = Object.entries(identityRates).map(([key,obj])=>`<option value="${key}">${obj.label}</option>`).join('');
  $('identitySelect').innerHTML = identities;
  $('feeIdentity').innerHTML = identities;
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
  const q = filter.trim().toLowerCase();
  const list = serviceData.filter(s=>[s.code,s.name,s.category,s.desc,s.note].join(' ').toLowerCase().includes(q));
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
      <p><strong>服務計畫：</strong>${s.plan}</p>
    </article>
  `).join('') || '<p class="card">查無符合的碼別。</p>';
}

function initCodeTool(){
  renderServices();
  $('serviceSearch').addEventListener('input', e=>renderServices(e.target.value));
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
  let total=0,self=0;
  document.querySelectorAll('.fee-row').forEach(row=>{
    const code = row.querySelector('.fee-code').value;
    const count = Number(row.querySelector('.fee-count').value || 0);
    const service = serviceData.find(s=>s.code===code);
    if(service){
      const subtotal = service.price * count;
      total += subtotal;
      self += Math.floor(service.price * rate) * count;
    }
  });
  $('feeTotal').textContent = money(total);
  $('feeSelfPay').textContent = money(self);
  $('feeSubsidy').textContent = money(total-self);
}

function initFeeTool(){
  $('addFeeRow').addEventListener('click',()=>addFeeRow());
  $('feeIdentity').addEventListener('change',updateFee);
  addFeeRow('BA07',4);
}

function makeSelect(label, options, id){
  return `<label>${label}<select id="${id}">${options.map(o=>`<option>${o}</option>`).join('')}</select></label>`;
}

function initVisitFields(){
  Object.entries(visitFieldGroups).forEach(([container,fields])=>{
    $(container).innerHTML = fields.map(([label,options],idx)=>makeSelect(label,options,`${container}_${idx}`)).join('');
  });
  $('environmentChecks').innerHTML = environmentOptions.map((x,i)=>checkHtml(x,`env_${i}`)).join('');
  $('incidentChecks').innerHTML = incidentOptions.map((x,i)=>checkHtml(x,`inc_${i}`)).join('');
  $('needChecks').innerHTML = needOptions.map((x,i)=>checkHtml(x,`need_${i}`)).join('');
  $('visitServiceChecks').innerHTML = serviceData.map(s=>checkHtml(`${s.code} ${s.name}`,`svc_${s.code}`,s.code)).join('');
  ['BA01','BA07','BA15'].forEach(code=>{ const el = $(`svc_${code}`); if(el) el.checked = true; });
}

function checkHtml(label,id,value=''){
  return `<label class="check-item"><input type="checkbox" id="${id}" value="${value || label}"><span>${label}</span></label>`;
}

function selectedChecks(containerId){
  return Array.from($(containerId).querySelectorAll('input:checked')).map(i=>i.value || i.nextElementSibling.textContent.trim());
}

function getFieldTexts(containerId){
  return Array.from($(containerId).querySelectorAll('label')).map(label=>{
    const name = label.childNodes[0].textContent.trim();
    const value = label.querySelector('select').value;
    return {name,value};
  });
}

function sentenceFromFields(containerId){
  const fields = getFieldTexts(containerId);
  return fields.map(f=>`${f.name}為${f.value}`).join('，') + '。';
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
  sections.push(`一、個案身心靈社會狀況\n本次家訪重點為${purpose}。個案身體及健康功能評估如下：${sentenceFromFields('physicalFields')}${healthNote ? '補充說明：' + healthNote + '。' : ''}\n心理狀況：${sentenceFromFields('psychFields')}靈性狀況：${sentenceFromFields('spiritualFields')}社會支持：${sentenceFromFields('socialFields')}`);
  sections.push(`二、居住環境評估\n本次訪視評估居住環境：${env.length ? env.join('、') : '未勾選環境項目'}。${environmentNote ? '補充說明：' + environmentNote + '。' : '後續持續留意居家動線及照顧安全。'}`);
  sections.push(`三、主要照顧者評估\n${sentenceFromFields('caregiverFields')}後續持續關注主要照顧者負荷及照顧資源使用情形。`);
  sections.push(`四、服務使用及執行情形\n個案目前使用服務包含：${serviceNames}。${sentenceFromFields('serviceUseFields')}\n${followups.join('')}`);
  sections.push(`五、居家服務目標\n${goals.length ? goals.map((g,i)=>`${i+1}. ${g}`).join('\n') : '目前未勾選服務碼別，故未自動產生服務目標。'}`);
  sections.push(`六、服務計畫\n${plans.length ? plans.map((p,i)=>`${i+1}. ${p}`).join('\n') : '目前未勾選服務碼別，故未自動產生服務計畫。'}`);
  const incidentText = inc.includes('無特殊異常事件') ? '近期無特殊異常事件。' : (inc.length ? `近期需追蹤異常事件包含：${inc.join('、')}。` : '未勾選異常事件。');
  const needText = needs.includes('暫無新增需求') ? '目前暫無新增需求。' : (needs.length ? `目前需求變化包含：${needs.join('、')}。` : '未勾選需求變化。');
  sections.push(`七、異常事件與需求變化\n${incidentText}${needText}${adjust !== '暫無調整需求' ? '服務調整評估：' + adjust + '。' : '目前服務安排暫無調整需求。'}`);
  sections.push(`八、家訪結論及後續建議\n本次家訪評估個案服務使用情形大致穩定，居服員服務執行狀況將持續依照顧計畫追蹤。後續將持續關注個案身心狀況、居住環境安全、主要照顧者負荷及服務需求變化，必要時再與個管或相關單位討論服務調整。${extraNote ? '\n補充紀錄：' + extraNote : ''}`);

  $('visitOutput').value = sections.join('\n\n');
}

function initVisitTool(){
  initVisitFields();
  $('generateVisit').addEventListener('click',makeVisitRecord);
  $('copyVisit').addEventListener('click',async()=>{
    if(!$('visitOutput').value.trim()) makeVisitRecord();
    await navigator.clipboard.writeText($('visitOutput').value);
    alert('已複製家訪紀錄');
  });
  $('clearVisit').addEventListener('click',()=>{
    document.querySelectorAll('#visitTool textarea').forEach(t=>t.value='');
    document.querySelectorAll('#visitTool input[type="checkbox"]').forEach(c=>c.checked=false);
    $('visitOutput').value='';
  });
}

window.addEventListener('DOMContentLoaded',()=>{
  initTabs();
  initQuota();
  initCodeTool();
  initFeeTool();
  initVisitTool();
});
