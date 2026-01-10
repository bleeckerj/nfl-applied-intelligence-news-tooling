const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name');
const listContainer = document.getElementById('inventory-list');
const sortSelect = document.getElementById('sort-mode');
const filterSelect = document.getElementById('filter-mode');

let currentData = null; // Store data for re-sorting

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

// Re-render when options change
if (sortSelect) sortSelect.addEventListener('change', () => renderInventory());
if (filterSelect) filterSelect.addEventListener('change', () => renderInventory());

function renderInventory(data = null) {
    // If data passed, setting it (initial load logic from before was slightly different)

    if (!currentData) return;

    listContainer.innerHTML = ''; // Clear current content

    // Handle both new { articles: [] } structure and legacy formats if necessary
    let articles = [...(currentData.articles || [])]; // Clone to sort safely

    if (articles.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><p>No articles found in this file.</p></div>';
        return;
    }
    
    // Config
    const sortMode = sortSelect ? sortSelect.value : 'reading';
    const filterMode = filterSelect ? filterSelect.value : 'all';

    // 1. Filter
    if (filterMode !== 'all') {
        articles = articles.filter(a => {
            const hasImages = (a.components || []).some(c => c.type === "Image/Graphic");
            const hasText = (a.full_text && a.full_text.length > 0) || (a.components||[]).some(c => c.type.includes("Headline"));
            
            if (filterMode === 'images') return hasImages;
            if (filterMode === 'text') return hasText;
            return true;
        });
    }

    // 2. Sort
    articles.sort((a, b) => {
        if (sortMode === 'id') {
            return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
        }

        const pageA = getPageNum(a);
        const pageB = getPageNum(b);
        
        // Always Page First
        if (pageA !== pageB) return pageA - pageB;
        
        const topA = getTopY(a);
        const topB = getTopY(b);
        
        const leftA = getLeftX(a);
        const leftB = getLeftX(b);

        if (sortMode === 'reading') {
            // "Reading Order" = Page -> Top -> Left
            // But strict Top sort breaks columns (Top of Col 2 < Bottom of Col 1).
            // Proper reading order heuristic: Group into generic "Rows" (bands of verticality)
            // But precise "Top" sort is standard for single column.
            
            // Standard reading order heuristic:
            // If items are roughly same Y (within 20pts), sort by Left.
            // Else sort by Top.
            if (Math.abs(topA - topB) < 50) { 
                return leftA - leftB; 
            }
            return topA - topB;
        }

        // 'page-y'
        return topA - topB;
    });

    articles.forEach(article => {
        const title = getTitle(article); 
        const fullText = article.full_text || "";
        const id = article.id || "Unknown ID";
        
        // Categorize components
        const images = (article.components || []).filter(c => c.type === "Image/Graphic");
        const headlines = (article.components || []).filter(c => c.type.includes("Headline"));
        
        // If sorting filter removes all visible content from a card, should we hide the card?
        // E.g. Filter 'images', but card has text only? 
        // Logic above filtered *articles* that HAVE images. It didn't filter the content *inside* the card.
        // Let's refine: The user wants to SEE images only.
        
        // Render pass
        const card = document.createElement('article');
        card.className = 'story-card';
        
        // Meta Header
        const pages = [...new Set(article.frames.map(f => f.page))].join(", ");
        card.innerHTML = `
            <div class="story-meta">
                <span>ID: ${id}</span>
                <span>Page(s): ${pages}</span>
            </div>
            <div class="story-content"></div>
        `;

        const contentContainer = card.querySelector('.story-content');
        let hasContent = false;

        // 1. Headlines (Show if All or Text)
        if (filterMode !== 'images') {
            headlines.forEach(hl => {
                const div = document.createElement('div');
                div.className = 'headline-group';
                div.innerHTML = `
                    <span class="role-label">${hl.type}</span>
                    <div class="headline-content">${hl.content}</div>
                `;
                addCopyButton(div.querySelector('.headline-content'), hl.content || "");
                contentContainer.appendChild(div);
                hasContent = true;
            });
        }

        // 2. Images (Show if All or Images)
        if (filterMode !== 'text') {
            images.forEach(img => {
                const div = document.createElement('div');
                div.className = 'image-group';
                
                const rawContent = img.content || "Image path unknown";
                const cleanPath = typeof rawContent === 'string' ? rawContent.split('/').pop() : "Unknown Image"; // Double check safety
    
                div.innerHTML = `
                    <span class="role-label">Image Asset</span>
                    <div class="image-path">
                        <span title="${rawContent}">${cleanPath}</span>
                    </div>
                `;
                addCopyButton(div.querySelector('.image-path'), rawContent, "Copy Path");
                contentContainer.appendChild(div);
                hasContent = true;
            });
        }

        // 3. Body Text (Show if All or Text)
        if (filterMode !== 'images') {
            if (fullText && fullText.trim().length > 0) {
                const div = document.createElement('div');
                div.className = 'body-text-group';
                div.innerHTML = `
                    <span class="role-label">Body Text (${fullText.length} chars)</span>
                    <div class="text-block">${fullText}</div>
                `;
                addCopyButton(div.querySelector('.text-block'), fullText, "Copy Text");
                contentContainer.appendChild(div);
                hasContent = true;
            }
        }

        if (hasContent) {
            listContainer.appendChild(card);
        }
    });
}

