// publish.js - دوال النشر وإدارة النوافذ (بدون مفاتيح)
// يفترض وجود BLOGGER_CONFIG مُعرّف في النطاق العام
// مثال:
// const BLOGGER_CONFIG = { BLOG_ID: "...", API_KEY: "...", CLIENT_ID: "...", CLIENT_SECRET: "...", REFRESH_TOKEN: "..." };

let currentAccessToken = null;
let tokenExpiryTime = 0;

async function refreshAccessToken() {
  modweebShowStatus("🔄 جاري تجديد الصلاحية تلقائياً", 2000);
  const e = new URLSearchParams();
  e.append("client_id", BLOGGER_CONFIG.CLIENT_ID);
  e.append("client_secret", BLOGGER_CONFIG.CLIENT_SECRET);
  e.append("refresh_token", BLOGGER_CONFIG.REFRESH_TOKEN);
  e.append("grant_type", "refresh_token");
  try {
    const t = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: e
    });
    const n = await t.json();
    if (n.access_token) {
      currentAccessToken = n.access_token;
      tokenExpiryTime = Date.now() + (n.expires_in - 30) * 1000;
      modweebShowStatus("✅ الصلاحية جاهزة", 1000);
      return true;
    }
    modweebShowStatus("❌ فشل التجديد: " + (n.error_description || "بيانات غير صحيحة"), 4000);
    return false;
  } catch (o) {
    modweebShowStatus("❌ خطأ في الاتصال", 3000);
    return false;
  }
}

async function getValidAccessToken() {
  if (currentAccessToken && Date.now() < tokenExpiryTime) return currentAccessToken;
  return (await refreshAccessToken()) ? currentAccessToken : null;
}

// ===== إدارة النوافذ السفلية =====
function openSheet(sheetId) {
  closeAllSheets();
  const ov = document.getElementById('genericOverlay');
  const sh = document.getElementById(sheetId);
  if (ov) ov.classList.add('active');
  if (sh) sh.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeSheet(sheetId) {
  const sh = document.getElementById(sheetId);
  if (sh) sh.classList.remove('show');
  const ov = document.getElementById('genericOverlay');
  if (ov) ov.classList.remove('active');
  document.body.style.overflow = '';
}
function closeAllSheets() {
  document.querySelectorAll('.ai-bottom-sheet.show').forEach(s => s.classList.remove('show'));
  const ov = document.getElementById('genericOverlay');
  if (ov) ov.classList.remove('active');
  document.body.style.overflow = '';
}

// ===== فتح نافذة النشر =====
function toggleBloggerSection() {
  openSheet('bloggerPublishSheet');
}

// عرض نافذة فشل النشر
function showFailurePopup(message) {
  document.getElementById('failureMessage').textContent = message;
  openSheet('failureSheet');
}

// ===== نافذة نجاح النشر =====
function showSuccessPopup(url, type) {
  const msg = document.getElementById('successMessage');
  const inp = document.getElementById('publishedUrlInput');
  if (msg) msg.textContent = type === 'page' ? 'تم نشر الصفحة بنجاح!' : 'تم نشر المقال بنجاح!';
  if (inp) inp.value = url;
  openSheet('successSheet');
}
function closeSuccessPopup() { closeSheet('successSheet'); }
function copyPublishedUrl() {
  const inp = document.getElementById('publishedUrlInput');
  if (inp) {
    inp.select(); inp.setSelectionRange(0, 99999);
    document.execCommand('copy');
    modweebShowStatus('📋 تم نسخ الرابط', 1500);
  }
}

// ===== نافذة التأكيد =====
let confirmCallback = null, cancelCallback = null;
function showConfirmPopup(message, okCb, cancelCb, okText = 'موافق', cancelText = 'إلغاء') {
  document.getElementById('confirmSheetMessage').textContent = message;
  document.getElementById('confirmOkBtn').textContent = okText;
  document.getElementById('confirmCancelBtn').textContent = cancelText;
  confirmCallback = okCb || (() => {});
  cancelCallback = cancelCb || (() => {});
  openSheet('confirmSheet');
}
function closeConfirmSheet(confirmed = false) {
  closeSheet('confirmSheet');
  if (confirmed && confirmCallback) confirmCallback();
  else if (!confirmed && cancelCallback) cancelCallback();
  confirmCallback = null; cancelCallback = null;
}

// ربط أزرار التأكيد
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('confirmOkBtn')?.addEventListener('click', () => closeConfirmSheet(true));
  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => closeConfirmSheet(false));
  const overlay = document.getElementById('genericOverlay');
  if (overlay) overlay.addEventListener('click', closeAllSheets);
});

