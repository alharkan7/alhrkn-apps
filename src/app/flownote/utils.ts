// Convert HTML content to plain text by stripping tags
export function stripHtmlTags(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
}

// Generate PDF from HTML content
export async function generatePDF(title: string, htmlContent: string) {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const marginX = 56; // pt (~0.78")
    const marginY = 84; // pt (~1.17")
    const contentWidthPt = pageWidth - marginX * 2;
    const pxPerPt = 96 / 72; // px per pt
    const contentWidthPx = Math.floor(contentWidthPt * pxPerPt);

    // Create hidden container for rendering
    const hiddenContainer = document.createElement('div');
    hiddenContainer.setAttribute('data-flownote-pdf-container', 'true');
    hiddenContainer.style.position = 'fixed';
    hiddenContainer.style.left = '-10000px';
    hiddenContainer.style.top = '0';
    hiddenContainer.style.width = `${contentWidthPx}px`;
    hiddenContainer.style.padding = '0';
    hiddenContainer.style.boxSizing = 'border-box';
    hiddenContainer.style.background = '#ffffff';
    hiddenContainer.style.color = '#111827';
    hiddenContainer.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    hiddenContainer.style.lineHeight = '1.7';

    hiddenContainer.innerHTML = `
    <style>
      html, body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
      h1 { font-size: 32px; font-weight: 700; color: #111827; margin: 0 0 20px; padding-bottom: 14px; border-bottom: 2px solid #111827; letter-spacing: 0.2px; line-height: 1.3; }
      h2 { font-size: 24px; font-weight: 700; color: #111827; margin: 28px 0 12px; letter-spacing: 0.15px; line-height: 1.3; }
      h3 { font-size: 20px; font-weight: 600; color: #1f2937; margin: 20px 0 10px; line-height: 1.4; }
      h4 { font-size: 18px; font-weight: 600; color: #1f2937; margin: 16px 0 8px; line-height: 1.4; }
      p { font-size: 14px; margin: 0 0 12px; color: #111827; line-height: 1.7; }
      ul, ol { margin: 0 0 12px; padding-left: 24px; }
      li { margin: 0 0 6px; line-height: 1.7; font-size: 14px; }
      strong, b { font-weight: 600; }
      em, i { font-style: italic; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 13px; }
    </style>
    ${htmlContent}
  `;

    document.body.appendChild(hiddenContainer);

    // Wait for fonts to load
    try {
        if ((document as any).fonts?.ready) {
            await (document as any).fonts.ready;
        }
    } catch { }

    const canvas = await html2canvas(hiddenContainer, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: hiddenContainer.scrollWidth,
    });

    // Calculate slice height for pages
    const usablePageHeightPt = pageHeight - marginY * 2;
    const imgWidthPt = contentWidthPt;
    const sliceHeightPx = Math.floor((usablePageHeightPt * canvas.width) / imgWidthPt);

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    const sliceCtx = sliceCanvas.getContext('2d');

    let renderedPx = 0;
    const overlapPx = Math.max(0, Math.floor((6 * canvas.width) / imgWidthPt));
    let isFirstPage = true;

    while (renderedPx < canvas.height) {
        const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - renderedPx);

        if (currentSliceHeightPx < Math.max(16, Math.floor(sliceHeightPx * 0.06))) {
            break;
        }

        sliceCanvas.height = currentSliceHeightPx;
        if (sliceCtx) {
            sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sliceCtx.drawImage(
                canvas,
                0,
                renderedPx,
                canvas.width,
                currentSliceHeightPx,
                0,
                0,
                sliceCanvas.width,
                currentSliceHeightPx
            );
        }

        const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.82);
        const sliceHeightPt = (currentSliceHeightPx * imgWidthPt) / sliceCanvas.width;

        if (sliceHeightPt <= 2) {
            break;
        }

        if (!isFirstPage) {
            pdf.addPage();
        }
        pdf.addImage(sliceImgData, 'JPEG', marginX, marginY, imgWidthPt, sliceHeightPt);

        const advancePx = Math.max(8, currentSliceHeightPx - Math.min(overlapPx, Math.max(0, currentSliceHeightPx - 8)));
        renderedPx += advancePx;
        isFirstPage = false;
    }

    pdf.save(`${title || 'document'}.pdf`);
    document.body.removeChild(hiddenContainer);
}

// Generate DOCX (HTML with .doc extension that Word can open)
export function generateDOCX(title: string, htmlContent: string): void {
    const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title || 'Document'}</title>
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 12pt; line-height: 1.6; }
    h1 { font-size: 20pt; font-weight: bold; margin-top: 0; margin-bottom: 14pt; }
    h2 { font-size: 16pt; font-weight: bold; margin-top: 18pt; margin-bottom: 10pt; }
    h3 { font-size: 14pt; font-weight: bold; margin-top: 16pt; margin-bottom: 8pt; }
    h4 { font-size: 13pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; }
    p { margin: 0 0 10pt; }
    ul, ol { margin: 0 0 10pt; padding-left: 40px; }
    li { margin-bottom: 6pt; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'document'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
