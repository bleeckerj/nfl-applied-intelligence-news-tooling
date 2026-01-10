/**
 * InDesign Asset Navigator
 * Renders page layouts directly from structured JSON
 * No PDF required - generates visual from bounds data
 */

// State
const state = {
    jsonData: null,
    currentPage: 1,
    totalPages: 0,
    scale: 0.65, // Scale factor for display
    pageItemsMap: new Map(),
    pageDimensions: new Map(),
    selectedFrame: null,
    xOffset: 0, // Calculated X coordinate offset
    imageFiles: new Map(), // filename -> object URL for loaded images
    jsonBasePath: null // Base path for loading thumbnails relative to JSON
};

// DOM Elements
const jsonInput = document.getElementById('json-input');
const jsonName = document.getElementById('json-name');
const jsonUrlInput = document.getElementById('json-url');
const loadUrlBtn = document.getElementById('load-url-btn');
const imagesInput = document.getElementById('images-input');
const imagesStatus = document.getElementById('images-status');
const pageView = document.getElementById('page-view');
const detailsPanel = document.getElementById('details-panel');
const pageSelect = document.getElementById('page-select');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const searchInput = document.getElementById('search-input');
const emptyState = document.getElementById('empty-state');

// Debug: log which elements were found
console.log('DOM Elements loaded:', {
    jsonInput: !!jsonInput,
    jsonName: !!jsonName,
    jsonUrlInput: !!jsonUrlInput,
    imagesInput: !!imagesInput,
    pageView: !!pageView,
    pageSelect: !!pageSelect
});

// Event Listeners
if (jsonInput) {
    jsonInput.addEventListener('change', handleJsonUpload);
} else {
    console.error('jsonInput element not found!');
}

if (loadUrlBtn) {
    loadUrlBtn.addEventListener('click', handleUrlLoad);
}

if (jsonUrlInput) {
    jsonUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUrlLoad();
    });
    
    // Check for URL parameter on page load
    const urlParams = new URLSearchParams(window.location.search);
    const jsonParam = urlParams.get('json');
    if (jsonParam) {
        // If path doesn't start with ../ or /, assume it's relative to project root
        // and we need to go up from /tools/asset-navigator/
        let adjustedPath = jsonParam;
        if (!jsonParam.startsWith('/') && !jsonParam.startsWith('../') && !jsonParam.startsWith('http')) {
            adjustedPath = '../../' + jsonParam;
        }
        jsonUrlInput.value = adjustedPath;
        handleUrlLoad();
    }
}

if (imagesInput) {
    imagesInput.addEventListener('change', handleImagesFolder);
}

if (pageSelect) {
    pageSelect.addEventListener('change', () => goToPage(parseInt(pageSelect.value)));
}

if (prevBtn) {
    prevBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
}

if (nextBtn) {
    nextBtn.addEventListener('click', () => goToPage(state.currentPage + 1));
}

if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
}

// Layer visibility toggles
const toggleImage = document.getElementById('toggle-image');
const toggleText = document.getElementById('toggle-text');
const toggleHeadline = document.getElementById('toggle-headline');

function updateLayerVisibility() {
    const showImage = toggleImage?.checked ?? true;
    const showText = toggleText?.checked ?? true;
    const showHeadline = toggleHeadline?.checked ?? true;
    
    document.querySelectorAll('.frame.image').forEach(f => {
        f.style.display = showImage ? '' : 'none';
    });
    document.querySelectorAll('.frame.text').forEach(f => {
        f.style.display = showText ? '' : 'none';
    });
    document.querySelectorAll('.frame.headline').forEach(f => {
        f.style.display = showHeadline ? '' : 'none';
    });
}

if (toggleImage) toggleImage.addEventListener('change', updateLayerVisibility);
if (toggleText) toggleText.addEventListener('change', updateLayerVisibility);
if (toggleHeadline) toggleHeadline.addEventListener('change', updateLayerVisibility);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.target === searchInput) return;
    if (e.key === 'ArrowLeft') goToPage(state.currentPage - 1);
    if (e.key === 'ArrowRight') goToPage(state.currentPage + 1);
});

