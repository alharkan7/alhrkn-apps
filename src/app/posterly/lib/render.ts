import { promises as fs } from 'fs';
import path from 'path';

export interface PosterRenderResult {
  htmlPath: string;
  pdfPath: string;
  pngPath: string;
}

export async function renderPoster(html: string, workDir: string): Promise<PosterRenderResult> {
  const htmlPath = path.join(workDir, 'poster.html');
  const pdfPath = path.join(workDir, 'poster.pdf');
  const pngPath = path.join(workDir, 'poster.png');
  await fs.writeFile(htmlPath, html, 'utf8');

  const puppeteerModule = await import('puppeteer');
  const puppeteer = (puppeteerModule as any).default || puppeteerModule;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 960, deviceScaleFactor: 1.5 });
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
    await page.screenshot({ path: pngPath, type: 'png', fullPage: true, captureBeyondViewport: true });
    await page.close();
  } finally {
    await browser.close();
  }

  return { htmlPath, pdfPath, pngPath };
}
