export async function extractClientPdfText(file: File): Promise<string> {
  // PDF.js touches browser-only globals such as DOMMatrix during module
  // evaluation, so load it only after a PDF is selected in the browser.
  const pdfjsLib = await import('pdfjs-dist');

  // Use UNPKG CDN to load the worker to avoid webpack/next.js worker bundling issues in the browser.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const document = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => typeof item?.str === 'string' ? item.str : '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pages.push(`PAGE ${pageNumber}\n${pageText}`);
  }

  const extracted = pages.join('\n\n')
    .replace(/\0/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!extracted) {
    throw new Error('This PDF does not contain selectable text. Please provide Markdown or plain text instead.');
  }

  return extracted;
}