// Drag and drop
setupDragAndDrop();

/**
 * Load JSON from a URL path
 */
async function handleUrlLoad() {
    const path = jsonUrlInput?.value?.trim();
    if (!path) return;
    
    jsonName.textContent = 'Loading...';
    
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract base path from URL for thumbnail loading
        // e.g., "folder/subfolder/file.json" -> "folder/subfolder"
        const basePath = path.substring(0, path.lastIndexOf('/')) || '.';
        
        state.jsonData = data;
        state.jsonBasePath = basePath;
        
        const filename = path.split('/').pop();
        jsonName.textContent = filename;
        jsonName.classList.add('loaded');
        
        processJsonData();
        renderCurrentPage();
        
        console.log('Loaded JSON from:', path);
        console.log('Base path for thumbnails:', basePath);
    } catch (err) {
        console.error('Failed to load JSON:', err);
        jsonName.textContent = `Error: ${err.message}`;
        jsonName.classList.remove('loaded');
    }
}

/**
 * Handle images folder selection
 * Creates object URLs for each image file for display
 */
function handleImagesFolder(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Build a map of filename -> object URL
    state.imageFiles = new Map();
    let count = 0;
    
    for (const file of files) {
        // Only process image files
        if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|tif|tiff|psd|ai|eps|pdf)$/i.test(file.name)) {
            const filename = file.name;
            state.imageFiles.set(filename, URL.createObjectURL(file));
            count++;
        }
    }
    
    imagesStatus.textContent = `✓ ${count} images loaded`;
    imagesStatus.classList.add('loaded');
    
    // Re-render to show images
    if (state.jsonData) {
        renderCurrentPage();
    }
}

/**
 * Handle JSON file upload
 */
function handleJsonUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    loadJsonFile(file);
}

function loadJsonFile(file, basePath = null) {
    jsonName.textContent = file.name;
    jsonName.classList.add('loaded');
    
    // Store base path for loading thumbnails
    // If served from same directory, thumbnails can be loaded relatively
    state.jsonBasePath = basePath || '.';

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            state.jsonData = JSON.parse(event.target.result);
            processJsonData();
            renderCurrentPage();
        } catch (err) {
            console.error('JSON parse error:', err);
            jsonName.textContent = 'Error parsing JSON: ' + err.message;
            jsonName.classList.remove('loaded');
        }
    };
    reader.readAsText(file);
}

/**
 * Process JSON data and build page maps
 */
