import { marked } from 'marked';

const CV_PDF_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    background: #ffffff;
    color: #1e293b;
  }
  .cv-pdf {
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1e293b;
    padding: 0;
    background: #ffffff;
  }
  .cv-pdf h1 {
    font-size: 20pt;
    font-weight: 700;
    margin: 0 0 4px;
    color: #0f172a;
    border-bottom: 2px solid #334155;
    padding-bottom: 6px;
  }
  .cv-pdf h2 {
    font-size: 12pt;
    font-weight: 700;
    margin: 16px 0 6px;
    color: #1e40af;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 3px;
  }
  .cv-pdf h3 {
    font-size: 11pt;
    font-weight: 600;
    margin: 10px 0 4px;
    color: #0f172a;
  }
  .cv-pdf p { margin: 0 0 6px; color: #1e293b; }
  .cv-pdf ul, .cv-pdf ol {
    margin: 0 0 8px;
    padding-left: 18px;
    color: #1e293b;
  }
  .cv-pdf li { margin-bottom: 3px; color: #1e293b; }
  .cv-pdf strong { font-weight: 600; color: #0f172a; }
  .cv-pdf em { font-style: italic; }
  .cv-pdf hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 12px 0;
  }
  .cv-pdf a { color: #1e40af; text-decoration: none; }
`;

function createIsolatedCvDocument(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CV_PDF_STYLES}</style></head><body><div class="cv-pdf">${html}</div></body></html>`
  );
  doc.close();

  return {
    iframe,
    element: doc.querySelector('.cv-pdf'),
    contentWindow: iframe.contentWindow,
  };
}

function canvasToPdf(jsPDF, canvas, filename) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 12;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL('image/jpeg', 0.98);
  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
  heightLeft -= contentHeight;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;
  }

  pdf.save(filename);
}

export async function downloadCvAsPdf(markdown, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const html = marked.parse(markdown, { async: false });
  const { iframe, element, contentWindow } = createIsolatedCvDocument(html);

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      window: contentWindow,
      logging: false,
    });

    canvasToPdf(jsPDF, canvas, filename);
  } finally {
    document.body.removeChild(iframe);
  }
}
