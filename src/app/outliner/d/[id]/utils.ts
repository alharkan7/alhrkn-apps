"use client";

// Types kept simple here to avoid cross-file coupling
export type ResearchIdea = {
    title: string;
    abstract: {
        background: string;
        literatureReview: string;
        method: string;
        analysisTechnique: string;
        impact: string;
    };
};

// ---------- Conversions ----------

export function paragraphsToBlocks(text: string) {
    const paragraphs = (text || '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return [] as any[];
    return paragraphs.map(p => ({ type: 'paragraph', data: { text: p.replace(/\n/g, '<br>') } }));
}

export function convertMarkdownToEditorJS(markdown: string) {
    // Clean up any code fences that might appear in AI responses
    let cleanMarkdown = (markdown || '').replace(/\r\n?/g, '\n');
    
    // Remove markdown code fences (```markdown, ```, etc.)
    cleanMarkdown = cleanMarkdown.replace(/^```[a-zA-Z]*\s*\n?/gm, '');
    cleanMarkdown = cleanMarkdown.replace(/\n?```\s*$/gm, '');
    cleanMarkdown = cleanMarkdown.replace(/^```\s*$/gm, '');
    
    const lines = cleanMarkdown.split('\n');
    const blocks: any[] = [];
    let paragraphBuffer: string[] = [];
    let listBuffer: { style: 'ordered' | 'unordered'; items: string[] } | null = null;

    const flushParagraph = () => {
        const text = paragraphBuffer.join(' ').trim();
        if (text) {
            blocks.push({ type: 'paragraph', data: { text } });
        }
        paragraphBuffer = [];
    };

    const flushList = () => {
        if (listBuffer && listBuffer.items.length > 0) {
            blocks.push({ type: 'list', data: { style: listBuffer.style, items: [...listBuffer.items] } });
        }
        listBuffer = null;
    };

    const pushHeading = (level: number, text: string) => {
        flushParagraph();
        flushList();
        const safeLevel = Math.max(1, Math.min(level, 6));
        blocks.push({ type: 'header', data: { text: text.trim(), level: safeLevel } });
    };

    const addInlineFormatting = (text: string) => {
        // Very small subset of inline formatting
        let t = text;
        // Bold **text**
        t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        // Italic *text* and _text_ (with word boundary handling)
        t = t.replace(/(^|\s)\*(?!\s)([^*]+?)\*(?=\s|$|[.,;:!?])/g, '$1<i>$2</i>');
        t = t.replace(/(^|\s)_(?!\s)([^_]+?)_(?=\s|$|[.,;:!?])/g, '$1<i>$2</i>');
        // Inline code `code`
        t = t.replace(/`([^`]+?)`/g, '<code class="code">$1</code>');
        return t;
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.trim() === '') {
            flushParagraph();
            flushList();
            continue;
        }
        
        // Skip any remaining code fence lines
        if (line.trim().match(/^```[a-zA-Z]*$/) || line.trim() === '```') {
            continue;
        }

        // Headings
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const text = addInlineFormatting(headingMatch[2]);
            pushHeading(level, text);
            continue;
        }

        // Ordered list (1., 2., ...)
        const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (orderedMatch) {
            const item = addInlineFormatting(orderedMatch[1]);
            if (!listBuffer || listBuffer.style !== 'ordered') {
                flushParagraph();
                flushList();
                listBuffer = { style: 'ordered', items: [] };
            }
            listBuffer.items.push(item);
            continue;
        }

        // Unordered list (-, *)
        const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
        if (unorderedMatch) {
            const item = addInlineFormatting(unorderedMatch[1]);
            if (!listBuffer || listBuffer.style !== 'unordered') {
                flushParagraph();
                flushList();
                listBuffer = { style: 'unordered', items: [] };
            }
            listBuffer.items.push(item);
            continue;
        }

        // Normal paragraph line
        paragraphBuffer.push(addInlineFormatting(line.trim()))
    }

    // Flush remainders
    flushParagraph();
    flushList();

    // Ensure at least a title if present at the very top using the first non-empty line
    if (blocks.length === 0) {
        const firstNonEmpty = lines.find(l => l.trim().length > 0) || '';
        if (firstNonEmpty) {
            blocks.push({ type: 'header', data: { text: firstNonEmpty.trim(), level: 1 } });
        }
    }
    return blocks;
}

export function buildInitialDocumentData(idea: ResearchIdea) {
    const blocks: any[] = [];
    // Title as H1
    blocks.push({ type: 'header', data: { text: idea.title || 'Research Paper', level: 1 } });
    // Sections as H2 + paragraphs
    const sections: Array<[string, string]> = [
        ['Background', idea.abstract.background],
        ['Literature Review', idea.abstract.literatureReview],
        ['Method', idea.abstract.method],
        ['Analysis Technique', idea.abstract.analysisTechnique],
        ['Impact', idea.abstract.impact],
    ];
    sections.forEach(([heading, body]) => {
        blocks.push({ type: 'header', data: { text: heading, level: 2 } });
        blocks.push(...paragraphsToBlocks(body));
    });
    return { blocks };
}

export function extractListItemText(item: any): string {
    if (typeof item === 'string') {
        return item.trim();
    } else if (item && typeof item === 'object') {
        // Handle different possible item structures
        if (item.content) {
            return String(item.content).trim();
        } else if (item.text) {
            return String(item.text).trim();
        } else if (item.value) {
            return String(item.value).trim();
        } else if (item.label) {
            return String(item.label).trim();
        } else if (item.name) {
            return String(item.name).trim();
        } else if (item.title) {
            return String(item.title).trim();
        } else if (item.html) {
            // Handle HTML content by stripping tags
            return String(item.html).replace(/<[^>]*>/g, '').trim();
        } else if (item.markdown) {
            return String(item.markdown).trim();
        } else {
            // Try to find any string property
            for (const key in item) {
                if (typeof item[key] === 'string' && item[key].trim()) {
                    return item[key].trim();
                }
            }
            // If no string property found, try to convert the whole object
            try {
                const jsonStr = JSON.stringify(item);
                if (jsonStr !== '{}' && jsonStr !== '[]') {
                    return jsonStr;
                }
            } catch {}
            return String(item);
        }
    } else if (item === null || item === undefined) {
        return '';
    } else {
        return String(item).trim();
    }
}

export function convertToHTML(data: any): string {
    if (!data.blocks || !Array.isArray(data.blocks)) return '';
    
    return data.blocks.map((block: any) => {
        try {
            switch (block.type) {
                case 'header':
                    const level = block.data?.level || 1;
                    const headerText = block.data?.text || '';
                    return `<h${level}>${headerText}</h${level}>`;
                case 'paragraph':
                    const paraText = block.data?.text || '';
                    return `<p>${paraText}</p>`;
                case 'list':
                    if (!block.data || !Array.isArray(block.data.items)) {
                        return '<ul><li>List content unavailable</li></ul>';
                    }
                    const listType = block.data.style === 'ordered' ? 'ol' : 'ul';
                    const items = block.data.items.map((item: any) => {
                        const itemText = extractListItemText(item);
                        return `<li>${itemText}</li>`;
                    }).join('');
                    return `<${listType}>${items}</${listType}>`;
                case 'inlineCode':
                    const codeText = block.data?.text || '';
                    return `<code class="code">${codeText}</code>`;
                case 'marker':
                    const markerText = block.data?.text || '';
                    return `<mark>${markerText}</mark>`;
                case 'underline':
                    const underlineText = block.data?.text || '';
                    return `<u>${underlineText}</u>`;
                default:
                    const defaultText = block.data?.text || '';
                    return `<p>${defaultText}</p>`;
            }
        } catch (error) {
            console.error('Error converting block to HTML:', error, block);
            return `<p>Error converting block: ${block.type || 'unknown'}</p>`;
        }
    }).join('\n');
}

export function convertToMarkdown(data: any): string {
    if (!data.blocks || !Array.isArray(data.blocks)) return '';
    
    // Helper function to convert HTML tags back to markdown
    const convertHtmlToMarkdown = (text: string): string => {
        if (!text) return '';
        
        let result = text;
        
        // Convert HTML tags back to markdown syntax
        // Bold: <b>text</b> or <strong>text</strong> -> **text**
        result = result.replace(/<(?:b|strong)[^>]*>(.*?)<\/(?:b|strong)>/gi, '**$1**');
        
        // Italic: <i>text</i> or <em>text</em> -> *text*
        result = result.replace(/<(?:i|em)[^>]*>(.*?)<\/(?:i|em)>/gi, '*$1*');
        
        // Underline: <u>text</u> -> <u>text</u> (keep as HTML since markdown doesn't have underline)
        // Note: We'll keep underline as HTML since standard markdown doesn't support it
        
        // Inline code: <code class="code">text</code> -> `text`
        result = result.replace(/<code[^>]*class="code"[^>]*>(.*?)<\/code>/gi, '`$1`');
        
        // Generic code tags: <code>text</code> -> `text`
        result = result.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
        
        // Marker/highlight: <mark>text</mark> -> ==text==
        result = result.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
        
        // Links: <a href="url">text</a> -> [text](url)
        result = result.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
        
        // Generic links without href: <a>text</a> -> text
        result = result.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
        
        // Handle potential EditorJS specific patterns
        // Remove any remaining HTML tags that we don't handle
        result = result.replace(/<[^>]*>/g, '');
        
        // Clean up any double spaces that might be left after tag removal
        result = result.replace(/\s+/g, ' ').trim();
        
        return result;
    };
    
    return data.blocks.map((block: any) => {
        try {
            switch (block.type) {
                case 'header':
                    const level = block.data?.level || 1;
                    const hashes = '#'.repeat(level);
                    const headerText = convertHtmlToMarkdown(block.data?.text || '');
                    return `${hashes} ${headerText}\n`;
                case 'paragraph':
                    const paraText = convertHtmlToMarkdown(block.data?.text || '');
                    return `${paraText}\n\n`;
                case 'list':
                    if (!block.data || !Array.isArray(block.data.items)) {
                        return '• List content unavailable\n\n';
                    }
                    const listType = block.data.style === 'ordered' ? '1.' : '-';
                    const items = block.data.items.map((item: any) => {
                        const itemText = convertHtmlToMarkdown(extractListItemText(item));
                        return `  ${listType} ${itemText}`;
                    }).join('\n');
                    return `${items}\n\n`;
                case 'inlineCode':
                    const codeText = block.data?.text || '';
                    return `\`${codeText}\``;
                case 'marker':
                    const markerText = block.data?.text || '';
                    return `==${markerText}==`;
                case 'underline':
                    const underlineText = block.data?.text || '';
                    return `<u>${underlineText}</u>`;
                default:
                    const defaultText = convertHtmlToMarkdown(block.data?.text || '');
                    return `${defaultText}\n\n`;
            }
        } catch (error) {
            console.error('Error converting block to Markdown:', error, block);
            return `Error converting block: ${block.type || 'unknown'}\n\n`;
        }
    }).join('');
}

export function convertToPlainText(data: any): string {
    if (!data.blocks || !Array.isArray(data.blocks)) return '';
    
    // Helper function to strip HTML tags for plain text
    const stripHtmlTags = (text: string): string => {
        if (!text) return '';
        return text.replace(/<[^>]*>/g, '');
    };
    
    return data.blocks.map((block: any) => {
        try {
            switch (block.type) {
                case 'header':
                    const headerText = stripHtmlTags(block.data?.text || '');
                    return `${headerText}\n`;
                case 'paragraph':
                    const paraText = stripHtmlTags(block.data?.text || '');
                    return `${paraText}\n\n`;
                case 'list':
                    if (!block.data || !Array.isArray(block.data.items)) {
                        return '• List content unavailable\n\n';
                    }
                    const items = block.data.items.map((item: any) => {
                        const itemText = stripHtmlTags(extractListItemText(item));
                        return `  • ${itemText}`;
                    }).join('\n');
                    return `${items}\n\n`;
                case 'inlineCode':
                    const codeText = stripHtmlTags(block.data?.text || '');
                    return codeText;
                case 'marker':
                    const markerText = stripHtmlTags(block.data?.text || '');
                    return markerText;
                case 'underline':
                    const underlineText = stripHtmlTags(block.data?.text || '');
                    return underlineText;
                default:
                    const defaultText = stripHtmlTags(block.data?.text || '');
                    return `${defaultText}\n\n`;
            }
        } catch (error) {
            console.error('Error converting block to plain text:', error, block);
            return `Error converting block: ${block.type || 'unknown'}\n\n`;
        }
    }).join('');
}

export function getBibliographyEntries(): Array<{ html: string; text: string }> {
    try {
        const container = document.getElementById('bibliography-container');
        if (!container) return [];
        const entries = Array.from(container.querySelectorAll('.reference-entry')) as HTMLElement[];
        return entries.map((entry) => {
            const p = entry.querySelector('p');
            const html = (p?.innerHTML || entry.innerHTML || '').trim();
            const text = (p?.textContent || entry.textContent || '').trim();
            return { html, text };
        }).filter(e => e.text.length > 0);
    } catch {
        return [];
    }
}

export function buildBibliographyHTML(entries: Array<{ html: string; text: string }>): string {
    const hasEntries = !!(entries && entries.length > 0);
    const items = hasEntries
        ? entries.map(e => `<div class="reference-item"><p>${e.html}</p></div>`).join('')
        : `<div class="reference-item"><p style="color:#6b7280;font-style:italic;">No references added.</p></div>`;
    return `
        <section class="references-section">
            <h2>References</h2>
            ${items}
        </section>
    `;
}

export function buildBibliographyMarkdown(entries: Array<{ html: string; text: string }>): string {
    if (!entries || entries.length === 0) return '';
    const lines = entries.map(e => `- ${e.text}`).join('\n');
    return `\n## References\n${lines}\n\n`;
}

export function buildBibliographyPlain(entries: Array<{ html: string; text: string }>): string {
    if (!entries || entries.length === 0) return '';
    const lines = entries.map(e => `${e.text}`).join('\n');
    return `\nReferences\n${lines}\n`;
}

// ---------- PDF generation ----------

export async function renderPdfFromEditorData(title: string, data: any) {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    // Separate horizontal and vertical margins (more vertical as requested)
    const marginX = 56; // pt (~0.78")
    const marginY = 84; // pt (~1.17")
    const contentWidthPt = pageWidth - marginX * 2;
    const pxPerPt = 96 / 72; // px per pt
    const contentWidthPx = Math.floor(contentWidthPt * pxPerPt);

    const htmlMain = convertToHTML(data);
    const htmlBib = buildBibliographyHTML(getBibliographyEntries());
    const html = `${htmlMain}${htmlBib}`;
    const hiddenContainer = document.createElement('div');
    hiddenContainer.setAttribute('data-outliner-pdf-container', 'true');
    hiddenContainer.style.position = 'fixed';
    hiddenContainer.style.left = '-10000px';
    hiddenContainer.style.top = '0';
    hiddenContainer.style.width = `${contentWidthPx}px`;
    hiddenContainer.style.padding = '0';
    hiddenContainer.style.boxSizing = 'border-box';
    hiddenContainer.style.background = '#ffffff';
    hiddenContainer.style.color = '#111827';
    hiddenContainer.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif';
    hiddenContainer.style.lineHeight = '1.7';
    hiddenContainer.innerHTML = `
        <style>
            /* Global text rendering improvements */
            html, body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
            h1 { font-size: 28px; font-weight: 700; color: #111827; margin: 0 0 16px; padding-bottom: 14px; border-bottom: 2px solid #111827; letter-spacing: 0.2px; word-spacing: 0.06em; line-height: 1.3; white-space: normal; }
            h2 { font-size: 22px; font-weight: 600; color: #1f2937; margin: 24px 0 8px; letter-spacing: 0.15px; word-spacing: 0.05em; white-space: normal; }
            p { font-size: 14px; margin: 0 0 12px; color: #111827; overflow-wrap: break-word; word-break: normal; white-space: normal; }
            a { overflow-wrap: break-word; word-break: normal; }
            /* Custom list markers for reliable rendering and alignment */
            ul, ol { margin: 0 0 12px; padding-left: 0; }
            ul { list-style: none; }
            ol { list-style: none; counter-reset: pdf-ol; }
            ul li, ol li { margin: 0 0 8px 0; white-space: normal; line-height: 1.7; }
            /* Bulleted list */
            ul li { position: relative; padding-left: 20px; }
            ul li::before { content: ''; position: absolute; left: 0; top: 0.92em; width: 6px; height: 6px; background: currentColor; border-radius: 9999px; }
            /* Numbered list */
            ol li { position: relative; padding-left: 26px; }
            ol li::before { content: counter(pdf-ol) '.'; counter-increment: pdf-ol; position: absolute; left: 0; top: 0.15em; font-size: 0.95em; font-variant-numeric: tabular-nums; }
            code.code { background: #f3f4f6; padding: 6px 8px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; display: block; }
            mark { background: #fde68a; }
            u { text-decoration: underline; }
            /* Ensure references appear at the end cleanly */
            .references-section { page-break-before: always; margin-top: 16px; }
        </style>
        ${html}
    `;
    document.body.appendChild(hiddenContainer);

    // Ensure web fonts are ready before rendering to canvas (improves glyph spacing)
    try { if ((document as any).fonts?.ready) { await (document as any).fonts.ready; } } catch {}

    const canvas = await html2canvas(hiddenContainer, {
        // Lower scale to reduce raster size => smaller PDF
        scale: 1.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: hiddenContainer.scrollWidth,
    });

    // Calculate slice height in canvas pixels corresponding to one PDF page content height
    const usablePageHeightPt = pageHeight - marginY * 2; // pt
    const imgWidthPt = contentWidthPt; // target width in PDF
    const sliceHeightPx = Math.floor((usablePageHeightPt * canvas.width) / imgWidthPt);

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    const sliceCtx = sliceCanvas.getContext('2d');

    let renderedPx = 0;
    // Add a small overlap between pages to avoid cutting text at the bottom
    const overlapPx = Math.max(0, Math.floor((6 * canvas.width) / imgWidthPt));
    let isFirstPage = true;
    while (renderedPx < canvas.height) {
        const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - renderedPx);
        // Guard: if remaining height would result in a tiny fragment, stop
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

        // Use JPEG to drastically reduce file size for text content
        const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.82);
        const sliceHeightPt = (currentSliceHeightPx * imgWidthPt) / sliceCanvas.width;

        // Skip extremely small slices to avoid blank pages
        if (sliceHeightPt <= 2) {
            break;
        }

        if (!isFirstPage) {
            pdf.addPage();
        }
        pdf.addImage(sliceImgData, 'JPEG', marginX, marginY, imgWidthPt, sliceHeightPt);

        // Advance with overlap to prevent bottom cut-offs
        const advancePx = Math.max(8, currentSliceHeightPx - Math.min(overlapPx, Math.max(0, currentSliceHeightPx - 8)));
        renderedPx += advancePx;
        isFirstPage = false;
    }

    pdf.save(`${title || 'document'}.pdf`);
    document.body.removeChild(hiddenContainer);
}

