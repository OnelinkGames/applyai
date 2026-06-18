import { marked } from 'marked';

const CV_PDF_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #1e293b;
  }
  .cv-pdf {
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1e293b;
    background: #ffffff;
    width: 794px;
    text-align: left;
    word-break: normal;
    overflow-wrap: normal;
    hyphens: none;
  }
  .cv-pdf-page {
    width: 794px;
    padding: 20px 30px;
    background: #ffffff;
  }
  .cv-pdf h1 {
    font-size: 24pt;
    font-weight: 700;
    margin: 0 0 8px;
    color: #0f172a;
    border-bottom: 2px solid #334155;
    padding-bottom: 6px;
  }
  .cv-pdf h2 {
    position: relative;
    font-size: 13pt;
    font-weight: 700;
    margin: 14px 0 6px;
    color: #0f172a;
    letter-spacing: 0.04em;
    padding-left: 14px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 5px;
  }
  .cv-pdf h2:first-child {
    margin-top: 0;
  }
  .cv-pdf h2::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 4px;
    height: 20px;
    background: #1e40af;
    transform: translateY(-50%);
    border-radius: 999px;
  }
  .cv-pdf h3 {
    font-size: 11pt;
    font-weight: 600;
    margin: 0 0 4px;
    color: #0f172a;
  }
  .cv-pdf p {
    margin: 0 0 6px;
    color: #334155;
  }
  .cv-pdf strong { font-weight: 700; color: #0f172a; }
  .cv-pdf em { font-style: italic; color: #475569; }
  .cv-pdf hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 12px 0;
  }
  .cv-pdf a { color: #2563eb; text-decoration: none; }
  .cv-pdf blockquote {
    margin: 0 0 8px;
    padding: 10px 12px;
    border-left: 4px solid #cbd5e1;
    background: #f8fafc;
    color: #334155;
  }
  .cv-pdf-unit {
    width: 100%;
  }
  .cv-header-block p:last-child {
    margin-bottom: 0;
  }
  .cv-job-entry {
    margin: 10px 0 2px;
  }
  .cv-job-entry .cv-role { margin: 0 0 3px; }
  .cv-job-entry .cv-dates {
    margin: 0 0 6px;
    font-size: 10.5pt;
  }
  .cv-pdf-bullets { margin: 0; }
  .cv-pdf-bullet {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0 0 4px;
    color: #334155;
  }
  .cv-pdf-bullet-dot {
    flex: 0 0 12px;
    width: 12px;
    text-align: center;
    line-height: 1.5;
    font-size: 11pt;
    padding-top: 1px;
  }
  .cv-pdf-bullet-text {
    flex: 1;
    min-width: 0;
    line-height: 1.5;
    color: #334155;
  }
  .cv-pdf-bullet-text p { margin: 0; }
`;

const PAGE_WIDTH_PX = 794;
const PAGE_MARGIN_MM = 12;

function createIsolatedCvDocument() {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_WIDTH_PX}px;height:1px;border:none;visibility:hidden;overflow:hidden;`;
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CV_PDF_STYLES}</style></head><body></body></html>`);
  doc.close();

  return { iframe, doc, contentWindow: iframe.contentWindow };
}

function createBulletRow(doc, li) {
  const row = doc.createElement('div');
  row.className = 'cv-pdf-bullet';

  const dot = doc.createElement('span');
  dot.className = 'cv-pdf-bullet-dot';
  dot.textContent = '•';

  const text = doc.createElement('div');
  text.className = 'cv-pdf-bullet-text';
  text.innerHTML = li.innerHTML.trim();

  row.appendChild(dot);
  row.appendChild(text);
  return row;
}

function convertListToBullets(parent, listNode) {
  const wrap = listNode.ownerDocument.createElement('div');
  wrap.className = 'cv-pdf-bullets';
  for (const li of Array.from(listNode.children)) {
    wrap.appendChild(createBulletRow(listNode.ownerDocument, li));
  }
  parent.appendChild(wrap);
  listNode.remove();
}

function annotateJobMeta(node) {
  if (node.tagName !== 'P') return;
  const hasEm = node.querySelector('em');
  const hasStrong = node.querySelector('strong');
  if (hasEm && !hasStrong) node.classList.add('cv-dates');
  else if (hasStrong) node.classList.add('cv-role');
}

function wrapUnit(doc, node) {
  const unit = doc.createElement('div');
  unit.className = 'cv-pdf-unit';
  unit.appendChild(node);
  return unit;
}

function collectPdfUnits(cvRoot) {
  const doc = cvRoot.ownerDocument;
  const units = [];
  const nodes = Array.from(cvRoot.children);

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.tagName === 'H1') {
      const unit = doc.createElement('div');
      unit.className = 'cv-pdf-unit cv-header-block';
      unit.appendChild(node);
      i++;
      while (i < nodes.length && nodes[i].tagName !== 'H2') {
        const current = nodes[i];
        if (current.tagName === 'UL' || current.tagName === 'OL') {
          convertListToBullets(unit, current);
        } else {
          unit.appendChild(current);
        }
        i++;
      }
      i--;
      units.push(unit);
      continue;
    }

    if (node.tagName === 'H2') {
      const unit = doc.createElement('div');
      unit.className = 'cv-pdf-unit cv-section-lead';
      unit.appendChild(node);
      i++;
      while (i < nodes.length && nodes[i].tagName === 'P') {
        unit.appendChild(nodes[i]);
        i++;
      }
      i--;
      units.push(unit);
      continue;
    }

    if (node.tagName === 'H3') {
      const jobEntry = doc.createElement('div');
      jobEntry.className = 'cv-job-entry cv-pdf-unit';
      jobEntry.appendChild(node);
      i++;
      while (i < nodes.length && !['H2', 'H3', 'HR'].includes(nodes[i].tagName)) {
        const current = nodes[i];
        if (current.tagName === 'UL' || current.tagName === 'OL') {
          convertListToBullets(jobEntry, current);
        } else {
          annotateJobMeta(current);
          jobEntry.appendChild(current);
        }
        i++;
      }
      i--;
      units.push(jobEntry);
      continue;
    }

    if (node.tagName === 'UL' || node.tagName === 'OL') {
      const unit = doc.createElement('div');
      unit.className = 'cv-pdf-unit';
      convertListToBullets(unit, node);
      units.push(unit);
      continue;
    }

    units.push(wrapUnit(doc, node));
  }

  return units;
}

function splitJobEntry(jobEntry, doc) {
  const units = [];
  const header = doc.createElement('div');
  header.className = 'cv-job-entry cv-pdf-unit';

  const bulletsWrap = jobEntry.querySelector('.cv-pdf-bullets');
  for (const child of Array.from(jobEntry.children)) {
    if (child !== bulletsWrap) header.appendChild(child.cloneNode(true));
  }
  units.push(header);

  if (bulletsWrap) {
    for (const bullet of Array.from(bulletsWrap.children)) {
      const bulletUnit = doc.createElement('div');
      bulletUnit.className = 'cv-pdf-unit';
      bulletUnit.appendChild(bullet.cloneNode(true));
      units.push(bulletUnit);
    }
  }

  return units;
}

function splitBulletListUnit(unit, doc) {
  const units = [];
  const bulletsWrap = unit.querySelector('.cv-pdf-bullets');
  const h2 = unit.querySelector('h2');

  if (h2) {
    const lead = doc.createElement('div');
    lead.className = 'cv-pdf-unit cv-section-lead';
    lead.appendChild(h2.cloneNode(true));
    units.push(lead);
  }

  if (bulletsWrap) {
    for (const bullet of Array.from(bulletsWrap.children)) {
      const bulletUnit = doc.createElement('div');
      bulletUnit.className = 'cv-pdf-unit';
      bulletUnit.appendChild(bullet.cloneNode(true));
      units.push(bulletUnit);
    }
  }

  return units.length > 0 ? units : [unit];
}

function createMeasureRoot(doc) {
  const root = doc.createElement('div');
  root.className = 'cv-pdf-page';
  doc.body.appendChild(root);
  return root;
}

function measurePageHeight(units, measureRoot) {
  const page = measureRoot.ownerDocument.createElement('div');
  page.className = 'cv-pdf-page';
  for (const unit of units) {
    page.appendChild(unit.cloneNode(true));
  }
  measureRoot.replaceChildren(page);
  return measureRoot.scrollHeight;
}

function pxToMm(px, contentWidthMm) {
  return (px * contentWidthMm) / PAGE_WIDTH_PX;
}

function getPageContentHeightPx(contentWidthMm, contentHeightMm) {
  return Math.floor((contentHeightMm * PAGE_WIDTH_PX) / contentWidthMm);
}

function expandOversizedUnits(units, measureRoot, maxPageHeightPx, doc) {
  const result = [];

  for (const unit of units) {
    const height = measurePageHeight([unit], measureRoot);

    if (height > maxPageHeightPx && unit.classList.contains('cv-job-entry')) {
      result.push(...splitJobEntry(unit, doc));
      continue;
    }

    if (height > maxPageHeightPx && unit.querySelector('.cv-pdf-bullets')) {
      result.push(...splitBulletListUnit(unit, doc));
      continue;
    }

    result.push(unit);
  }

  return result;
}

function paginateUnits(units, measureRoot, maxPageHeightPx) {
  const pages = [];
  let currentUnits = [];

  for (const unit of units) {
    const candidate = [...currentUnits, unit];
    const candidateHeight = measurePageHeight(candidate, measureRoot);

    if (currentUnits.length > 0 && candidateHeight > maxPageHeightPx) {
      pages.push(currentUnits);
      currentUnits = [unit];
    } else {
      currentUnits = candidate;
    }
  }

  if (currentUnits.length > 0) {
    pages.push(currentUnits);
  }

  return pages;
}

async function renderPageCanvas(html2canvas, pageUnits, measureRoot, contentWindow) {
  const page = measureRoot.ownerDocument.createElement('div');
  page.className = 'cv-pdf-page';
  for (const unit of pageUnits) {
    page.appendChild(unit.cloneNode(true));
  }

  measureRoot.replaceChildren(page);
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const height = measureRoot.scrollHeight;
  return html2canvas(measureRoot, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    window: contentWindow,
    logging: false,
    width: PAGE_WIDTH_PX,
    height,
    scrollY: 0,
    scrollX: 0,
  });
}

async function pagesToPdf(html2canvas, jsPDF, pageGroups, measureRoot, contentWindow, filename) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidthMm = pageWidth - PAGE_MARGIN_MM * 2;

  for (let i = 0; i < pageGroups.length; i++) {
    if (i > 0) pdf.addPage();

    const canvas = await renderPageCanvas(html2canvas, pageGroups[i], measureRoot, contentWindow);
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const imgHeightMm = pxToMm(canvas.height / 2, contentWidthMm);

    pdf.addImage(imgData, 'JPEG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, contentWidthMm, imgHeightMm);
  }

  pdf.save(filename);
}

export async function downloadCvAsPdf(markdown, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const html = marked.parse(markdown, { async: false });
  const { iframe, doc, contentWindow } = createIsolatedCvDocument();

  const cvRoot = doc.createElement('div');
  cvRoot.className = 'cv-pdf';
  cvRoot.innerHTML = html;
  doc.body.appendChild(cvRoot);

  const measureRoot = createMeasureRoot(doc);

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const units = collectPdfUnits(cvRoot);
    const contentWidthMm = 210 - PAGE_MARGIN_MM * 2;
    const contentHeightMm = 297 - PAGE_MARGIN_MM * 2;
    const maxPageHeightPx = getPageContentHeightPx(contentWidthMm, contentHeightMm);

    const expandedUnits = expandOversizedUnits(units, measureRoot, maxPageHeightPx, doc);
    const pageGroups = paginateUnits(expandedUnits, measureRoot, maxPageHeightPx);

    await pagesToPdf(html2canvas, jsPDF, pageGroups, measureRoot, contentWindow, filename);
  } finally {
    measureRoot.remove();
    cvRoot.remove();
    document.body.removeChild(iframe);
  }
}
