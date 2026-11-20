const STORAGE_KEY = 'cozy_warm_dark_journal_v1';

const COVER_GRADIENTS = [
  'linear-gradient(120deg, #2C2722 0%, #4A4034 55%, #1E1C19 100%)',
  'linear-gradient(120deg, #272522 0%, #3E3A34 50%, #1C1B19 100%)',
  'linear-gradient(120deg, #232723 0%, #374236 55%, #1C1B19 100%)',
  'linear-gradient(120deg, #282425 0%, #433B3D 55%, #1C1B19 100%)',
  'linear-gradient(120deg, #22201E 0%, #35312C 100%)'
];

const EMOJIS = ['☕', '🕯️', '📖', '🍂', '🪴', '✍️', '🌙', '🎧', '🪵', '💡', '🍵', '🧭', '📌', '🎨', '💻', '✨', '🏡', '🧸'];

let state = {
  pages: [],
  activePageId: null,
  searchQuery: '',
  slashTargetBlockId: null
};

// DOM Elements
const pageListEl = document.getElementById('pageList');
const pageCountLabel = document.getElementById('pageCountLabel');
const searchInput = document.getElementById('searchInput');
const emptyStateEl = document.getElementById('emptyState');
const editorScrollEl = document.getElementById('editorScroll');
const pageCoverEl = document.getElementById('pageCover');
const pageIconBtn = document.getElementById('pageIconBtn');
const emojiPopover = document.getElementById('emojiPopover');
const pageTitleInput = document.getElementById('pageTitleInput');
const pageTagEl = document.getElementById('pageTag');
const pageUpdatedAtEl = document.getElementById('pageUpdatedAt');
const blocksContainer = document.getElementById('blocksContainer');
const topbarEmoji = document.getElementById('topbarEmoji');
const topbarTitle = document.getElementById('topbarTitle');
const wordCountEl = document.getElementById('wordCount');
const saveStatusEl = document.getElementById('saveStatus');
const slashMenu = document.getElementById('slashMenu');

function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.pages = Array.isArray(parsed.pages) ? parsed.pages : [];
      state.activePageId = state.pages.some(p => p.id === parsed.activePageId)
        ? parsed.activePageId
        : (state.pages[0]?.id || null);
    } catch {
      state.pages = [];
      state.activePageId = null;
    }
  } else {
    state.pages = [];
    state.activePageId = null;
  }

  renderEmojiPicker();
  renderSidebar();
  renderActivePage();
  bindEvents();
}

function saveState() {
  saveStatusEl.textContent = 'Đang lưu...';
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    pages: state.pages,
    activePageId: state.activePageId
  }));
  setTimeout(() => {
    saveStatusEl.textContent = 'Đã lưu';
  }, 250);
}

function getActivePage() {
  return state.pages.find(p => p.id === state.activePageId) || null;
}

function createNewJournal() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

  const newPage = {
    id: 'journal-' + Date.now(),
    title: '',
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    tag: 'Nhật ký',
    coverIndex: Math.floor(Math.random() * COVER_GRADIENTS.length),
    updatedAt: `${dateStr} lúc ${timeStr}`,
    blocks: [
      { id: 'b-' + Date.now(), type: 'p', content: '' }
    ]
  };

  state.pages.unshift(newPage);
  state.activePageId = newPage.id;
  saveState();
  renderSidebar();
  renderActivePage();
  pageTitleInput.focus();
}

function renderEmojiPicker() {
  emojiPopover.innerHTML = EMOJIS.map(emoji =>
    `<button class="emoji-option" type="button" data-emoji="${emoji}">${emoji}</button>`
  ).join('');
}

function renderSidebar() {
  const filtered = state.pages.filter(p =>
    (p.title || 'Nhật ký chưa đặt tên').toLowerCase().includes(state.searchQuery.toLowerCase())
  );
  pageCountLabel.textContent = filtered.length;

  if (filtered.length === 0) {
    pageListEl.innerHTML = `
      <div class="sidebar-empty-hint">
        ${state.pages.length === 0
          ? 'Chưa có nhật ký nào.<br>Nhấn nút bên dưới để tạo mới.'
          : 'Không tìm thấy nhật ký khớp từ khóa.'}
      </div>
    `;
    return;
  }

  pageListEl.innerHTML = filtered.map(page => `
    <div class="page-item ${page.id === state.activePageId ? 'active' : ''}" data-id="${page.id}">
      <div class="page-item-left">
        <span>${page.emoji}</span>
        <span class="page-item-title">${escapeHtml(page.title || 'Nhật ký chưa đặt tên')}</span>
      </div>
      <button class="delete-page-btn" title="Xóa nhật ký" data-delete="${page.id}">×</button>
    </div>
  `).join('');
}

