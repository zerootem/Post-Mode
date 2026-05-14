// ai.js - دوال الذكاء الاصطناعي (بدون مفاتيح)
const AI_BASE = 'https://b01955d8-12d4-4391-a6ec-4e0002010656-00-2om65nm992vw3.sisko.replit.dev/api/ai';

function openAIPopup() { openSheet('aiPopup'); }

function closeAIPopup() {
  closeSheet('aiPopup');
  const sug = document.getElementById('titleSuggestions');
  if (sug) sug.style.display = 'none';
  const bar = document.getElementById('aiProgressBar');
  if (bar) bar.style.display = 'none';
  const btn = document.getElementById('aiGenerateBtn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

async function aiEnhanceTitle() {
    const topic = (document.getElementById('aiTopic') || {}).value || '';
    if (!topic.trim()) { modweebShowStatus('أدخل موضوع المقال أولاً'); return; }
    const btn = document.getElementById('enhanceTitleBtn');
    const lang = (document.getElementById('aiLanguage') || {}).value || 'ar';
    if (btn) { btn.disabled = true; btn.classList.add('active'); }
    try {
        const r = await fetch(AI_BASE + '/enhance-title', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ title: topic, language: lang })
        });
        const data = await r.json();
        const box = document.getElementById('titleSuggestions');
        const titles = [data.title, ...(data.alternatives || [])].filter(Boolean);
        if (box && titles.length) {
            box.style.display = 'block';
            box.innerHTML = titles.map(t =>
                `<div onclick="aiSelectTitle(this.textContent)" style="padding:.4rem .65rem;cursor:pointer;border-bottom:1px solid var(--contentL,#e3e7ef);transition:.1s;" onmouseover="this.style.background='var(--contentBa,#f4f8ff)'" onmouseout="this.style.background=''">${t}</div>`
            ).join('');
        }
    } catch(e) { modweebShowStatus('فشل تحسين العنوان'); }
    finally { if(btn){ btn.disabled=false; btn.classList.remove('active'); } }
}
function aiSelectTitle(t) {
    const inp = document.getElementById('aiTopic');
    if (inp) inp.value = t.trim();
    document.getElementById('titleSuggestions').style.display = 'none';
}

async function aiGenerateKeywords() {
    const topic = (document.getElementById('aiTopic') || {}).value || '';
    if (!topic.trim()) { modweebShowStatus('أدخل موضوع المقال أولاً'); return; }
    const btn = document.getElementById('genKeywordsBtn');
    const lang = (document.getElementById('aiLanguage') || {}).value || 'ar';
    if (btn) { btn.disabled = true; btn.classList.add('active'); }
    try {
        const r = await fetch(AI_BASE + '/generate-keywords', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ topic, language: lang })
        });
        const data = await r.json();
        const inp = document.getElementById('aiKeywords');
        if (inp && data.keywords) {
            inp.value = Array.isArray(data.keywords) ? data.keywords.join(', ') : data.keywords;
        }
    } catch(e) { modweebShowStatus('فشل توليد الكلمات المفتاحية'); }
    finally { if(btn){ btn.disabled=false; btn.classList.remove('active'); } }
}

async function aiGenerateArticle() {
    const topic = (document.getElementById('aiTopic') || {}).value || '';
    const keywords = (document.getElementById('aiKeywords') || {}).value || '';
    const tone = (document.getElementById('aiTone') || {}).value || 'professional';
    const length = (document.getElementById('aiLength') || {}).value || 'medium';
    const language = (document.getElementById('aiLanguage') || {}).value || 'ar';
    const customRequest = (document.getElementById('aiCustomRequest') || {}).value || '';

    if (!topic.trim()) { modweebShowStatus('أدخل موضوع المقال أولاً'); return; }

    const btn = document.getElementById('aiGenerateBtn');
    const bar = document.getElementById('aiProgressBar');
    const txt = document.getElementById('aiProgressText');
    if (btn) { btn.disabled = true; btn.style.opacity = '.55'; }
    if (bar) bar.style.display = 'block';
    if (txt) txt.textContent = 'جاري توليد المقال';

    const bodyData = { topic, tone, length, language };
    if (keywords) bodyData.keywords = keywords;
    if (customRequest) bodyData.topic = topic + ' ' + customRequest;

    try {
        const r = await fetch(AI_BASE + '/generate-article', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(bodyData)
        });
        if (!r.ok) { throw new Error('Server error ' + r.status); }
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        closeAIPopup();
        aiApplySections(data);
    } catch(e) {
        modweebShowStatus('حدث خطأ أثناء التوليد: ' + (e.message || 'تحقق من الاتصال'));
        if (bar) bar.style.display = 'none';
    } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
}

function aiApplySections(data) {
    if (typeof clearAll === 'function') clearAll();
    const sections = data.sections || [];

    for (const sec of sections) {
        const type = sec.type;
        if (!type) continue;

        const blockType = type === 'downloadBox' ? 'downloadBox'
            : type === 'relatedManual' ? 'relatedManual'
            : type === 'relatedAuto' ? 'relatedAuto'
            : type;

        modweebAddBlock(blockType);
        const b = modweebBlocks[modweebBlocks.length - 1];
        if (!b) continue;

        switch (type) {
            case 'basics':
                b.metaDescription = sec.metaDescription || '';
                break;
            case 'heading':
                b.content = sec.content || '';
                b.headingLevel = sec.headingLevel || 'h2';
                break;
            case 'paragraph':
                b.content = sec.content || '';
                b.paragraphStyle = sec.paragraphStyle || 'normal';
                if (sec.paragraphStyle === 'dropcap' && sec.content) {
                    b.dropCapChar = sec.content.charAt(0);
                }
                break;
            case 'toc':
                b.tocLabel = sec.tocLabel || 'جدول المحتويات';
                break;
            case 'note':
                b.content = sec.content || '';
                b.noteStyle = sec.noteStyle || 'info';
                break;
            case 'blockquote':
                b.content = sec.content || '';
                b.quoteAuthor = sec.quoteAuthor || '';
                b.quoteStyle = sec.quoteStyle || 's1';
                break;
            case 'steps':
                b.steps = Array.isArray(sec.steps) && sec.steps.length ? sec.steps : ['خطوة'];
                break;
            case 'accordion':
                b.summary = sec.summary || '';
                b.content = sec.content || '';
                b.accordionType = sec.accordionType || 'ac';
                break;
            case 'faq':
                b.faqItems = Array.isArray(sec.faqItems) && sec.faqItems.length
                    ? sec.faqItems
                    : [{ question: '', answer: '' }];
                break;
            case 'downloadBox':
                b.fileName = sec.fileName || '';
                b.fileSize = sec.fileSize || '';
                b.downloadFile = sec.downloadFile || '';
                break;
        }
    }

    if (data.title) {
        const titleInput = document.getElementById('bloggerPostTitle');
        if (titleInput) titleInput.value = data.title;
    }
    if (data.metaDescription) {
        const metaInput = document.getElementById('bloggerMetaDescription');
        if (metaInput) metaInput.value = data.metaDescription;
    }
    if (data.tags && Array.isArray(data.tags)) {
        const labelsInput = document.getElementById('bloggerPostLabels');
        if (labelsInput) labelsInput.value = data.tags.join(', ');
    }

    modweebSaveToHistory();
    if (typeof modweebRenderBlocks === 'function') modweebRenderBlocks();
    modweebShowStatus('✨ تم توليد المقال بالذكاء الاصطناعي بنجاح (' + sections.length + ' قسم)');
}
