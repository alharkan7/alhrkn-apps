import { CITE_ICON_SVG, OPEN_ICON_SVG, FILE_ICON_SVG, CHEVRON_UP_ICON_SVG, CHEVRON_DOWN_ICON_SVG, X_ICON_SVG, ABSTRACT_ICON_SVG } from '../components/svg-icons';

// Inline tool to find citations for selected text using the /api/outliner/cite endpoint
export class CitationTool {
    // Ensure only one set of global listeners are installed
    private static globalListenersInstalled: boolean = false;
    private static lastConstructedInstance: CitationTool | null = null;
    private static lastEventTime: number = 0;
    private static readonly EVENT_DEBOUNCE_MS = 100;
    static isInline = true;
    static title = 'Cite';

    static get sanitize() {
        return {
            cite: {
                class: 'inline-citation',
                'data-paper-id': true,
                'data-paper-json': true,
                contenteditable: true,
                title: true,
            }
        };
    }

    private api: any;
    private button: HTMLButtonElement;
    private savedSelectionRange: Range | null = null;
    private currentPage: number = 1;
    private perPage: number = 10;
    private pageCache: Map<number, any> = new Map();
    private lastSearchQuery: string | null = null;
    private lastSelectedTextKey: string | null = null;
    private config: {
        endpoint: string;
        language?: 'en' | 'id';
        getDocument: () => Promise<any>;
        notify?: (msg: string) => void;
    };
    private working: boolean = false;
    private modal: HTMLDivElement | null = null;
    private loadingOverlay: HTMLDivElement | null = null;
    private boundCiteCurrent?: () => void;
    private forceBlockPlacement: boolean = false;
    private abstractCache: Map<string, { abstract: string; timestamp: number }> = new Map();
    private expandedAbstracts: Set<string> = new Set();
    private abstractLoadingStates: Map<string, boolean> = new Map();

    constructor({ api, config }: { api: any; config: any; }) {
        this.api = api;
        this.config = config || {};
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'ce-inline-tool';
        // Mark as AI tool (second in the AI group)
        this.button.setAttribute('data-ai-tool', 'true');
        this.button.title = 'Find citations';

        // Create citation icon (using a book icon)
        const icon = document.createElement('div');
        icon.innerHTML = CITE_ICON_SVG;
        this.button.appendChild(icon);

        // Track the latest constructed instance
        try { CitationTool.lastConstructedInstance = this; } catch { }

        // Install a single set of global listeners once
        if (!CitationTool.globalListenersInstalled) {
            try {
                const w = window as any;
                if (!w.__outliner_citation_listeners_installed) {
                    // Mini toolbar: cite current
                    window.addEventListener('outliner-ai-cite-current', () => {
                        try {
                            // Debounce rapid events
                            const now = Date.now();
                            if (now - CitationTool.lastEventTime < CitationTool.EVENT_DEBOUNCE_MS) {
                                return;
                            }
                            CitationTool.lastEventTime = now;

                            const inst = CitationTool.lastConstructedInstance;
                            if (!inst) return;
                            if (inst.working) return;
                            const selection = window.getSelection();
                            const hasSelection = selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed;
                            inst.forceBlockPlacement = true;
                            if (!hasSelection && selection && selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                // @ts-ignore
                                inst.surround(range as any);
                            } else if (selection && selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                // @ts-ignore
                                inst.surround(range as any);
                            }
                        } catch { /* noop */ }
                    });

                    // Document changed → update bibliography display
                    let debounceTimer: any = null;
                    window.addEventListener('outliner-document-changed', () => {
                        try {
                            if (debounceTimer) clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(() => {
                                const inst = CitationTool.lastConstructedInstance;
                                if (!inst) return;
                                try { inst.updateBibliographyDisplay().catch(() => { }); } catch { }
                            }, 300);
                        } catch { /* noop */ }
                    });

                    // External open request
                    window.addEventListener('outliner-open-citations', () => {
                        try {
                            // Debounce rapid events
                            const now = Date.now();
                            if (now - CitationTool.lastEventTime < CitationTool.EVENT_DEBOUNCE_MS) {
                                return;
                            }
                            CitationTool.lastEventTime = now;

                            const inst = CitationTool.lastConstructedInstance;
                            if (!inst) return;
                            inst.openCitations().catch(() => { });
                        } catch { /* noop */ }
                    });

                    w.__outliner_citation_listeners_installed = true;
                }

                CitationTool.globalListenersInstalled = true;
            } catch { /* noop */ }
        }
    }

    render() {
        return this.button;
    }

    checkState() {
        return false;
    }

    async surround(range: Range) {
        if (this.working) return;

        // Prevent multiple modals from being opened
        if (this.modal || document.querySelector('[data-citation-modal="true"]')) {
            return;
        }

        try {
            this.working = true;
            this.button.disabled = true;

            // Ensure any existing modals are closed before proceeding
            this.closeModal();

            const selection = range?.cloneRange?.() || range;
            const selectedText = selection?.toString?.().trim?.() || '';

            // Save selection range so we can restore it when the user clicks Cite in the modal
            try {
                this.savedSelectionRange = selection?.cloneRange?.() || null;
            } catch { this.savedSelectionRange = null; }

            if (!selectedText) {
                this.config.notify?.('Please select some text to find citations for.');
                return;
            }

            // Reset pagination state if selection changed
            if (this.lastSelectedTextKey !== selectedText) {
                this.currentPage = 1;
                this.pageCache.clear();
                this.lastSearchQuery = null;
                this.lastSelectedTextKey = selectedText;
            }

            // Show loading overlay
            this.showLoading('Researching...');

            // Call the citation API
            const res = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: selectedText,
                    perPage: this.perPage,
                    page: 1,
                    language: this.config.language || 'en'
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || `Request failed with ${res.status}`);
            }

