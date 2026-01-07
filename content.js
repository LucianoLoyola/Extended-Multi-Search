/**
 * Extended Search - Content Script
 */

const COLORS_COUNT = 6;
let isVisible = false;
let nextColorIndex = 0;
let searchTerms = [{ id: 0, term: '', count: 0, colorId: 0 }];
nextColorIndex = 1;
let container = null;

// Template for inner HTML of the container
const CONTAINER_HTML = `
  <div class="es-header">
    <span>Multi-Search</span>
    <button class="es-close-btn" id="es-close">×</button>
  </div>
  <div id="es-search-rows"></div>
  <div class="es-footer">
    <button id="es-add-btn">+ Add Search Box</button>
  </div>
`;

function init() {
  // Create UI Container
  container = document.createElement('div');
  container.id = 'extended-search-container';
  container.innerHTML = CONTAINER_HTML;
  document.body.appendChild(container);

  // Event Listeners
  document.getElementById('es-close').addEventListener('click', toggleUI);
  document.getElementById('es-add-btn').addEventListener('click', addSearchRow);

  // Global Keyboard listener for Ctrl+F
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleUI(true);
    }
    if (e.key === 'Escape' && isVisible) {
      toggleUI(false);
    }
  });

  renderRows();
}

/**
 * Toggles the visibility of the search UI
 */
function toggleUI(show) {
  if (typeof show === 'boolean') {
    isVisible = show;
  } else {
    isVisible = !isVisible;
  }

  if (isVisible) {
    container.classList.add('visible');
    // Focus first input
    const firstInput = document.querySelector('.es-search-input');
    if (firstInput) firstInput.focus();
  } else {
    container.classList.remove('visible');
    clearHighlights(); // Optional: clear when closing? User logic might differ, keeping for now.
  }
}

/**
 * Adds a new search row data and re-renders
 */
function addSearchRow() {
  const newId = searchTerms.length > 0 ? Math.max(...searchTerms.map(t => t.id)) + 1 : 0;
  const newColorId = nextColorIndex % COLORS_COUNT;
  nextColorIndex++;

  searchTerms.push({ id: newId, term: '', count: 0, colorId: newColorId });
  renderRows();

  // Focus the new input
  setTimeout(() => {
    const inputs = document.querySelectorAll('.es-search-input');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  }, 0);
}

/**
 * Removes a search row
 */
function removeRow(id) {
  searchTerms = searchTerms.filter(t => t.id !== id);
  // Clear highlighting for this ID specifically or re-run all?
  // Easier to re-run all for MVP accuracy
  renderRows();
  performSearch();
}

/**
 * Renders the list of search inputs based on state
 */
function renderRows() {
  const wrapper = document.getElementById('es-search-rows');
  wrapper.innerHTML = ''; // Re-render clean

  searchTerms.forEach((item) => {
    const colorIndex = item.colorId;

    const row = document.createElement('div');
    row.className = `es-search-row es-row-${colorIndex}`;

    row.innerHTML = `
      <input type="text" class="es-search-input" placeholder="Find..." value="${item.term}" data-id="${item.id}">
      <span class="es-count" id="es-count-${item.id}">${item.count > 0 ? item.count : ''}</span>
      ${searchTerms.length > 1 ? `<button class="es-remove-btn" data-id="${item.id}">🗑️</button>` : ''}
    `;

    // Listeners
    const input = row.querySelector('.es-search-input');
    input.addEventListener('input', (e) => {
      item.term = e.target.value;
      performSearch();
    });

    const removeBtn = row.querySelector('.es-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeRow(item.id));
    }

    wrapper.appendChild(row);
  });
}

/**
 * Core Search Logic
 * Note: DOM Highlight is complex. For a robust solution without destroying events, 
 * we use a TreeWalker or regular regex replacements on text nodes.
 * 
 * Strategy:
 * 1. Remove all existing custom highlights.
 * 2. For each search term, find and wrap text.
 */
function performSearch() {
  // 1. Clear existing highlights
  // We look for elements with class starting with 'es-highlight-'
  // Unwrap them.
  clearHighlights();

  // 2. Apply new highlights
  let activeTerms = searchTerms.filter(t => t.term.length > 0);
  if (activeTerms.length === 0) return;

  // We can't easily cross-highlight overlapping terms in this simple DOM manipulation 
  // without a virtual layer, but we can try sequential separate passes if we are careful.
  // BUT simplest robust way for multiple terms: 
  // Get all text nodes -> check matches -> wrap.

  // To keep it performant and simple for "different colors":
  // We will iterate text nodes. If a node matches Term A, wrap it. 
  // If it matches Term B, wrap it. 
  // Caution: nested matches or existing wraps.

  // Simplified approach: treating body text.
  // Warning: heavy DOM manipulation on large pages.

  activeTerms.forEach((item) => {
    highlightTerm(item.term, item.colorId, item.id);
  });
}

function clearHighlights() {
  // Find all our spans
  const highlights = document.querySelectorAll('[class^="es-highlight-"]');
  highlights.forEach(span => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize(); // Merge adjacent text nodes
  });

  // Reset counts visually
  searchTerms.forEach(t => t.count = 0);
  document.querySelectorAll('.es-count').forEach(el => el.textContent = '');
}

function highlightTerm(term, colorIndex, itemId) {
  if (!term) return;

  const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

  let nodesToReplace = [];

  // Collect nodes first to avoid messing up the walker while modifying
  while (walker.nextNode()) {
    const node = walker.currentNode;
    // Skip if inside our own container or script/style
    if (container.contains(node)) continue;
    if (node.parentNode.tagName === 'SCRIPT' || node.parentNode.tagName === 'STYLE') continue;

    if (node.nodeValue.match(regex)) {
      nodesToReplace.push(node);
    }
  }

  let matchCount = 0;

  nodesToReplace.forEach(node => {
    const fragment = document.createDocumentFragment();
    const parts = node.nodeValue.split(regex);

    // If split has length > 1, means we found matches.
    // parts array will alternate: [pre-text, match, post-text, match, ...]

    let hasMatch = false;

    parts.forEach(part => {
      if (part.toLowerCase() === term.toLowerCase()) {
        hasMatch = true;
        matchCount++;
        const span = document.createElement('span');
        span.className = `es-highlight-${colorIndex}`;
        span.textContent = part;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    if (hasMatch) {
      node.parentNode.replaceChild(fragment, node);
    }
  });

  // Update count in UI
  const termObj = searchTerms.find(t => t.id === itemId);
  if (termObj) termObj.count = matchCount;
  const countEl = document.getElementById(`es-count-${itemId}`);
  if (countEl) countEl.textContent = matchCount;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Run
init();
