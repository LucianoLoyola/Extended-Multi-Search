/**
 * Extended Search - Content Script
 */

const COLORS_COUNT = 6;
let isVisible = false;
let nextColorIndex = 0;
let searchTerms = [{ id: 0, term: '', count: 0, colorId: 0, caseSensitive: true }];
nextColorIndex = 1;

let container = null;
let dragStartX, dragStartY, initialLeft, initialTop;
let isDragging = false;
let isResizing = false;
let currentResizeHandle = null;
let resizeStartX, resizeStartY, initialWidth, initialHeight, initialResizeLeft, initialResizeTop;

// Template for inner HTML of the container
const CONTAINER_HTML = `
  <div class="es-resize-handle es-resize-nw" data-handle="nw"></div>
  <div class="es-resize-handle es-resize-ne" data-handle="ne"></div>
  <div class="es-resize-handle es-resize-sw" data-handle="sw"></div>
  <div class="es-resize-handle es-resize-se" data-handle="se"></div>
  <div class="es-resize-handle es-resize-n" data-handle="n"></div>
  <div class="es-resize-handle es-resize-s" data-handle="s"></div>
  <div class="es-resize-handle es-resize-w" data-handle="w"></div>
  <div class="es-resize-handle es-resize-e" data-handle="e"></div>

  <div class="es-header" id="es-header">
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

  // Dragging Logic
  const header = document.getElementById('es-header');
  header.addEventListener('mousedown', startDrag);

  // Resizing Logic
  const handles = container.querySelectorAll('.es-resize-handle');
  handles.forEach(handle => {
    handle.addEventListener('mousedown', startResize);
  });

  // Global Mouse Up / Move (attached to window to catch fast movements)
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

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
 * Dragging Functions
 */
function startDrag(e) {
  if (e.target.closest('.es-close-btn')) return; // Don't drag if clicking close
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  const rect = container.getBoundingClientRect();
  initialLeft = rect.left;
  initialTop = rect.top;

  // Disable text selection during drag
  document.body.style.userSelect = 'none';
}

/**
 * Resizing Functions
 */
function startResize(e) {
  e.stopPropagation(); // prevent drag trigger
  isResizing = true;
  currentResizeHandle = e.target.dataset.handle;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;

  const rect = container.getBoundingClientRect();
  initialWidth = rect.width;
  initialHeight = rect.height;
  initialResizeLeft = rect.left;
  initialResizeTop = rect.top;

  document.body.style.userSelect = 'none';
}


function onMouseMove(e) {
  if (isDragging) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    container.style.left = `${initialLeft + dx}px`;
    container.style.top = `${initialTop + dy}px`;
    // If it was right-aligned via CSS, setting left/top overrides it, which is what we want.
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  }

  if (isResizing) {
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;

    // Logic for different handles
    // E, W affect width/left. N, S affect height/top.

    if (currentResizeHandle.includes('e')) {
      container.style.width = `${initialWidth + dx}px`;
    }
    if (currentResizeHandle.includes('w')) {
      container.style.width = `${initialWidth - dx}px`;
      container.style.left = `${initialResizeLeft + dx}px`;
      container.style.right = 'auto';
    }
    if (currentResizeHandle.includes('s')) {
      container.style.height = `${initialHeight + dy}px`;
    }
    if (currentResizeHandle.includes('n')) {
      container.style.height = `${initialHeight - dy}px`;
      container.style.top = `${initialResizeTop + dy}px`;
      container.style.bottom = 'auto';
    }
  }
}

function onMouseUp() {
  isDragging = false;
  isResizing = false;
  currentResizeHandle = null;
  document.body.style.userSelect = '';
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
    const firstInput = document.querySelector('.es-search-input');
    if (firstInput) firstInput.focus();
  } else {
    container.classList.remove('visible');
    clearHighlights();
  }
}

/**
 * Adds a new search row data and re-renders
 */
function addSearchRow() {
  const newId = searchTerms.length > 0 ? Math.max(...searchTerms.map(t => t.id)) + 1 : 0;
  const newColorId = nextColorIndex % COLORS_COUNT;
  nextColorIndex++;

  searchTerms.push({ id: newId, term: '', count: 0, colorId: newColorId, caseSensitive: true });
  renderRows();

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
  renderRows();
  performSearch();
}

/**
 * Set Case Sensitivity
 */
function toggleCase(id, isChecked) {
  const term = searchTerms.find(t => t.id === id);
  if (term) {
    term.caseSensitive = isChecked;
    // We do NOT need to full re-render for this simple toggle if we don't want to lose focus, 
    // but re-rendering ensures consistency.
    // However, since it's a checkbox change, we might want to just run search.
    // But RenderRows updates the "checked" attribute.
    // Let's just run search to keep UI stable without re-render flicker.
    performSearch();
  }
}

/**
 * Renders the list of search inputs based on state
 */
function renderRows() {
  const wrapper = document.getElementById('es-search-rows');
  // Store current focus to restore it
  const activeEl = document.activeElement;
  const activeId = activeEl && activeEl.dataset.id ? activeEl.dataset.id : null;

  wrapper.innerHTML = '';

  searchTerms.forEach((item) => {
    const colorIndex = item.colorId;

    const row = document.createElement('div');
    row.className = `es-search-row es-row-${colorIndex}`;

    row.innerHTML = `
      <input type="text" class="es-search-input" placeholder="Find..." value="${item.term}" data-id="${item.id}">
      <label class="es-match-case-label" title="Toggle Case Sensitivity">
        <input type="checkbox" class="es-match-case-checkbox" ${item.caseSensitive ? 'checked' : ''}>
        Case
      </label>
      <span class="es-count" id="es-count-${item.id}">${item.count > 0 ? item.count : ''}</span>
      ${searchTerms.length > 1 ? `<button class="es-remove-btn" data-id="${item.id}">🗑️</button>` : ''}
    `;

    // Listeners
    const input = row.querySelector('.es-search-input');
    input.addEventListener('input', (e) => {
      item.term = e.target.value;
      performSearch();
    });

    // Checkbox listener
    const caseCheckbox = row.querySelector('.es-match-case-checkbox');
    caseCheckbox.addEventListener('change', (e) => {
      toggleCase(item.id, e.target.checked);
    });

    const removeBtn = row.querySelector('.es-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeRow(item.id));
    }

    wrapper.appendChild(row);
  });

  // Restore focus if needed
  if (activeId) {
    const inputToFocus = wrapper.querySelector(`input[data-id="${activeId}"]`);
    if (inputToFocus) {
      inputToFocus.focus();
      // Move cursor to end
      inputToFocus.setSelectionRange(inputToFocus.value.length, inputToFocus.value.length);
    }
  }
}

/**
 * Core Search Logic
 */
function performSearch() {
  clearHighlights();

  let activeTerms = searchTerms.filter(t => t.term.length > 0);
  if (activeTerms.length === 0) return;

  activeTerms.forEach((item) => {
    highlightTerm(item.term, item.colorId, item.id, item.caseSensitive);
  });
}

function clearHighlights() {
  const highlights = document.querySelectorAll('[class^="es-highlight-"]');
  highlights.forEach(span => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });

  searchTerms.forEach(t => t.count = 0);
  document.querySelectorAll('.es-count').forEach(el => el.textContent = '');
}

function highlightTerm(term, colorIndex, itemId, isCaseSensitive) {
  if (!term) return;

  const flags = isCaseSensitive ? 'g' : 'gi';
  const regex = new RegExp(`(${escapeRegExp(term)})`, flags);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let nodesToReplace = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (container.contains(node)) continue;
    if (node.parentNode.tagName === 'SCRIPT' || node.parentNode.tagName === 'STYLE') continue;

    // Check match based on sensitivity
    if (node.nodeValue.match(regex)) {
      nodesToReplace.push(node);
    }
  }

  let matchCount = 0;

  nodesToReplace.forEach(node => {
    // Re-check validity in case DOM changed
    if (!node.parentNode) return;

    const fragment = document.createDocumentFragment();
    const parts = node.nodeValue.split(regex);
    let hasMatch = false;

    parts.forEach(part => {
      // Logic to verify if this part is actually the match
      // For regex split with capturing group, matches are included in parts.
      // We need to verify if 'part' matches the search term using our case sensitivity rules.

      const isMatch = isCaseSensitive
        ? part === term
        : part.toLowerCase() === term.toLowerCase();

      if (isMatch) {
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

  const termObj = searchTerms.find(t => t.id === itemId);
  if (termObj) termObj.count = matchCount;
  const countEl = document.getElementById(`es-count-${itemId}`);
  if (countEl) countEl.textContent = matchCount;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

init();
