const money = (n) => Number(n || 0).toLocaleString('zh-TW');

function updateQuota() {
  const cms = document.getElementById('cmsSelect').value;
  const identity = document.getElementById('identitySelect').value;
  const quota = cmsLimits[cms];
  const rate = identityRates[identity].rate;
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
        <div><span>第二類自付</span><strong>$${money(item.type2Pay)}</strong></div>
        <div><span>第三類自付</span><strong>$${money(item.type3Pay)}</strong></div>
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

document.addEventListener('DOMContentLoaded', () => {
  updateQuota();
  renderServices();
  document.getElementById('cmsSelect').addEventListener('change', updateQuota);
  document.getElementById('identitySelect').addEventListener('change', updateQuota);
  document.getElementById('serviceSearch').addEventListener('input', renderServices);
  document.getElementById('categoryFilter').addEventListener('change', renderServices);
});
