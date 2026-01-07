/**
 * Extended Search - Content Script
 */


let isVisible = false;
let searchTerms = [{ id: 0, term: '', count: 0, color: getRandomColor(), caseSensitive: true, currentIndex: -1 }];

let container = null;
let dragStartX, dragStartY, initialLeft, initialTop;
let isDragging = false;
let isResizing = false;
let currentResizeHandle = null;
let resizeStartX, resizeStartY, initialWidth, initialHeight, initialResizeLeft, initialResizeTop;

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function hexToRgba(hex, alpha) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length == 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
  }
  return `rgba(255,255,0,${alpha})`; // fallback
}

function getContrastColor(hex) {
  // Simple logic: convert to RGB, calculate brightness, return black or white
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substr(1, 2), 16);
    g = parseInt(hex.substr(3, 2), 16);
    b = parseInt(hex.substr(5, 2), 16);
  }
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'black' : 'white';
}

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
  console.log("ExtendedSearch: Initialized");

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
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
      console.log("ExtendedSearch: Ctrl+F detected");
      e.preventDefault();
      toggleUI(true);
    }
    if (e.key === 'Escape' && isVisible) {
      console.log("ExtendedSearch: Escape detected");
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
  console.log("ExtendedSearch: toggleUI called with", show);
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

  searchTerms.push({ id: newId, term: '', count: 0, color: getRandomColor(), caseSensitive: true, currentIndex: -1 });
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
    const row = document.createElement('div');
    row.className = `es-search-row`;
    row.style.borderLeftColor = item.color;

    row.innerHTML = `
      <div class="es-nav-group">
        <button class="es-nav-btn es-nav-prev" title="Previous Match" data-id="${item.id}">&#9664;</button>
        <button class="es-nav-btn es-nav-next" title="Next Match" data-id="${item.id}">&#9654;</button>
      </div>
      <input type="text" class="es-search-input" placeholder="Find..." value="${item.term}" data-id="${item.id}">
      
      <span class="es-count" id="es-count-${item.id}">
        ${item.count > 0 ? (item.currentIndex > -1 ? item.currentIndex + 1 : 0) + '/' + item.count : ''}
      </span>

      <label class="es-match-case-label" title="Toggle Case Sensitivity">
        <input type="checkbox" class="es-match-case-checkbox" ${item.caseSensitive ? 'checked' : ''}>
        Case
      </label>

      <button class="es-remove-btn" data-id="${item.id}" ${searchTerms.length === 1 ? 'disabled' : ''}>🗑️</button>
    `;

    // Listeners
    const input = row.querySelector('.es-search-input');
    input.addEventListener('input', (e) => {
      item.term = e.target.value;
      item.currentIndex = -1; // Reset index since term changed
      performSearch();
    });

    // Navigation listeners
    row.querySelector('.es-nav-prev').addEventListener('click', () => navigateMatch(item.id, -1));
    row.querySelector('.es-nav-next').addEventListener('click', () => navigateMatch(item.id, 1));

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
 * Navigate between matches
 */
function navigateMatch(id, direction) {
  const termObj = searchTerms.find(t => t.id === id);
  if (!termObj || termObj.count === 0) return;

  const highlights = document.querySelectorAll(`.es-highlight-${termObj.id}`);
  if (highlights.length === 0) return;

  let newIndex = termObj.currentIndex + direction;

  // Wrap around
  if (newIndex >= highlights.length) {
    newIndex = 0;
  } else if (newIndex < 0) {
    newIndex = highlights.length - 1;
  }

  termObj.currentIndex = newIndex;

  // Scroll to element
  const target = highlights[newIndex];
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });

  updateCountDisplay(id);
  updateActiveState(id);
}

function updateActiveState(id) {
  const termObj = searchTerms.find(t => t.id === id);
  if (!termObj) return;

  const highlights = document.querySelectorAll(`.es-highlight-${termObj.id}`);
  highlights.forEach((el, index) => {
    if (index === termObj.currentIndex) {
      el.classList.add('es-match-active');
    } else {
      el.classList.remove('es-match-active');
    }
  });
}

/**
 * Core Search Logic
 */
function performSearch() {
  clearHighlights();

  let activeTerms = searchTerms.filter(t => t.term.length > 0);
  if (activeTerms.length === 0) return;

  activeTerms.forEach((item) => {
    highlightTerm(item.term, item.color, item.id, item.caseSensitive);
  });
}

function clearHighlights() {
  const highlights = document.querySelectorAll('[class^="es-highlight-"]');
  highlights.forEach(span => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });

  searchTerms.forEach(t => {
    t.count = 0;
    // We do NOT reset currentIndex here anymore to preserve navigation state across re-renders
  });
  document.querySelectorAll('.es-count').forEach(el => el.textContent = '');
}

function highlightTerm(term, color, itemId, isCaseSensitive) {
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
  // Dynamic color calculation
  const highlightColor = hexToRgba(color, 0.4);
  const textColor = getContrastColor(color);

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
        // Use ID based class for querying, dynamic styles for color
        span.className = `es-highlight-${itemId}`;
        span.style.backgroundColor = highlightColor;
        span.style.color = textColor;
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
  if (termObj) {
    termObj.count = matchCount;

    if (matchCount === 0) {
      termObj.currentIndex = -1;
    } else if (termObj.currentIndex >= matchCount) {
      termObj.currentIndex = 0;
    }
  }
  updateCountDisplay(itemId);
  updateActiveState(itemId);
}

function updateCountDisplay(id) {
  const termObj = searchTerms.find(t => t.id === id);
  if (!termObj) return;

  const countEl = document.getElementById(`es-count-${id}`);
  if (countEl) {
    if (termObj.count > 0) {
      const current = termObj.currentIndex > -1 ? termObj.currentIndex + 1 : 0;
      countEl.textContent = `${current}/${termObj.count}`;
    } else {
      countEl.textContent = '';
    }
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

init();
