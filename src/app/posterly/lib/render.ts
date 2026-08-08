import { promises as fs } from 'fs';
import path from 'path';

export interface PosterRenderResult {
  path: string;
  contentType: 'application/pdf' | 'image/png';
  fileName: string;
}

export type PosterExportFormat = 'pdf' | 'png';

async function measurePosterSize(page: any): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-poster-root], .poster, .poster-container') as HTMLElement | null;
    const rootRect = root?.getBoundingClientRect();
    const documentElement = document.documentElement;
    const body = document.body;
    const width = Math.ceil(rootRect?.width || documentElement.scrollWidth || body?.scrollWidth || 1600);
    const height = Math.ceil(Math.max(
      rootRect?.height || 0,
      root?.scrollHeight || 0,
      documentElement.scrollHeight || 0,
      body?.scrollHeight || 0,
      960,
    ));

    return { width: Math.max(1, width), height: Math.max(1, height) };
  });
}

export async function renderPoster(html: string, workDir: string, format: PosterExportFormat): Promise<PosterRenderResult> {
  const fileName = `poster.${format}`;
  const outputPath = path.join(workDir, fileName);
  await fs.mkdir(workDir, { recursive: true });

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
    if (format === 'pdf') {
      const { width, height } = await measurePosterSize(page);
      await page.pdf({
        path: outputPath,
        printBackground: true,
        width: `${width}px`,
        height: `${height}px`,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
        preferCSSPageSize: false,
      });
    } else {
      await page.screenshot({ path: outputPath, type: 'png', fullPage: true, captureBeyondViewport: true });
    }
    await page.close();
  } finally {
    await browser.close();
  }

  return {
    path: outputPath,
    contentType: format === 'pdf' ? 'application/pdf' : 'image/png',
    fileName,
  };
}