function processJsonData() {
    state.pageItemsMap.clear();
    state.pageDimensions.clear();
    state.xOffset = 0; // Will be calculated from actual content bounds

    if (!state.jsonData) return;

    // Extract page dimensions
    const pageDims = state.jsonData.metadata?.pageDimensions || {};
    for (const [pageNum, dims] of Object.entries(pageDims)) {
        state.pageDimensions.set(parseInt(pageNum), dims);
    }

    // First pass: find the minimum X coordinate across all content
    // InDesign often uses spread coordinates where left pages have negative X
    let minX = Infinity;
    const articles = state.jsonData.articles || [];
    
    for (const article of articles) {
        if (article.frames) {
            for (const frame of article.frames) {
                if (frame.bounds) {
                    const [y1, x1, y2, x2] = frame.bounds;
                    minX = Math.min(minX, x1, x2);
                }
            }
        }
        if (article.components) {
            for (const comp of article.components) {
                if (comp.bounds) {
                    const [y1, x1, y2, x2] = comp.bounds;
                    minX = Math.min(minX, x1, x2);
                }
            }
        }
    }
    
    // Set offset to shift content into positive coordinate space
    // If minX is -734, we add 734 to shift content to start at 0
    state.xOffset = minX < 0 ? Math.abs(minX) : 0;
    console.log('Detected X offset:', state.xOffset, '(minX was', minX, ')');

    // Determine total pages
    const pageNumbers = new Set();

    // Process articles (reuse the articles variable from above)
    for (const article of articles) {
        // Process text frames
        if (article.frames) {
            for (const frame of article.frames) {
                // Skip empty text frames (no content)
                if (!frame.content || frame.content.trim() === '') continue;
                
                const pageNum = parseInt(frame.page, 10);
                pageNumbers.add(pageNum);
                
                if (!state.pageItemsMap.has(pageNum)) {
                    state.pageItemsMap.set(pageNum, []);
                }
                
                state.pageItemsMap.get(pageNum).push({
                    type: 'text',
                    subtype: 'Body Text',
                    content: frame.content,
                    bounds: frame.bounds,
                    articleId: article.id,
                    fullText: article.full_text
                });
            }
        }

        // Process components (images, headlines, etc.)
        if (article.components) {
            for (const comp of article.components) {
                const pageNum = parseInt(comp.page, 10);
                pageNumbers.add(pageNum);
                
                if (!state.pageItemsMap.has(pageNum)) {
                    state.pageItemsMap.set(pageNum, []);
                }

                const isImage = comp.type === 'Image/Graphic';
                const isHeadline = comp.type?.includes('Headline') || comp.type?.includes('Byline');
                
                // Skip empty text components (but keep image frames even without linked content)
                if (!isImage && !comp.content) continue;

                state.pageItemsMap.get(pageNum).push({
                    type: isImage ? 'image' : (isHeadline ? 'headline' : 'text'),
                    subtype: comp.type,
                    content: comp.content,
                    bounds: comp.bounds,
                    articleId: article.id,
                    thumbnail: comp.thumbnail || null // From generate-thumbnails.mjs
                });
            }
        }
    }

    state.totalPages = Math.max(...pageNumbers, 0);
    state.currentPage = 1;

    // Populate page selector
    pageSelect.innerHTML = '';
    for (let i = 1; i <= state.totalPages; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Page ${i}`;
        const itemCount = state.pageItemsMap.get(i)?.length || 0;
        if (itemCount > 0) {
            opt.textContent += ` (${itemCount} items)`;
        }
        pageSelect.appendChild(opt);
    }

    updatePageNav();
}

/**
 * Render the current page
 */
function renderCurrentPage() {
    // Clear existing frames
    pageView.querySelectorAll('.frame').forEach(f => f.remove());
    pageView.classList.add('loaded');
    state.selectedFrame = null;

    if (!state.jsonData) return;

    // Get page dimensions
    const dims = state.pageDimensions.get(state.currentPage) || { width: 612, height: 792 };
    const pageWidth = dims.width;
    const pageHeight = dims.height;

    // Set page view size
    const displayWidth = pageWidth * state.scale;
    const displayHeight = pageHeight * state.scale;
    pageView.style.width = `${displayWidth}px`;
    pageView.style.height = `${displayHeight}px`;

    // Get items for this page
    const items = state.pageItemsMap.get(state.currentPage) || [];

    for (const item of items) {
        if (!item.bounds || item.bounds.length < 4) continue;

        const frame = document.createElement('div');
        frame.className = `frame ${item.type}`;

        // InDesign bounds format: [y1, x1, y2, x2] (NOT [x1, y1, x2, y2])
        // y1 = top, x1 = left, y2 = bottom, x2 = right
        // 
        // X coordinates are negative (spread coordinates). We shift by state.xOffset
        // which was calculated from the minimum X value across all content.
        let [y1, x1, y2, x2] = item.bounds;

        // Shift X coordinates using detected offset
        x1 = x1 + state.xOffset;
        x2 = x2 + state.xOffset;

        // Ensure proper ordering (in case of inverted values)
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);

        // Calculate dimensions
        const width = right - left;
        const height = bottom - top;

        // Skip tiny frames
        if (width < 10 || height < 10) continue;

        // Skip frames that are entirely outside the visible page
        if (right < 0 || bottom < 0 || left > pageWidth || top > pageHeight) continue;

        // Clamp to page bounds for display (handle any remaining bleed)
        const displayLeft = Math.max(0, left) * state.scale;
        const displayTop = Math.max(0, top) * state.scale;
        const displayRight = Math.min(pageWidth, right) * state.scale;
        const displayBottom = Math.min(pageHeight, bottom) * state.scale;

        // Apply scale
        frame.style.left = `${displayLeft}px`;
        frame.style.top = `${displayTop}px`;
        frame.style.width = `${displayRight - displayLeft}px`;
        frame.style.height = `${displayBottom - displayTop}px`;

        // For images, try to display the actual image (multiple fallback sources)
        if (item.type === 'image') {
            const filename = item.content ? item.content.split('/').pop() : null;
            let imageUrl = null;
            
            // Priority 1: User-loaded images folder
            if (filename && state.imageFiles.size > 0) {
                imageUrl = state.imageFiles.get(filename);
            }
            
            // Priority 2: Thumbnail from JSON (generated by generate-thumbnails.mjs)
            if (!imageUrl && item.thumbnail && state.jsonBasePath) {
                imageUrl = state.jsonBasePath + '/' + item.thumbnail;
                console.log('Thumbnail URL:', imageUrl, 'basePath:', state.jsonBasePath);
            }
            
            // Priority 3: Try loading directly from Links folder path (same-origin only)
            if (!imageUrl && item.content && item.content.startsWith('/')) {
                // Won't work due to browser security, but flag it for the indicator
                frame.dataset.imagePath = item.content;
            }
            
            // Debug: log what we found
            if (!imageUrl && item.thumbnail) {
                console.warn('No imageUrl for thumbnail:', item.thumbnail, 'jsonBasePath:', state.jsonBasePath);
            }
            
            if (imageUrl) {
                const img = document.createElement('img');
                img.className = 'frame-image';
                img.src = imageUrl;
                img.alt = filename || 'Image';
                img.onerror = () => {
                    // If image fails to load, show placeholder
                    img.style.display = 'none';
                    frame.classList.add('image-missing');
                };
                img.onload = () => {
                    frame.classList.add('image-loaded');
                };
                frame.appendChild(img);
            } else {
                // No image available - show visual indicator
                frame.classList.add(filename ? 'image-pending' : 'image-unlinked');
                const indicator = document.createElement('div');
                indicator.className = 'image-indicator';
                if (filename) {
                    indicator.innerHTML = `
                        <span class="image-icon">🖼️</span>
                        <span class="image-name">${filename}</span>
                    `;
                } else {
                    indicator.innerHTML = `
                        <span class="image-icon">⬜</span>
                        <span class="image-name unlinked">Empty frame</span>
                    `;
                }
                frame.appendChild(indicator);
            }
        }

        // Add label
        const label = document.createElement('div');
        label.className = 'frame-label';
        
        if (item.type === 'image') {
            const filename = item.content ? item.content.split('/').pop() : 'Image';
            label.textContent = filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
        } else if (item.content) {
            const preview = item.content.substring(0, 60).replace(/\r/g, ' ');
            label.textContent = preview + (item.content.length > 60 ? '...' : '');
        } else {
            label.textContent = item.subtype || item.type;
        }

        frame.appendChild(label);

        // Store item data
        frame.itemData = item;

        // Click handler
        frame.addEventListener('click', (e) => {
            e.stopPropagation();
            selectFrame(frame, item);
        });

        pageView.appendChild(frame);
    }

    resetDetailsPanel();
}

/**
 * Select a frame and show details
 */
function selectFrame(frameEl, item) {
    if (state.selectedFrame) {
        state.selectedFrame.classList.remove('selected');
    }
    state.selectedFrame = frameEl;
    frameEl.classList.add('selected');
    showDetails(item);
}

/**
 * Show item details in sidebar
 */
function showDetails(item) {
    const isImage = item.type === 'image';
    const filename = item.content ? item.content.split('/').pop() : null;

    let html = '';

    // Type
    html += `
        <div class="detail-section">
            <div class="detail-label">Type</div>
            <div class="detail-value type-${item.type}">${item.subtype || item.type}</div>
        </div>
    `;

    // Image path - show for images with or without linked files
    if (isImage) {
        if (item.content) {
            html += `
                <div class="detail-section">
                    <div class="detail-label">Filename</div>
                    <div class="detail-value">${filename}</div>
                    <div class="detail-path">${item.content}</div>
                    <button class="copy-btn" data-copy="${escapeAttr(item.content)}">📋 Copy Full Path</button>
                    <button class="copy-btn" data-copy="${escapeAttr(filename)}">📋 Copy Filename</button>
                </div>
            `;
        } else {
            html += `
                <div class="detail-section">
                    <div class="detail-label">Linked File</div>
                    <div class="detail-value warning">⚠️ No file linked</div>
                    <div class="detail-hint">This image frame exists but has no linked file, or the link path wasn't captured during extraction.</div>
                </div>
            `;
        }
    }

    // Text content
    if (item.content && !isImage) {
        const cleanContent = item.content.replace(/\r/g, '\n');
        html += `
            <div class="detail-section">
                <div class="detail-label">Content (${item.content.length} chars)</div>
                <div class="detail-text-content">${escapeHtml(cleanContent)}</div>
                <button class="copy-btn" data-copy="${escapeAttr(item.content)}">📋 Copy Text</button>
            </div>
        `;
    }

    // Full article text
    if (item.fullText && item.fullText !== item.content) {
        const cleanFull = item.fullText.replace(/\r/g, '\n');
        html += `
            <div class="detail-section">
                <div class="detail-label">Full Article (${item.fullText.length} chars)</div>
                <div class="detail-text-content">${escapeHtml(cleanFull.substring(0, 800))}${item.fullText.length > 800 ? '\n\n[...]' : ''}</div>
                <button class="copy-btn" data-copy="${escapeAttr(item.fullText)}">📋 Copy Full Article</button>
            </div>
        `;
    }

    // Article ID
    if (item.articleId) {
        html += `
            <div class="detail-section">
                <div class="detail-label">Article ID</div>
                <div class="detail-value">${item.articleId}</div>
            </div>
        `;
    }

    detailsPanel.innerHTML = html;

    // Attach copy handlers
    detailsPanel.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.dataset.copy;
            copyToClipboard(text, btn);
        });
    });
}

/**
 * Reset details panel
 */
function resetDetailsPanel() {
    detailsPanel.innerHTML = `
        <div class="details-empty">
            <p>Click any frame on the page to see its content</p>
        </div>
    `;
}

/**
 * Navigate to page
 */
function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages) return;
    state.currentPage = pageNum;
    pageSelect.value = pageNum;
    updatePageNav();
    renderCurrentPage();
}

/**
 * Update navigation buttons
 */
function updatePageNav() {
    prevBtn.disabled = state.currentPage <= 1;
    nextBtn.disabled = state.currentPage >= state.totalPages;
}

/**
 * Handle search
 */
function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();
    
    // Remove previous highlights
    document.querySelectorAll('.frame.search-match').forEach(f => {
        f.classList.remove('search-match');
    });

    if (!query) return;

    // Search all frames on current page
    document.querySelectorAll('.frame').forEach(frame => {
        const item = frame.itemData;
        if (!item) return;

        const content = (item.content || '').toLowerCase();
        const fullText = (item.fullText || '').toLowerCase();

        if (content.includes(query) || fullText.includes(query)) {
            frame.classList.add('search-match');
        }
    });
}

/**
 * Drag and drop support
 */
function setupDragAndDrop() {
    const overlay = document.createElement('div');
    overlay.className = 'drop-overlay';
    overlay.innerHTML = '<p>Drop JSON file here</p>';
    document.body.appendChild(overlay);

    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('active');
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            overlay.classList.remove('active');
            dragCounter = 0;
        }
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        overlay.classList.remove('active');
        dragCounter = 0;

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) {
            loadJsonFile(file);
        }
    });
}

/**
 * Copy to clipboard
 */
function copyToClipboard(text, button) {
    // Clean up text (convert \r to \n)
    const cleanText = text.replace(/\r/g, '\n');
    
    navigator.clipboard.writeText(cleanText).then(() => {
        const original = button.textContent;
        button.textContent = '✓ Copied!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = original;
            button.classList.remove('copied');
        }, 1500);
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = cleanText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        button.textContent = '✓ Copied!';
        setTimeout(() => { button.textContent = original; }, 1500);
    });
}

// Utilities
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