function renderActivePage() {
  const page = getActivePage();

  if (!page) {
    emptyStateEl.style.display = 'flex';
    editorScrollEl.style.display = 'none';
    topbarEmoji.textContent = '';
    topbarTitle.textContent = 'Chưa có nhật ký';
    wordCountEl.textContent = '0 từ';
    return;
  }

  emptyStateEl.style.display = 'none';
  editorScrollEl.style.display = 'block';

  pageCoverEl.style.background = COVER_GRADIENTS[page.coverIndex % COVER_GRADIENTS.length];
  pageIconBtn.textContent = page.emoji;
  pageTitleInput.value = page.title;
  pageTagEl.textContent = page.tag || 'Nhật ký';
  pageUpdatedAtEl.textContent = page.updatedAt || 'Vừa tạo';
  topbarEmoji.textContent = page.emoji;
  topbarTitle.textContent = page.title || 'Nhật ký chưa đặt tên';

  blocksContainer.innerHTML = '';
  page.blocks.forEach(block => {
    blocksContainer.appendChild(createBlockElement(block));
  });

  updateWordCount();
}

function createBlockElement(block) {
  const row = document.createElement('div');
  row.className = `block-row block-${block.type} ${block.checked ? 'checked' : ''}`;
  row.dataset.id = block.id;

  const actions = document.createElement('div');
  actions.className = 'block-actions';
  actions.innerHTML = `
    <button class="block-action-btn" title="Thêm khối bên dưới" data-action="add">+</button>
    <button class="block-action-btn" title="Xóa khối" data-action="delete">×</button>
  `;
  row.appendChild(actions);

  if (block.type === 'divider') {
    const line = document.createElement('div');
    line.className = 'divider-line';
    row.appendChild(line);
    return row;
  }

  if (block.type === 'todo') {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = !!block.checked;
    checkbox.addEventListener('change', () => {
      block.checked = checkbox.checked;
      row.classList.toggle('checked', block.checked);
      saveState();
    });
    row.appendChild(checkbox);
  }

  if (block.type === 'callout') {
    const icon = document.createElement('span');
    icon.className = 'callout-icon';
    icon.textContent = '💡';
    row.appendChild(icon);
  }

  const content = document.createElement('div');
  content.className = 'block-content';
  content.contentEditable = 'true';
  content.dataset.placeholder = getPlaceholder(block.type);
  content.innerText = block.content || '';

  content.addEventListener('input', () => {
    const text = content.innerText;
    block.content = text;
    updateWordCount();
    saveState();

    if (text.trim() === '/') {
      openSlashMenu(block.id, content);
    } else {
      closeSlashMenu();
    }
  });

  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      closeSlashMenu();
      insertBlockAfter(block.id, 'p');
    } else if (e.key === 'Backspace' && content.innerText.trim() === '') {
      const page = getActivePage();
      if (page && page.blocks.length > 1) {
        e.preventDefault();
        deleteBlock(block.id, true);
      }
    } else if (e.key === 'Escape') {
      closeSlashMenu();
    }
  });

  row.appendChild(content);
  return row;
}

function getPlaceholder(type) {
  const map = {
    p: "Viết nhật ký hôm nay, hoặc gõ '/' để chèn khối...",
    h1: 'Tiêu đề lớn...',
    h2: 'Tiêu đề mục...',
    todo: 'Việc cần làm...',
    quote: 'Nhập câu trích dẫn...',
    callout: 'Ghi chú quan trọng...',
    code: 'Nhập đoạn mã...'
  };
  return map[type] || '';
}

function appendBlock(type) {
  const page = getActivePage();
  if (!page) return;
  const newBlock = {
    id: 'b-' + Date.now() + Math.random().toString(16).slice(2, 6),
    type,
    content: '',
    checked: false
  };
  page.blocks.push(newBlock);
  saveState();
  renderActivePage();
  focusBlock(newBlock.id);
}

function insertBlockAfter(targetId, type) {
  const page = getActivePage();
  if (!page) return;
  const idx = page.blocks.findIndex(b => b.id === targetId);
  const newBlock = {
    id: 'b-' + Date.now() + Math.random().toString(16).slice(2, 6),
    type,
    content: '',
    checked: false
  };
  page.blocks.splice(idx + 1, 0, newBlock);
  saveState();
  renderActivePage();
  focusBlock(newBlock.id);
}