            const data = await res.json();
            // sync pagination and cache
            this.perPage = data?.perPage || this.perPage;
            this.currentPage = data?.page || 1;
            this.lastSearchQuery = data?.searchQuery || null;
            this.pageCache.set(this.currentPage, data);
            this.hideLoading();
            this.showCitationModal(data, selectedText);

        } catch (e: any) {
            this.config.notify?.(e?.message || 'Failed to find citations');
        } finally {
            this.hideLoading();
            this.working = false;
            this.button.disabled = false;
        }
    }

    private showCitationModal(data: any, selectedText: string) {
        // Remove existing modal if any
        if (this.modal) {
            try {
                document.body.removeChild(this.modal);
            } catch { }
            this.modal = null;
        }

        // Also remove any existing modals from other instances to prevent multiple overlays
        const existingModals = document.querySelectorAll('[data-citation-modal="true"]');
        existingModals.forEach(modal => {
            try {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            } catch { }
        });

        const hasSearchRun = Boolean(
            String(data?.searchQuery || '').trim() ||
            (Array.isArray(data?.keywords) && data.keywords.length > 0)
        );

        // Create modal with custom CSS variables
        this.modal = document.createElement('div');
        this.modal.setAttribute('data-citation-modal', 'true');
        this.modal.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-[#191918]/40 p-3 font-sans backdrop-blur-[3px] transition-all duration-300 dark:bg-black/60 sm:p-6';


        const modalContent = document.createElement('div');
        modalContent.className = `flex max-h-[min(90vh,920px)] w-full ${hasSearchRun ? 'max-w-5xl' : 'max-w-xl'} flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-[#fdfdfb] shadow-[0_24px_80px_rgba(25,25,24,0.18)] backdrop-blur-2xl dark:border-white/[0.1] dark:bg-[#1b1b19]`;


        // Header
        const header = document.createElement('div');
        header.className = 'flex shrink-0 items-center justify-between gap-4 border-b border-black/[0.07] bg-[#f7f7f5]/75 px-4 py-3.5 dark:border-white/[0.08] dark:bg-white/[0.025] sm:px-6';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'min-w-0';

        const totalFound = data?.totalFound ?? (data.papers ? data.papers.length : 0);
        const page = data?.page ?? this.currentPage;
        const perPage = data?.perPage ?? this.perPage;
        const showingCount = data?.papers?.length ?? 0;
        const hasMultiplePages = hasSearchRun && (
            page > 1 ||
            showingCount === perPage ||
            (typeof totalFound === 'number' && totalFound > perPage)
        );

        const title = document.createElement('h3');
        title.textContent = hasSearchRun ? 'Reference search' : 'Find references';
        title.className = 'm-0 truncate text-base font-semibold tracking-[-0.01em] text-[#191918] dark:text-[#f2f2ef]';

        titleGroup.appendChild(title);
        if (hasSearchRun) {
            const resultMeta = document.createElement('p');
            resultMeta.textContent = `${totalFound} reference${totalFound !== 1 ? 's' : ''} found · Page ${page}`;
            resultMeta.className = 'm-0 mt-0.5 text-xs text-black/45 dark:text-white/45';
            titleGroup.appendChild(resultMeta);
        }


        // Pagination controls
        const pager = document.createElement('div');
        pager.className = 'shrink-0';

        // Button row with responsive layout
        const buttonRow = document.createElement('div');
        buttonRow.className = 'flex items-center gap-1.5';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Prev';
        prevBtn.className = 'h-8 rounded-lg border border-black/[0.08] bg-transparent px-2.5 text-xs font-medium text-black/60 transition-colors hover:bg-black/[0.055] hover:text-[#191918] disabled:pointer-events-none disabled:opacity-35 dark:border-white/[0.1] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white';
        prevBtn.setAttribute('aria-label', 'Previous reference page');

        prevBtn.disabled = page <= 1;
        prevBtn.onclick = () => this.goToPage(page - 1);

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.className = 'h-8 rounded-lg border border-[#191918] bg-[#191918] px-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-black disabled:pointer-events-none disabled:opacity-35 dark:border-[#f2f2ef] dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white';
        nextBtn.setAttribute('aria-label', 'Next reference page');

        const hasMore = totalFound ? (page * perPage) < totalFound : showingCount === perPage;
        nextBtn.disabled = !hasMore;
        nextBtn.onclick = () => this.goToPage(page + 1);

        // Page info that goes between buttons on larger screens
        // const pageInfo = document.createElement('span');
        // pageInfo.textContent = `${(page - 1) * perPage + 1}-${(page - 1) * perPage + showingCount} of ${totalFound}`;
        // pageInfo.className = 'text-xs opacity-80 text-center order-first sm:order-none';
        // pageInfo.style.cssText = `color: var(--text);`;

        buttonRow.appendChild(prevBtn);
        // buttonRow.appendChild(pageInfo);
        buttonRow.appendChild(nextBtn);

        pager.appendChild(buttonRow);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = X_ICON_SVG;
        closeBtn.className = 'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-black/50 transition-colors hover:bg-black/[0.06] hover:text-[#191918] dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white';
        closeBtn.setAttribute('aria-label', 'Close reference search');

        closeBtn.onclick = () => this.closeModal();

        header.appendChild(titleGroup);
        const rightActions = document.createElement('div');
        rightActions.className = 'flex shrink-0 items-center gap-2';
        if (hasMultiplePages) rightActions.appendChild(pager);
        rightActions.appendChild(closeBtn);
        header.appendChild(rightActions);

        // Content
        const content = document.createElement('div');
        content.className = 'max-h-[78vh] overflow-y-auto bg-transparent p-4 sm:p-6';


        // One direct search field is used both before and after results are shown.
        const searchInfo = document.createElement('form');
        searchInfo.className = 'mb-5 rounded-xl border border-black/[0.07] bg-black/[0.025] p-3 dark:border-white/[0.08] dark:bg-white/[0.035] sm:p-4';

        const searchLabel = document.createElement('label');
        searchLabel.textContent = hasSearchRun ? 'Search again' : 'Search for papers to cite';
        searchLabel.className = 'mb-2 block text-xs font-medium text-black/50 dark:text-white/50';

        const searchRow = document.createElement('div');
        searchRow.className = 'flex items-center gap-2';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = Array.isArray(data?.keywords) && data.keywords.length > 0
            ? data.keywords.join(', ')
            : String(data?.searchQuery || '').replace(/\s+AND\s+/gi, ', ');
        input.placeholder = 'Topic, paper title, or keywords…';
        input.className = 'h-10 min-w-0 flex-1 rounded-lg border border-black/[0.1] bg-white px-3 text-sm text-[#191918] shadow-none transition-all placeholder:text-black/30 focus:border-black/25 focus:outline-none focus:ring-2 focus:ring-black/[0.08] dark:border-white/[0.12] dark:bg-[#1b1b19] dark:text-[#f2f2ef] dark:placeholder:text-white/30 dark:focus:border-white/25 dark:focus:ring-white/[0.08]';

        const searchButton = document.createElement('button');
        searchButton.type = 'submit';
        searchButton.textContent = 'Search';
        searchButton.className = 'h-10 shrink-0 cursor-pointer rounded-lg border border-[#191918] bg-[#191918] px-3.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-black dark:border-[#f2f2ef] dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white';

        searchInfo.addEventListener('submit', async (event) => {
            event.preventDefault();
            const keywords = input.value.split(',').map(k => k.trim()).filter(Boolean);
            if (keywords.length === 0) {
                this.config.notify?.('Enter a topic or keyword to search.');
                input.focus();
                return;
            }
            await this.applyEditedKeywords(keywords);
        });

        searchRow.appendChild(input);
        searchRow.appendChild(searchButton);
        searchInfo.appendChild(searchLabel);
        searchInfo.appendChild(searchRow);
        if (!hasSearchRun) {
            const hint = document.createElement('p');
            hint.textContent = 'Use a topic, paper title, or a few keywords.';
            hint.className = 'm-0 mt-2 text-xs text-black/40 dark:text-white/40';
            searchInfo.appendChild(hint);
        }
        content.appendChild(searchInfo);
        if (!hasSearchRun) {
            setTimeout(() => input.focus(), 0);
        }

        // Papers list
        if (data.papers && data.papers.length > 0) {
            const papersList = document.createElement('div');
            papersList.className = 'grid grid-cols-1 gap-3 md:grid-cols-2';
            papersList.style.cssText = `
                display: grid;
                grid-template-columns: repeat(1, 1fr);
                gap: 0.75rem;
                align-items: stretch;
            `;

            // Apply responsive grid layout using CSS media queries
            const style = document.createElement('style');
            style.textContent = `
                @media (min-width: 768px) {
                    .citation-papers-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                .citation-papers-grid > * {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
            `;
            if (!document.querySelector('style[data-citation-grid="true"]')) {
                style.setAttribute('data-citation-grid', 'true');
                document.head.appendChild(style);
            }
            papersList.classList.add('citation-papers-grid');

            data.papers.forEach((paper: any, index: number) => {
                const paperCard = this.createPaperCard(paper, index + 1);
                papersList.appendChild(paperCard);
            });

            content.appendChild(papersList);
        } else if (hasSearchRun) {
            const noResults = document.createElement('div');
            noResults.className = 'rounded-xl border border-black/[0.07] bg-black/[0.025] px-5 py-10 text-center text-sm text-black/50 dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/50';

            noResults.textContent = 'No references found. Try a broader search.';
            content.appendChild(noResults);
        }

        modalContent.appendChild(header);
        modalContent.appendChild(content);
        this.modal.appendChild(modalContent);
        document.body.appendChild(this.modal);

        // Close on backdrop click
        this.modal.onclick = (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        };
    }

    private async goToPage(page: number) {
        try {
            if (page < 1) return;
            if (this.working) return;
            this.working = true;

            // If cached, use it
            const cached = this.pageCache.get(page);
            if (cached) {
                this.currentPage = page;
                this.hideLoading();
                this.showCitationModal(cached, this.lastSelectedTextKey || '');
                return;
            }

            this.showLoading('Loading...');

            const body: any = {
                page,
                perPage: this.perPage,
            };
            if (this.lastSearchQuery) {
                body.searchQuery = this.lastSearchQuery;
            } else if (this.lastSelectedTextKey) {
                body.text = this.lastSelectedTextKey;
            }

            const res = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...body,
                    language: this.config.language || 'en'
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || `Request failed with ${res.status}`);
            }

            const data = await res.json();
            this.perPage = data?.perPage || this.perPage;
            this.currentPage = data?.page || page;
            this.lastSearchQuery = data?.searchQuery || this.lastSearchQuery;
            this.pageCache.set(this.currentPage, data);
            this.hideLoading();
            this.showCitationModal(data, this.lastSelectedTextKey || '');
        } catch (e: any) {
            this.config.notify?.(e?.message || 'Failed to load page');
        } finally {
            this.hideLoading();
            this.working = false;
        }
    }

    private async applyEditedKeywords(keywords: string[]) {
        try {
            if (!keywords || keywords.length === 0) return;
            if (this.working) return;
            this.working = true;

            this.currentPage = 1;
            this.pageCache.clear();
            const searchQuery = keywords.join(' AND ');
            this.lastSearchQuery = searchQuery;

            this.showLoading('Searching...');

            const res = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    searchQuery,
                    perPage: this.perPage,
                    page: 1,
                    language: this.config.language || 'en'
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || `Request failed with ${res.status}`);
            }

            const data = await res.json();
            this.perPage = data?.perPage || this.perPage;
            this.currentPage = data?.page || 1;
            this.lastSearchQuery = data?.searchQuery || searchQuery;
            this.pageCache.set(this.currentPage, data);

            this.hideLoading();
            this.showCitationModal(data, this.lastSelectedTextKey || '');
        } catch (e: any) {
            this.config.notify?.(e?.message || 'Failed to update keywords');
        } finally {
            this.hideLoading();
            this.working = false;
        }
    }

    private async openCitations() {
        try {
            if (this.working) return;
            // If we have cached data for current page, show it
            const cached = this.pageCache.get(this.currentPage);
            if (cached) {
                this.showCitationModal(cached, this.lastSelectedTextKey || '');
                return;
            }

            // If we have a lastSearchQuery, fetch first page
            if (this.lastSearchQuery) {
                this.working = true;
                this.showLoading('Loading...');
                const res = await fetch(this.config.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        searchQuery: this.lastSearchQuery,
                        perPage: this.perPage,
                        page: 1,
                        language: this.config.language || 'en'
                    })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error || `Request failed with ${res.status}`);
                }
                const data = await res.json();
                this.perPage = data?.perPage || this.perPage;
                this.currentPage = data?.page || 1;
                this.lastSearchQuery = data?.searchQuery || this.lastSearchQuery;
                this.pageCache.set(this.currentPage, data);
                this.hideLoading();
                this.showCitationModal(data, this.lastSelectedTextKey || '');
                return;
            }

            // Otherwise, open an empty modal encouraging keyword edit
            const emptyData = {
                keywords: [],
                searchQuery: '',
                papers: [],
                totalFound: 0,
                page: 1,
                perPage: this.perPage,
            };
            this.showCitationModal(emptyData, '');
        } catch (e: any) {
            this.config.notify?.(e?.message || 'Failed to open citations');
        } finally {
            this.hideLoading();
            this.working = false;
        }
    }

    private createPaperCard(paper: any, index: number): HTMLDivElement {
        const card = document.createElement('div');
        card.className = 'group flex h-full flex-col overflow-visible rounded-xl border border-black/[0.07] bg-white/75 p-4 text-[#191918] shadow-[0_2px_10px_rgba(25,25,24,0.035)] transition-all duration-200 hover:-translate-y-px hover:bg-white hover:shadow-[0_8px_24px_rgba(25,25,24,0.08)] dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-[#f2f2ef] dark:hover:bg-white/[0.06]';

        // Remove manual hover listeners as we use Tailwind classes


        const title = document.createElement('h4');
        title.textContent = paper.title || 'Untitled';
        title.className = 'm-0 mb-2 text-[15px] font-semibold leading-6 tracking-[-0.01em] text-[#191918] dark:text-[#f2f2ef]';


        const authors = document.createElement('div');
        authors.className = 'mb-2 text-sm leading-5 text-black/55 dark:text-white/55';

        const authorNames = Array.isArray(paper.authors)
            ? paper.authors.map((a: any) => a?.name).filter(Boolean)
            : [];
        authors.textContent = authorNames.length > 3
            ? `${authorNames.slice(0, 3).join(', ')}, et al.`
            : (authorNames.join(', ') || 'Unknown authors');

        const metaInfo = document.createElement('div');
        metaInfo.className = 'mb-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/42 dark:text-white/42';


        if (paper.year) {
            const year = document.createElement('span');
            year.textContent = `Year: ${paper.year}`;
            metaInfo.appendChild(year);
        }

        if (paper.venue) {
            const venue = document.createElement('span');
            venue.textContent = `Publisher: ${paper.venue}`;
            metaInfo.appendChild(venue);
        }

        if (paper.citationCount !== undefined) {
            const citations = document.createElement('span');
            citations.textContent = `Citations: ${paper.citationCount}`;
            metaInfo.appendChild(citations);
        }

        const actions = document.createElement('div');
        actions.className = 'mt-auto flex flex-wrap gap-1.5';
        actions.style.cssText = `
            margin-top: auto;
        `;

        // Add Cite button
        const citeBtn = document.createElement('button');
        citeBtn.className = 'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#191918] bg-[#191918] px-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-black dark:border-[#f2f2ef] dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white';
        citeBtn.setAttribute('aria-label', `Cite ${paper.title || 'paper'}`);

        citeBtn.innerHTML = `<span class="icon" aria-hidden="true">${CITE_ICON_SVG}</span><span>Cite</span>`;

        citeBtn.onclick = () => this.insertCitation(paper);
        actions.appendChild(citeBtn);

        // Add Show Abstract button
        const abstractBtn = document.createElement('button');
        abstractBtn.setAttribute('data-abstract-btn', 'true');
        abstractBtn.className = 'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-black/[0.08] bg-transparent px-2.5 text-xs font-medium text-black/65 transition-colors hover:bg-black/[0.05] hover:text-[#191918] dark:border-white/[0.1] dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white';

        abstractBtn.innerHTML = `<span class="icon" aria-hidden="true">${ABSTRACT_ICON_SVG}</span><span>Abstract</span>`;
        abstractBtn.onclick = () => this.toggleAbstract(paper, card);
        actions.appendChild(abstractBtn);

        // Create content wrapper for main content
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
        `;

        contentWrapper.appendChild(title);
        contentWrapper.appendChild(authors);
        contentWrapper.appendChild(metaInfo);

        card.appendChild(contentWrapper);
        card.appendChild(actions);

        if (paper.url) {
            const viewBtn = document.createElement('a');
            viewBtn.href = paper.url;
            viewBtn.target = '_blank';
            viewBtn.rel = 'noreferrer';
            viewBtn.className = 'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-black/[0.08] bg-transparent px-2.5 text-xs font-medium text-black/65 no-underline transition-colors hover:bg-black/[0.05] hover:text-[#191918] dark:border-white/[0.1] dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white';
            viewBtn.setAttribute('aria-label', `Open ${paper.title || 'paper'} on the web`);
            viewBtn.innerHTML = `<span class="icon" aria-hidden="true">${OPEN_ICON_SVG}</span><span>Web</span>`;
            actions.appendChild(viewBtn);
        }

        if (paper.openAccessPdf?.url) {
            const pdfBtn = document.createElement('a');
            pdfBtn.href = paper.openAccessPdf.url;
            pdfBtn.target = '_blank';
            pdfBtn.rel = 'noreferrer';
            pdfBtn.className = 'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-black/[0.08] bg-transparent px-2.5 text-xs font-medium text-black/65 no-underline transition-colors hover:bg-black/[0.05] hover:text-[#191918] dark:border-white/[0.1] dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white';
            pdfBtn.setAttribute('aria-label', `Open PDF for ${paper.title || 'paper'}`);
            pdfBtn.innerHTML = `<span class="icon" aria-hidden="true">${FILE_ICON_SVG}</span><span>PDF</span>`;
            actions.appendChild(pdfBtn);
        }

        return card;
    }

    private async toggleAbstract(paper: any, card: HTMLDivElement) {
        const paperId = paper.paperId || paper.id;
        if (!paperId) {
            this.config.notify?.('Paper ID not available for abstract fetch');
            return;
        }

        // Check if abstract is already expanded
        const isExpanded = this.expandedAbstracts.has(paperId);
        const existingAbstract = card.querySelector('.abstract-container');

        if (isExpanded && existingAbstract) {
            // Collapse the abstract
            this.expandedAbstracts.delete(paperId);
            existingAbstract.remove();

            // Update button text
            const button = card.querySelector('button[data-abstract-btn="true"]') as HTMLButtonElement;
            if (button) {
                button.innerHTML = `<span class="icon" aria-hidden="true">${ABSTRACT_ICON_SVG}</span><span>Abstract</span>`;
            }
            return;
        }

        // Show the abstract
        try {
            // Update button to show loading state
            const button = card.querySelector('button[data-abstract-btn="true"]') as HTMLButtonElement;
            if (button) {
                button.disabled = true;
                button.innerHTML = `<span class="icon" aria-hidden="true">${ABSTRACT_ICON_SVG}</span><span>Loading...</span>`;
            }

            const abstract = await this.fetchAbstract(paperId);
            this.displayAbstract(paper, card, abstract);
            this.expandedAbstracts.add(paperId);

            // Update button text to hide state
            if (button) {
                button.disabled = false;
                button.innerHTML = `<span class="icon" aria-hidden="true">${CHEVRON_UP_ICON_SVG}</span><span>Hide</span>`;
            }
        } catch (error) {
            // Reset button on error
            const button = card.querySelector('button[data-abstract-btn="true"]') as HTMLButtonElement;
            if (button) {
                button.disabled = false;
                button.innerHTML = `<span class="icon" aria-hidden="true">${ABSTRACT_ICON_SVG}</span><span>Show Abstract</span>`;
            }
            this.config.notify?.(`Failed to fetch abstract: ${(error as Error).message}`);
        }
    }

    private async fetchAbstract(paperId: string): Promise<string> {
        // Check cache first
        const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
        const cached = this.abstractCache.get(paperId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.abstract;
        }

        // Check if already loading
        if (this.abstractLoadingStates.get(paperId)) {
            throw new Error('Abstract is already being fetched');
        }

        // Add small delay to prevent rapid-fire requests
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            this.abstractLoadingStates.set(paperId, true);

            const response = await fetch('/api/outliner/abstract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paperId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                // Provide user-friendly error messages
                let userMessage = 'Failed to fetch abstract';
                if (response.status === 404) {
                    userMessage = 'Paper not found';
                } else if (response.status === 403) {
                    userMessage = 'Access denied to abstract';
                } else if (response.status === 429) {
                    userMessage = 'Too many requests. Please try again in a moment.';
                } else if (response.status >= 500) {
                    userMessage = 'Server error. Please try again later.';
                }

                throw new Error(errorData.error || userMessage);
            }

            const data = await response.json();
            const abstract = data.abstract || 'No abstract available for this paper.';

            // Cache the result
            this.abstractCache.set(paperId, { abstract, timestamp: Date.now() });

            return abstract;
        } catch (error) {
            // Log the error for debugging but throw user-friendly message
            console.error('Error fetching abstract for paper:', paperId, error);

            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error('Unexpected error occurred while fetching abstract');
            }
        } finally {
            this.abstractLoadingStates.delete(paperId);
        }
    }

    private displayAbstract(paper: any, card: HTMLDivElement, abstract: string) {
        // Remove any existing abstract
        const existingAbstract = card.querySelector('.abstract-container');
        if (existingAbstract) {
            existingAbstract.remove();
        }

        // Create abstract container
        const abstractContainer = document.createElement('div');
        abstractContainer.className = 'abstract-container mt-3 p-3 rounded-md border-t bg-muted/30 border-border';


        const abstractLabel = document.createElement('h4');
        abstractLabel.className = 'text-sm font-semibold mb-2 m-0 text-foreground';

        abstractLabel.textContent = 'Abstract';

        const abstractText = document.createElement('p');
        abstractText.className = 'text-sm leading-relaxed m-0 text-muted-foreground break-words';

        abstractText.textContent = abstract;

        abstractContainer.appendChild(abstractLabel);
        abstractContainer.appendChild(abstractText);

        // Insert before the actions div
        const actions = card.querySelector('.flex.gap-2.flex-wrap.mt-auto');
        if (actions && actions.parentNode) {
            actions.parentNode.insertBefore(abstractContainer, actions);
        } else {
            card.appendChild(abstractContainer);
        }
    }

    private closeModal() {
        if (this.modal) {
            try {
                document.body.removeChild(this.modal);
            } catch { }
            this.modal = null;
        }

        // Also remove any other citation modals that might exist
        const existingModals = document.querySelectorAll('[data-citation-modal="true"]');
        existingModals.forEach(modal => {
            try {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            } catch { }
        });
    }

    private showLoading(message: string = 'Loading...') {
        try {
            if (this.loadingOverlay) return;

            // Remove any existing loading overlays to prevent multiple layers
            const existingOverlays = document.querySelectorAll('[data-citation-loading="true"]');
            existingOverlays.forEach(overlay => {
                try {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                } catch { }
            });

            const overlay = document.createElement('div');
            overlay.setAttribute('data-citation-loading', 'true');
            overlay.className = 'fixed inset-0 flex items-center justify-center z-50 font-sans bg-black/80';


            const box = document.createElement('div');
            box.className = 'flex items-center gap-3 rounded-md px-4 py-3 bg-background border shadow-lg text-foreground';


            const spinner = document.createElement('div');
            spinner.className = 'w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin';


            const text = document.createElement('span');
            text.textContent = message;
            text.className = 'font-medium';


            const style = document.createElement('style');
            style.textContent = `@keyframes outliner-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;

            box.appendChild(spinner);
            box.appendChild(text);
            overlay.appendChild(style);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            this.loadingOverlay = overlay;
        } catch { }
    }

    private hideLoading() {
        try {
            if (this.loadingOverlay) {
                document.body.removeChild(this.loadingOverlay);
                this.loadingOverlay = null;
            }

            // Also remove any other loading overlays that might exist
            const existingOverlays = document.querySelectorAll('[data-citation-loading="true"]');
            existingOverlays.forEach(overlay => {
                try {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                } catch { }
            });
        } catch { }
    }

    private async getCurrentBlockInfo(): Promise<{ currentBlockIndex: number; currentBlock: any } | null> {
        try {
            // Method 1: Try getCurrentBlockIndex
            let currentBlockIndex = -1;
            try {
                currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
                if (currentBlockIndex >= 0) {
                    const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
                    if (currentBlock) {
                        console.log('Method 1 success:', { currentBlockIndex, currentBlock });
                        return { currentBlockIndex, currentBlock };
                    }
                }
            } catch (error) {
                console.warn('getCurrentBlockIndex failed:', error);
            }

            // Method 2: Try getCurrentBlock
            try {
                const currentBlock = this.api.blocks.getCurrentBlock();
                if (currentBlock && currentBlock.id) {
                    // Find the block index by ID
                    const blocksCount = this.api.blocks.getBlocksCount();
                    for (let i = 0; i < blocksCount; i++) {
                        try {
                            const block = this.api.blocks.getBlockByIndex(i);
                            if (block && block.id === currentBlock.id) {
                                console.log('Method 2 success:', { currentBlockIndex: i, currentBlock });
                                return { currentBlockIndex: i, currentBlock };
                            }
                        } catch (e) {
                            // Continue to next block
                        }
                    }
                }
            } catch (error) {
                console.warn('getCurrentBlock failed:', error);
            }

            // Method 3: Try to get from selection
            try {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const container = range.commonAncestorContainer;
                    // Find the closest paragraph element
                    let paragraphElement: Element | null = container.nodeType === Node.ELEMENT_NODE ? container as Element : (container.parentElement as Element | null);
                    while (paragraphElement && paragraphElement.tagName !== 'P') {
                        paragraphElement = paragraphElement.parentElement as Element | null;
                    }
                    if (paragraphElement) {
                        // Try to find the block index by traversing up to find the EditorJS container
                        let editorContainer: Element | null = paragraphElement;
                        while (editorContainer && !editorContainer.classList.contains('codex-editor')) {
                            editorContainer = editorContainer.parentElement as Element | null;
                        }
                        if (editorContainer) {
                            // This is a simplified approach - in practice, you might need more sophisticated block finding
                            return null;
                        }
                    }
                }
            } catch (error) {
                console.warn('Selection-based method failed:', error);
            }

            // Method 4: Try to get from document directly (fallback)
            try {
                // If we have a document, try to find the last paragraph block
                const doc = this.config.getDocument ? await this.config.getDocument() : null;
                if (doc && Array.isArray(doc.blocks)) {
                    // Find the last paragraph block
                    for (let i = doc.blocks.length - 1; i >= 0; i--) {
                        const block = doc.blocks[i];
                        if (block && block.type === 'paragraph') {
                            console.log('Method 4 success (fallback to last paragraph):', { currentBlockIndex: i, currentBlock: block });
                            return { currentBlockIndex: i, currentBlock: block };
                        }
                    }
                }
            } catch (error) {
                console.warn('Document fallback method failed:', error);
            }

            console.warn('All methods failed to get current block info');
            return null;
        } catch (error) {
            console.error('Error in getCurrentBlockInfo:', error);
            return null;
        }
    }

    private async insertCitation(paper: any) {
        try {
            // Citation text content using only last name
            const authorLastName = this.getAuthorLastName(paper);
            const citationTextCore = `(${authorLastName}, ${paper.year || 'n.d.'})`;

            // First try DOM-level insertion at the saved selection (skip if forced block placement)
            const insertedViaDom = this.forceBlockPlacement ? false : this.insertCitationAtSavedSelection(citationTextCore, paper);

            if (!insertedViaDom) {
                // Fallback to block-level insertion (end of current paragraph)
                const doc = await this.config.getDocument();
                if (!doc || !Array.isArray(doc.blocks)) {
                    this.config.notify?.('Failed to get document for citation insertion');
                    return;
                }

                const paperJson = encodeURIComponent(JSON.stringify(paper));
                const paperId = paper.paperId || paper.title;
                const citationHtmlCore = `<cite class="inline-citation" data-paper-id="${paperId.replace(/"/g, '&quot;')}" data-paper-json="${paperJson}" contenteditable="false" title="Double click to edit">${citationTextCore}</cite>`;

                const currentBlockInfo = await this.getCurrentBlockInfo();
                if (!currentBlockInfo) {
                    // No focused block (likely opened from toolbar). Insert a new paragraph at end with the citation.
                    try {
                        const blocksCount = typeof this.api.blocks.getBlocksCount === 'function' ? this.api.blocks.getBlocksCount() : (Array.isArray(doc.blocks) ? doc.blocks.length : 0);
                        this.api.blocks.insert('paragraph', { text: citationHtmlCore }, {}, blocksCount);
                    } catch (e) {
                        console.error('Failed to insert citation at end of document:', e);
                        this.config.notify?.('Failed to insert citation at end of document.');
                        return;
                    }
                } else {
                    const { currentBlockIndex } = currentBlockInfo;
                    const docBlock = doc.blocks[currentBlockIndex];
                    if (!docBlock || docBlock.type !== 'paragraph' || !docBlock.data) {
                        // If not a paragraph, append a new paragraph at end instead
                        try {
                            const blocksCount = typeof this.api.blocks.getBlocksCount === 'function' ? this.api.blocks.getBlocksCount() : (Array.isArray(doc.blocks) ? doc.blocks.length : 0);
                            this.api.blocks.insert('paragraph', { text: citationHtmlCore }, {}, blocksCount);
                        } catch (e) {
                            console.error('Failed to insert citation at end of document:', e);
                            this.config.notify?.('Failed to insert citation at end of document.');
                            return;
                        }
                    } else {
                        let currentText = '';
                        if (docBlock.data && typeof docBlock.data === 'object') {
                            currentText = docBlock.data.text || '';
                        } else if (typeof docBlock.data === 'string') {
                            currentText = docBlock.data;
                        }

                        // Place citation before a trailing period (ignoring trailing whitespace), else append with space
                        let rightTrimmed = currentText.replace(/[\s\u00A0]+$/g, '');
                        if (rightTrimmed.endsWith('.')) {
                            const withoutPeriod = rightTrimmed.slice(0, -1).replace(/[\s\u00A0]+$/g, '');
                            const needsSpace = withoutPeriod.endsWith(' ') ? '' : ' ';
                            let newText = `${withoutPeriod}${needsSpace}${citationHtmlCore}.`;
                            currentText = newText; // override fully
                        } else if (rightTrimmed.endsWith(')') && rightTrimmed.includes('(')) {
                            const lastParenIndex = rightTrimmed.lastIndexOf('(');
                            const beforeCitation = rightTrimmed.substring(0, lastParenIndex).replace(/[\s\u00A0]+$/g, '');
                            const existingCitation = rightTrimmed.substring(lastParenIndex);
                            const newText = `${beforeCitation} ${citationHtmlCore} ${existingCitation}`;
                            currentText = newText;
                        } else {
                            const needsSpace = rightTrimmed.endsWith(' ') ? '' : ' ';
                            const newText = `${rightTrimmed}${needsSpace}${citationHtmlCore}`;
                            currentText = newText;
                        }

                        try {
                            const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
                            if (currentBlock && currentBlock.id) {
                                this.api.blocks.update(currentBlock.id, { text: currentText });
                            } else {
                                this.api.blocks.update(currentBlockIndex, { text: currentText });
                            }
                        } catch (error) {
                            console.warn('Block update failed, using fallback method:', error);
                            try {
                                const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
                                if (currentBlock && currentBlock.id) {
                                    this.api.blocks.delete(currentBlock.id);
                                    this.api.blocks.insert('paragraph', { text: currentText }, {}, currentBlockIndex);
                                } else {
                                    this.api.blocks.delete(currentBlockIndex);
                                    this.api.blocks.insert('paragraph', { text: currentText }, {}, currentBlockIndex);
                                }
                            } catch (fallbackError) {
                                console.error('Fallback method also failed:', fallbackError);
                                this.config.notify?.('Failed to update block. Please try again.');
                                return;
                            }
                        }
                    }
                }
            }

            // Reset force flag after operation
            this.forceBlockPlacement = false;

            // Trigger document change so bibliography display updates automatically
            window.dispatchEvent(new CustomEvent('outliner-document-changed'));

            // Close modal and notify user
            this.closeModal();
            this.config.notify?.('Citation added successfully');

        } catch (error) {
            console.error('Error inserting citation:', error);
            this.config.notify?.('Failed to insert citation: ' + (error as Error).message);
        }
    }

    private getAuthorLastName(paper: any): string {
        try {
            const full = paper?.authors?.[0]?.name || 'Unknown';
            const base = full.includes(',') ? full.split(',')[0] : full;
            const parts = (base || '').trim().split(/\s+/).filter(Boolean);
            const last = parts.length > 0 ? parts[parts.length - 1] : (base || '').trim();
            return last || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }

    private insertCitationAtSavedSelection(citationTextCore: string, paper: any): boolean {
        try {
            if (!this.savedSelectionRange) return false;

            const selection = window.getSelection();
            if (!selection) return false;
            selection.removeAllRanges();
            selection.addRange(this.savedSelectionRange);

            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (!range) return false;

            // Determine spacing before citation
            let needsLeadingSpace = true;
            let endContainer = range.endContainer;
            let endOffset = range.endOffset;

            const makeNode = (txt: string) => {
                if (txt.includes(citationTextCore)) {
                    const cite = document.createElement('cite');
                    cite.className = 'inline-citation';
                    cite.setAttribute('data-paper-id', paper.paperId || paper.title);
                    cite.setAttribute('data-paper-json', encodeURIComponent(JSON.stringify(paper)));
                    cite.setAttribute('contenteditable', 'false');
                    cite.title = 'Double click to edit';
                    
                    const trimmed = txt.trim();
                    const leading = txt.startsWith(' ') ? ' ' : '';
                    const trailing = txt.endsWith(' ') ? ' ' : '';
                    cite.textContent = trimmed;
                    
                    if (leading || trailing) {
                        const frag = document.createDocumentFragment();
                        if (leading) frag.appendChild(document.createTextNode(' '));
                        frag.appendChild(cite);
                        if (trailing) frag.appendChild(document.createTextNode(' '));
                        return frag;
                    }
                    return cite;
                }
                return document.createTextNode(txt);
            };

            const insertAndMoveCaretAfter = (node: Node) => {
                // Move caret after inserted node
                try {
                    const newRange = document.createRange();
                    if (node.nodeType === Node.TEXT_NODE) {
                        newRange.setStart(node, (node as Text).data.length);
                        newRange.setEnd(node, (node as Text).data.length);
                    } else {
                        newRange.setStartAfter(node);
                        newRange.setEndAfter(node);
                    }
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } catch { }
            };

            const getEditableAncestor = (node: Node): HTMLElement | null => {
                const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node.parentElement as Element | null);
                return el ? (el.closest('[contenteditable="true"]') as HTMLElement | null) : null;
            };

            if (endContainer.nodeType === Node.TEXT_NODE) {
                const textNode = endContainer as Text;
                const data = textNode.data;
                const charBefore = endOffset > 0 ? data[endOffset - 1] : '';
                needsLeadingSpace = !(charBefore && /\s/.test(charBefore));

                // If selection already includes the period (previous char is '.'), insert before that period
                if (endOffset > 0 && data[endOffset - 1] === '.') {
                    const before = data.slice(0, endOffset - 1).replace(/[\s\u00A0]+$/g, '');
                    const after = data.slice(endOffset - 1); // starts with '.'

                    textNode.data = before;

                    const citationText = `${before.endsWith(' ') ? '' : ' '}${citationTextCore}`;
                    const citationNode = makeNode(citationText);

                    if (textNode.parentNode) {
                        textNode.parentNode.insertBefore(citationNode, textNode.nextSibling);
                        const afterNode = document.createTextNode(after);
                        textNode.parentNode.insertBefore(afterNode, citationNode.nextSibling);
                        insertAndMoveCaretAfter(citationNode);
                    }
                }
                // Else if immediate next char is a period (or whitespace then period), insert before it
                else if (endOffset < data.length && /^(?:[\s\u00A0]*\.)/.test(data.slice(endOffset))) {
                    const before = data.slice(0, endOffset);
                    const after = data.slice(endOffset); // may start with spaces and then '.'

                    // Replace current text node with before part
                    textNode.data = before;

                    const citationText = `${needsLeadingSpace ? ' ' : ''}${citationTextCore}`;
                    const citationNode = makeNode(citationText);

                    // Insert citation then the remaining text (which begins with '.')
                    if (textNode.parentNode) {
                        textNode.parentNode.insertBefore(citationNode, textNode.nextSibling);
                        const afterNode = document.createTextNode(after);
                        textNode.parentNode.insertBefore(afterNode, citationNode.nextSibling);
                        insertAndMoveCaretAfter(citationNode);
                    }
                } else {
                    // Insert at selection end
                    const citationText = `${needsLeadingSpace ? ' ' : ''}${citationTextCore}`;
                    const citationNode = makeNode(citationText);
                    range.collapse(false);
                    range.insertNode(citationNode);
                    insertAndMoveCaretAfter(citationNode);
                }
            } else {
                // Non-text end container. Try to inspect the next sibling for a period
                const parent = endContainer as Element;
                const next = parent.childNodes[endOffset] || parent.nextSibling;
                let inserted = false;
                if (next && next.nodeType === Node.TEXT_NODE) {
                    const nextText = next as Text;
                    const startsWithPeriod = /^(?:[\s\u00A0]*\.)/.test(nextText.data);
                    const prevChar = (() => {
                        const prevNode = parent.childNodes[endOffset - 1];
                        if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
                            const t = (prevNode as Text).data;
                            return t[t.length - 1] || '';
                        }
                        return '';
                    })();
                    needsLeadingSpace = !(prevChar && /\s/.test(prevChar));

                    const citationText = `${needsLeadingSpace ? ' ' : ''}${citationTextCore}`;
                    const citationNode = makeNode(citationText);
                    if (startsWithPeriod) {
                        parent.insertBefore(citationNode, next);
                        inserted = true;
                        insertAndMoveCaretAfter(citationNode);
                    }
                }
                if (!inserted) {
                    const citationText = ` ${citationTextCore}`;
                    const citationNode = makeNode(citationText);
                    range.collapse(false);
                    range.insertNode(citationNode);
                    insertAndMoveCaretAfter(citationNode);
                }
            }

            // Inform EditorJS of DOM changes by dispatching input on the nearest contenteditable
            try {
                const editable = getEditableAncestor(endContainer);
                if (editable) {
                    const evt = new InputEvent('input', { bubbles: true, cancelable: true, composed: true });
                    editable.dispatchEvent(evt);
                }
            } catch { }

            return true;
        } catch (e) {
            console.warn('Failed DOM insertion, will fallback to block update:', e);
            return false;
        } finally {
            // Do not clear savedSelectionRange so subsequent cites can still use it if needed
        }
    }

    public async updateBibliographyDisplay() {
        try {
            const container = document.getElementById('bibliography-container');
            if (!container) return;

            // Find all unique citations in the editor
            const citations = Array.from(document.querySelectorAll('.editor-container .inline-citation'));
            const paperMap = new Map<string, any>();
            
            citations.forEach(el => {
                const id = el.getAttribute('data-paper-id');
                const json = el.getAttribute('data-paper-json');
                if (id && json && !paperMap.has(id)) {
                    try {
                        const decoded = decodeURIComponent(json);
                        paperMap.set(id, JSON.parse(decoded));
                    } catch (e) {
                        // fallback if not url encoded
                        try { paperMap.set(id, JSON.parse(json)); } catch {}
                    }
                }
            });

            // Get existing bibliography to preserve manual edits
            const existingRefs = Array.from(container.querySelectorAll('.reference-entry'));
            const existingMap = new Map<string, Element>();
            existingRefs.forEach(ref => {
                const id = ref.getAttribute('data-paper-id');
                if (id) existingMap.set(id, ref);
            });

            container.innerHTML = '';
            
            if (paperMap.size === 0) {
                const placeholder = document.createElement('p');
                placeholder.setAttribute('data-bibliography-placeholder', 'true');
                placeholder.className = 'italic text-center py-5 px-5 m-0 text-muted-foreground/60';
                placeholder.textContent = 'Citations will appear here as you add them to your document using the citation tool.';
                container.appendChild(placeholder);
                return;
            }

            // For each paper in the document, add it to bibliography
            Array.from(paperMap.values()).forEach(paper => {
                const paperId = paper.paperId || paper.title;
                if (existingMap.has(paperId)) {
                    // keep existing (which might have been manually edited)
                    container.appendChild(existingMap.get(paperId)!);
                } else {
                    // create new
                    this.addReferenceToDisplay(container, this.formatReference(paper), paperId);
                }
            });
            
            this.sortBibliographyDisplay(container);

        } catch (error) {
            console.error('Error updating bibliography display:', error);
        }
    }

    private addReferenceToDisplay(container: HTMLElement, reference: { text: string; url?: string }, paperId: string) {
        // Create new reference entry with custom CSS variables
        const referenceDiv = document.createElement('div');
        referenceDiv.className = 'reference-entry mb-4';
        referenceDiv.setAttribute('data-paper-id', paperId);

        const referenceTextElement = document.createElement('p');
        referenceTextElement.className = 'm-0 text-foreground';
        referenceTextElement.title = 'Double click to edit';


        // Add the main text portion
        referenceTextElement.appendChild(document.createTextNode(reference.text));

        // If a DOI/URL exists, append it as a clickable link
        if (reference.url) {
            const spacer = document.createTextNode(' Retrieved from ');
            const link = document.createElement('a');
            link.href = reference.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = reference.url;
            link.className = 'text-primary underline break-words';

            referenceTextElement.appendChild(spacer);
            referenceTextElement.appendChild(link);
        }

        referenceDiv.appendChild(referenceTextElement);
        container.appendChild(referenceDiv);

        // Extra safety: schedule a cleanup in case of race with updater
        setTimeout(() => {
            try { this.removeBibliographyPlaceholders(container); } catch { }
        }, 0);
    }

    private sortBibliographyDisplay(container: HTMLElement) {
        try {
            // Get all reference entries
            const references = Array.from(container.querySelectorAll('.reference-entry'));
            if (references.length <= 1) return; // No need to sort

            // Sort references alphabetically
            references.sort((a, b) => {
                const textA = a.textContent || '';
                const textB = b.textContent || '';
                return textA.localeCompare(textB);
            });

            // Clear container and re-add sorted references
            const placeholder = container.querySelector('[data-bibliography-placeholder="true"]');
            container.innerHTML = '';

            // Re-add placeholder if it was there
            if (placeholder) {
                container.appendChild(placeholder);
            }

            // Add sorted references
            references.forEach(ref => {
                container.appendChild(ref);
            });

        } catch (error) {
            console.error('Error sorting bibliography display:', error);
        }
    }

    private formatReference(paper: any): { text: string; url?: string } {
        const authorsArray: string[] = Array.isArray(paper.authors)
            ? paper.authors.map((a: any) => a?.name || '').filter(Boolean)
            : [];

        const formattedAuthors = this.formatAuthors(authorsArray) || 'Unknown authors';
        const year = paper.year || 'n.d.';
        const title = paper.title || 'Untitled';
        const venue = paper.venue || '';
        const url = paper.url || '';

        let text = `${formattedAuthors} (${year}). ${title}`;
        if (venue) {
            text += `. ${venue}`;
        }

        return { text, url: url || undefined };
    }

    private formatAuthors(authorNames: string[]): string {
        if (!authorNames || authorNames.length === 0) return '';

        const formatSingle = (fullName: string): string => {
            try {
                if (!fullName) return '';
                let last = '';
                let first = '';

                if (fullName.includes(',')) {
                    const [lastPart, firstPart] = fullName.split(',');
                    last = (lastPart || '').trim();
                    first = (firstPart || '').trim().split(/\s+/)[0] || '';
                } else {
                    const parts = fullName.trim().split(/\s+/).filter(Boolean);
                    if (parts.length === 1) {
                        last = parts[0];
                    } else {
                        first = parts[0];
                        last = parts[parts.length - 1];
                    }
                }

                const initial = first ? `${first[0].toUpperCase()}.` : '';
                return last ? `${last}, ${initial}`.trim() : fullName;
            } catch {
                return fullName;
            }
        };

        const maxAuthors = 3;
        const limited = authorNames.slice(0, maxAuthors).map(formatSingle);
        const etAl = authorNames.length > maxAuthors ? 'et al.' : '';
        return [
            ...limited,
            ...(etAl ? [etAl] : [])
        ].join(', ');
    }



    private removeBibliographyPlaceholders(container: HTMLElement) {
        try {
            const selectors = [
                '[data-bibliography-placeholder="true"]',
                '.text-gray-500.italic',
                'p.italic',
                'p[style*="opacity"]'
            ];
            const seen = new Set<Element>();
            selectors.forEach(sel => {
                container.querySelectorAll(sel).forEach(el => {
                    if (!seen.has(el)) {
                        seen.add(el);
                        el.remove();
                    }
                });
            });
        } catch { }
    }

    // Cleanup method to be called when the tool is destroyed
    destroy() {
        try {
            this.closeModal();
            this.hideLoading();
            // Clear any references
            this.savedSelectionRange = null;
            this.pageCache.clear();
            this.lastSearchQuery = null;
            this.lastSelectedTextKey = null;
            // Clear abstract-related properties
            this.abstractCache.clear();
            this.expandedAbstracts.clear();
            this.abstractLoadingStates.clear();
        } catch { }
    }
}
