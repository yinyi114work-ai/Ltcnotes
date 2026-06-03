const money = (n) => Number(n || 0).toLocaleString('zh-TW');
const billableServices = () => serviceData.filter(item => ['BA 居家服務', 'GA 喘息'].includes(item.category));
const visitServices = () => serviceData.filter(item => ['BA 居家服務', 'GA 喘息'].includes(item.category));

function getRate(identityKey) {
  return identityRates[identityKey]?.rate ?? 0;
}

function selfPayOf(item, rate) {
  if (item.freeCopay) return 0;
  return Math.floor(item.price * rate);
}

function updateQuota() {
  const cms = document.getElementById('cmsSelect').value;
  const identity = document.getElementById('identitySelect').value;
  const quota = cmsLimits[cms];
  const rate = getRate(identity);
  const copay = Math.floor(quota * rate);
  const subsidy = quota - copay;
  document.getElementById('quotaAmount').textContent = `$${money(quota)}`;
  document.getElementById('copayAmount').textContent = `$${money(copay)}`;
  document.getElementById('subsidyAmount').textContent = `$${money(subsidy)}`;
}

function renderServices() {
  const keyword = document.getElementById('serviceSearch').value.trim().toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const list = document.getElementById('serviceList');
  const filtered = serviceData.filter(item => {
    const text = `${item.code} ${item.name} ${item.summary} ${(item.notes || []).join(' ')}`.toLowerCase();
    const categoryOk = category === 'all' || item.category === category;
    return categoryOk && (!keyword || text.includes(keyword));
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="empty">找不到符合的碼別</div>';
    return;
  }

  list.innerHTML = filtered.map(item => `
    <article class="service-card">
      <div class="service-head">
        <div><span class="code">${item.code}</span><h3>${item.name}</h3></div>
        <span class="tag">${item.category}</span>
      </div>
      <p class="summary">${item.summary}</p>
      <div class="fee-grid">
        <div><span>給付價格</span><strong>$${money(item.price)}</strong></div>
        <div><span>第二類自付</span><strong>${item.freeCopay ? '免部分負擔' : '$' + money(item.type2Pay)}</strong></div>
        <div><span>第三類自付</span><strong>${item.freeCopay ? '免部分負擔' : '$' + money(item.type3Pay)}</strong></div>
      </div>
      <details>
        <summary>服務注意事項</summary>
        <ul>${(item.notes || []).map(n => `<li>${n}</li>`).join('')}</ul>
      </details>
      <details>
        <summary>家訪服務計畫文字</summary>
        <p>${item.plan || ''}</p>
      </details>
    </article>
  `).join('');
}

function serviceOptions(selectedCode = '') {
  return billableServices().map(item => `<option value="${item.code}" ${item.code === selectedCode ? 'selected' : ''}>${item.code}｜${item.name}｜$${money(item.price)}</option>`).join('');
}

function addFeeRow(selectedCode = '', times = 1) {
  const wrap = document.getElementById('feeRows');
  const row = document.createElement('div');
  row.className = 'fee-row';
  row.innerHTML = `
    <select class="fee-code">${serviceOptions(selectedCode)}</select>
    <input class="fee-times" type="number" min="0" step="1" value="${times}" aria-label="次數" />
    <button type="button" class="ghost remove-row">刪除</button>
  `;
  wrap.appendChild(row);
  row.querySelector('.fee-code').addEventListener('change', updateFeeEstimate);
  row.querySelector('.fee-times').addEventListener('input', updateFeeEstimate);
  row.querySelector('.remove-row').addEventListener('click', () => { row.remove(); updateFeeEstimate(); });
  updateFeeEstimate();
}

function updateFeeEstimate() {
  const rate = getRate(document.getElementById('feeIdentity').value);
  const rows = [...document.querySelectorAll('.fee-row')];
  let totalPrice = 0;
  let totalCopay = 0;
  const details = [];

  rows.forEach(row => {
    const code = row.querySelector('.fee-code').value;
    const times = Number(row.querySelector('.fee-times').value || 0);
    const item = serviceData.find(s => s.code === code);
    if (!item || times <= 0) return;
    const priceSubtotal = item.price * times;
    const copayEach = selfPayOf(item, rate);
    const copaySubtotal = copayEach * times;
    totalPrice += priceSubtotal;
    totalCopay += copaySubtotal;
    details.push({ item, times, priceSubtotal, copayEach, copaySubtotal });
  });

  document.getElementById('feeTotalPrice').textContent = `$${money(totalPrice)}`;
  document.getElementById('feeTotalCopay').textContent = `$${money(totalCopay)}`;
  document.getElementById('feeTotalSubsidy').textContent = `$${money(totalPrice - totalCopay)}`;

  document.getElementById('feeDetail').innerHTML = details.length ? `
    <div class="detail-table">
      <div class="detail-head"><span>碼別</span><span>次數</span><span>自付小計</span></div>
      ${details.map(d => `<div><span>${d.item.code} ${d.item.name}<small>每次自付 $${money(d.copayEach)}</small></span><span>${d.times}</span><span>$${money(d.copaySubtotal)}</span></div>`).join('')}
    </div>
  ` : '<div class="empty">請新增碼別與次數</div>';
}

function renderVisitChecks() {
  const keyword = document.getElementById('visitServiceSearch').value.trim().toLowerCase();
  const selected = new Set([...document.querySelectorAll('.visit-check:checked')].map(el => el.value));
  const list = document.getElementById('visitServiceChecks');
  const filtered = visitServices().filter(item => {
    const text = `${item.code} ${item.name} ${item.summary}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });
  list.innerHTML = filtered.map(item => `
    <label class="check-item">
      <input class="visit-check" type="checkbox" value="${item.code}" ${selected.has(item.code) ? 'checked' : ''} />
      <span><strong>${item.code}</strong> ${item.name}</span>
    </label>
  `).join('');
}

function val(id) {
  return document.getElementById(id).value.trim();
}

function generateVisitRecord() {
  const selectedCodes = [...document.querySelectorAll('.visit-check:checked')].map(el => el.value);
  const selectedItems = selectedCodes.map(code => serviceData.find(s => s.code === code)).filter(Boolean);
  const serviceNames = selectedItems.map(i => `${i.code}${i.name}`).join('、');
  const plans = selectedItems.map(i => `（${i.code}）${i.plan}`).join('\n');
  const goals = buildGoals(selectedItems);

  const paragraphs = [];
  paragraphs.push(`本次家訪評估個案身心靈及社會支持狀況：${val('caseBio') || '個案目前整體狀況尚穩定，能依自身能力表達需求，情緒反應尚可。'}`);
  paragraphs.push(`居住環境評估：${val('caseEnv') || '居家環境大致整潔，主要生活動線尚可，已提醒維持環境安全及減少跌倒風險。'}`);
  paragraphs.push(`主要照顧者負荷評估：${val('caregiverLoad') || '主要照顧者目前可提供基本照顧支持，惟仍需長照服務協助分擔照顧壓力。'}`);
  if (val('visitOther')) paragraphs.push(`其他補充：${val('visitOther')}`);
  paragraphs.push(`目前開立服務碼別：${serviceNames || '尚未勾選服務碼別'}。`);
  paragraphs.push(`居家服務目標：${goals}`);
  paragraphs.push(`服務計畫：\n${plans || '請先勾選開立碼別，系統將自動帶入服務計畫文字。'}`);
  paragraphs.push(`居服員到班查核：經查核居服員${document.getElementById('attendanceStatus').value}，服務執行情形${document.getElementById('executionStatus').value}，${document.getElementById('satisfactionStatus').value}。後續將持續追蹤服務品質，並依個案需求與照顧計畫內容適時調整。`);

  document.getElementById('visitOutput').value = paragraphs.join('\n\n');
}

function buildGoals(items) {
  const goals = new Set();
  items.forEach(item => {
    if (['BA01','BA07','BA23','BA24'].includes(item.code)) goals.add('維持個案個人衛生、身體舒適及清潔照顧安全');
    if (['BA02','BA10','BA11','BA12','BA13','BA14','BA18','BA20'].includes(item.code)) goals.add('維持個案日常生活功能、活動參與及照顧安全');
    if (['BA04','BA05'].includes(item.code)) goals.add('維持個案飲食照顧與營養攝取安全');
    if (['BA15','BA16'].includes(item.code)) goals.add('維持居家生活基本需求與環境整潔');
    if (item.code.startsWith('BA17') || item.code === 'BA03') goals.add('協助健康監測及特殊照顧需求，異常時即時回報');
    if (item.code === 'GA09') goals.add('提供家庭照顧者喘息支持，減輕照顧負荷');
  });
  if (!goals.size) goals.add('維持個案生活品質與照顧安全，並減輕主要照顧者負荷');
  return [...goals].join('；') + '。';
}

async function copyVisitText() {
  const text = document.getElementById('visitOutput').value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    alert('已複製家訪紀錄文字');
  } catch (e) {
    alert('無法自動複製，請手動全選複製。');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateQuota();
  renderServices();
  addFeeRow('BA07', 4);
  addFeeRow('BA15', 8);
  renderVisitChecks();

  document.getElementById('cmsSelect').addEventListener('change', updateQuota);
  document.getElementById('identitySelect').addEventListener('change', updateQuota);
  document.getElementById('serviceSearch').addEventListener('input', renderServices);
  document.getElementById('categoryFilter').addEventListener('change', renderServices);
  document.getElementById('feeIdentity').addEventListener('change', updateFeeEstimate);
  document.getElementById('addFeeRow').addEventListener('click', () => addFeeRow());
  document.getElementById('clearFeeRows').addEventListener('click', () => { document.getElementById('feeRows').innerHTML = ''; updateFeeEstimate(); });
  document.getElementById('visitServiceSearch').addEventListener('input', renderVisitChecks);
  document.getElementById('clearVisitChecks').addEventListener('click', () => { document.querySelectorAll('.visit-check').forEach(el => el.checked = false); });
  document.getElementById('generateVisit').addEventListener('click', generateVisitRecord);
  document.getElementById('copyVisit').addEventListener('click', copyVisitText);
});