function deleteBlock(blockId, focusPrev = false) {
  const page = getActivePage();
  if (!page) return;
  const idx = page.blocks.findIndex(b => b.id === blockId);
  if (idx === -1) return;
  const prevBlock = page.blocks[idx - 1];
  page.blocks.splice(idx, 1);
  if (page.blocks.length === 0) {
    page.blocks.push({ id: 'b-' + Date.now(), type: 'p', content: '' });
  }
  saveState();
  renderActivePage();
  if (focusPrev && prevBlock) {
    focusBlock(prevBlock.id);
  }
}

function focusBlock(blockId) {
  setTimeout(() => {
    const row = blocksContainer.querySelector(`.block-row[data-id="${blockId}"] .block-content`);
    if (row) {
      row.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(row);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, 10);
}

function openSlashMenu(blockId, targetEl) {
  state.slashTargetBlockId = blockId;
  const rect = targetEl.getBoundingClientRect();
  slashMenu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 310)}px`;
  slashMenu.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
  slashMenu.classList.add('open');
}

function closeSlashMenu() {
  slashMenu.classList.remove('open');
  state.slashTargetBlockId = null;
}

function updateWordCount() {
  const page = getActivePage();
  if (!page) {
    wordCountEl.textContent = '0 từ';
    return;
  }
  const allText = [page.title, ...page.blocks.map(b => b.content || '')].join(' ').trim();
  const words = allText ? allText.split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} từ`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function bindEvents() {
  const sidebar = document.getElementById('sidebar');
  const openBtn = document.getElementById('openSidebarBtn');
  document.getElementById('toggleSidebarInner').addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    openBtn.style.display = 'flex';
  });
  openBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    openBtn.style.display = 'none';
  });

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderSidebar();
  });

  pageListEl.addEventListener('click', (e) => {
    const delId = e.target.dataset.delete;
    if (delId) {
      e.stopPropagation();
      state.pages = state.pages.filter(p => p.id !== delId);
      if (state.activePageId === delId) {
        state.activePageId = state.pages[0]?.id || null;
      }
      saveState();
      renderSidebar();
      renderActivePage();
      return;
    }

    const item = e.target.closest('.page-item');
    if (item) {
      state.activePageId = item.dataset.id;
      saveState();
      renderSidebar();
      renderActivePage();
    }
  });

  document.getElementById('createPageBtn').addEventListener('click', createNewJournal);
  document.getElementById('emptyCreateBtn').addEventListener('click', createNewJournal);

  pageTitleInput.addEventListener('input', (e) => {
    const page = getActivePage();
    if (!page) return;
    page.title = e.target.value;
    topbarTitle.textContent = page.title || 'Nhật ký chưa đặt tên';
    updateWordCount();
    saveState();
    renderSidebar();
  });

  document.getElementById('changeCoverBtn').addEventListener('click', () => {
    const page = getActivePage();
    if (!page) return;
    page.coverIndex = (page.coverIndex + 1) % COVER_GRADIENTS.length;
    saveState();
    renderActivePage();
  });

  pageIconBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPopover.classList.toggle('open');
  });

  emojiPopover.addEventListener('click', (e) => {
    const emoji = e.target.dataset.emoji;
    const page = getActivePage();
    if (emoji && page) {
      page.emoji = emoji;
      emojiPopover.classList.remove('open');
      saveState();
      renderSidebar();
      renderActivePage();
    }
  });

  blocksContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.block-action-btn');
    if (!btn) return;
    const row = btn.closest('.block-row');
    const blockId = row.dataset.id;
    if (btn.dataset.action === 'add') {
      insertBlockAfter(blockId, 'p');
    } else if (btn.dataset.action === 'delete') {
      deleteBlock(blockId);
    }
  });

  slashMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.slash-item');
    const page = getActivePage();
    if (!item || !state.slashTargetBlockId || !page) return;
    const newType = item.dataset.type;
    const block = page.blocks.find(b => b.id === state.slashTargetBlockId);
    if (block) {
      block.type = newType;
      block.content = '';
      saveState();
      renderActivePage();
      if (newType !== 'divider') focusBlock(block.id);
    }
    closeSlashMenu();
  });

  document.addEventListener('click', (e) => {
    if (!emojiPopover.contains(e.target) && e.target !== pageIconBtn) {
      emojiPopover.classList.remove('open');
    }
    if (!slashMenu.contains(e.target)) {
      closeSlashMenu();
    }
  });
}

init();