function addCopyButton(targetElement, textToCopy, label = "Copy") {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = btn.textContent;
            btn.textContent = "Copied!";
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 2000);
        });
    });
    
    // Logic to insert button nicely
    if (targetElement.classList.contains('image-path')) {
         targetElement.appendChild(btn);
    } else {
        const label = targetElement.previousElementSibling;
        if (label && label.classList.contains('role-label')) {
            label.style.display = "flex";
            label.style.justifyContent = "space-between";
            label.appendChild(btn);
        } else {
            targetElement.parentNode.insertBefore(btn, targetElement);
        }
    }
}

// Helpers for sorting
function getPageNum(article) {
    if (!article.frames || article.frames.length === 0) return 999;
    const pStr = article.frames[0].page;
    // Extract "Page 1" -> 1
    // Sometimes it might just be "1"
    const match = pStr.match(/\d+/);
    return match ? parseInt(match[0]) : 999;
}

function getTopY(article) {
    if (!article.frames || article.frames.length === 0) return 0;
    return article.frames[0].bounds ? article.frames[0].bounds[0] : 0;
}

function getTitle(article) {
    const hl = article.components ? article.components.find(c => c.type === 'Headline') : null;
    if (hl) return hl.content;
    if (article.frames && article.frames.length > 0 && article.frames[0].content) {
        return article.frames[0].content.substring(0, 50) + "...";
    }
    return "Untitled";
}

function getLeftX(article) {
    if (!article.frames || article.frames.length === 0) return 0;
    // Bounds are usually [y1, x1, y2, x2] in InDesign scripting standard context often used
    // But let's verify usage. In `getTopY` above: return article.frames[0].bounds ? article.frames[0].bounds[0] : 0;
    // Typically InDesign DOM bounds are [y1, x1, y2, x2]. So Top is 0, Left is 1.
    return article.frames[0].bounds ? article.frames[0].bounds[1] : 0;
}

// --- Drag and Drop Support ---

const dropOverlay = document.getElementById('drop-zone-overlay');
let dragCounter = 0;

document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.remove('hidden');
});

document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
        dropOverlay.classList.add('hidden');
        dragCounter = 0;
    }
});

document.body.addEventListener('dragover', (e) => {
    e.preventDefault(); // Necessary to allow dropping
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('hidden');
    dragCounter = 0;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

function handleFile(file) {
    if (!file.name.endsWith('.json')) {
        alert('Please drop a JSON file.');
        return;
    }

    fileNameDisplay.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target.result);
            currentData = json;
            renderInventory(); 
        } catch (err) {
            alert('Error parsing JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}