// ===== دالة النشر =====
async function publishToBlogger(retry = 0) {
  const errEl = document.getElementById('publishError');
  if (errEl) errEl.style.display = 'none';

  const blogIdInput = document.getElementById('bloggerBlogId');
  const postType = document.getElementById('bloggerPostType')?.value || 'post';
  const title = document.getElementById('bloggerPostTitle').value.trim();
  const labelsInput = document.getElementById('bloggerPostLabels')?.value.trim() || '';
  const slugInput = document.getElementById('bloggerPostSlug')?.value.trim() || '';
  const metaDesc = document.getElementById('bloggerMetaDescription')?.value.trim() || '';

  if (!title) {
    showFailurePopup('⚠️ يرجى إدخال عنوان المقال');
    document.getElementById('bloggerPostTitle').focus();
    return;
  }
  if (!modweebArticleHTML || modweebArticleHTML.trim() === '') {
    generateFullHTML();
  }
  if (!modweebArticleHTML || modweebArticleHTML.trim() === '') {
    showFailurePopup('⚠️ لا يوجد محتوى للمقال');
    return;
  }

  const publishBtn = document.querySelector('#bloggerPublishSheet .action-btn.primary');
  const origHTML = publishBtn ? publishBtn.innerHTML : '';
  if (publishBtn) {
    publishBtn.disabled = true;
    publishBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="spin"><path d="M12 2V6" stroke="currentColor" stroke-width="1.5"/><path d="M12 18V22" stroke="currentColor" stroke-width="1.5"/><path d="M2 12H6" stroke="currentColor" stroke-width="1.5"/><path d="M18 12H22" stroke="currentColor" stroke-width="1.5"/></svg> ${retry > 0 ? 'إعادة المحاولة...' : 'جاري النشر...'}`;
  }

  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error('تعذر الحصول على صلاحية صالحة.');

    // ---- تجهيز البيانات مع تنظيف صارم ----
    const blogId = blogIdInput?.value.trim() || BLOGGER_CONFIG.BLOG_ID;

    let cleanSlug = slugInput
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');

    const cleanLabels = labelsInput
      .split(',')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const cleanMeta = metaDesc
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const postData = {
      kind: `blogger#${postType}`,
      blog: { id: blogId },
      title: title,
      content: `<!--[ <div class='separator'><img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhvNm0jSrKTj_wZgyDDABcO3jQVeeLCf6vsy-jf5ebfhSM2RVTaMe9cXyGw_vyPFBC1Ss21mMqx5mnrTjoT82o9VkJQAyGGoTiI3uB4ewZcUAHGOM-GToCV5nk_XX-svQRH2CE4vcL6O6x2w0xohM_uKgHLlBV31IyUBJwtus3wl4vMmYfqzN3xp1M3ylc/s1280/ metadata-default-thumbnail.png'/></div> ]-->\n${modweebArticleHTML}`
    };

    if (cleanLabels.length > 0) postData.labels = cleanLabels;
    if (cleanSlug.length > 0) postData.url = cleanSlug;
    if (cleanMeta.length > 0) postData.description = cleanMeta;

    console.log('🚀 بيانات الإرسال إلى بلوجر:', JSON.stringify(postData, null, 2));

    const apiUrl = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/${postType === 'page' ? 'pages' : 'posts'}/?key=${BLOGGER_CONFIG.API_KEY}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (response.status === 401 && retry === 0) {
      if (await refreshAccessToken()) {
        if (publishBtn) { publishBtn.innerHTML = origHTML; publishBtn.disabled = false; }
        return await publishToBlogger(1);
      }
      throw new Error('فشل تجديد الصلاحية.');
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || `خطأ ${response.status}`);

    closeSheet('bloggerPublishSheet');
    showSuccessPopup(result.url, postType);
    modweebShowStatus('✅ تم النشر بنجاح!', 5000);

  } catch (error) {
    console.error('❌ فشل النشر:', error);
    showFailurePopup(`❌ فشل النشر: ${error.message}`);
    modweebShowStatus(`❌ فشل النشر: ${error.message}`, 5000);
  } finally {
    if (publishBtn) {
      publishBtn.innerHTML = origHTML;
      publishBtn.disabled = false;
    }
  }
}

// تهيئة الاتصال بـ Blogger API تلقائياً
(async function() {
  console.log("🔄 تهيئة الاتصال بـ Blogger API...");
  await getValidAccessToken();
})();
