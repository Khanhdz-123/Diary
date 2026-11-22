const STORAGE_KEY = 'cozy_warm_dark_journal_v1';
const USERS_STORAGE_KEY = 'cozy_journal_users_v1';
const SESSION_STORAGE_KEY = 'cozy_journal_session_v1';

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
const userAvatarEl = document.getElementById('userAvatar');
const currentUserNameEl = document.getElementById('currentUserName');
const currentUserEmailEl = document.getElementById('currentUserEmail');
const logoutBtn = document.getElementById('logoutBtn');

function getActiveSessionUser() {
  try {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) return null;
    const session = JSON.parse(rawSession);
    if (!session?.userId) return null;

    const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
    const users = rawUsers ? JSON.parse(rawUsers) : [];
    if (!Array.isArray(users)) return null;
    return users.find(u => u.id === session.userId) || null;
  } catch {
    return null;
  }
}

function renderUserProfile() {
  const user = getActiveSessionUser();
  if (!user) {
    userAvatarEl.textContent = 'N';
    currentUserNameEl.textContent = 'Khách';
    currentUserEmailEl.textContent = 'Chưa đăng nhập phiên';
    return;
  }

  const displayName = user.name || user.email?.split('@')[0] || 'Người dùng';
  const initial = displayName.charAt(0).toUpperCase();
  currentUserNameEl.textContent = displayName;
  currentUserEmailEl.textContent = user.email || '';

  if (!user.photoURL) {
    userAvatarEl.textContent = initial;
    return;
  }

  userAvatarEl.innerHTML = '';
  const img = document.createElement('img');
  img.src = user.photoURL;
  img.alt = displayName;
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => {
    userAvatarEl.textContent = initial;
  });
  userAvatarEl.appendChild(img);
}

async function handleLogout() {
  localStorage.removeItem(SESSION_STORAGE_KEY);

  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js');
    const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js');
    if (getApps().length > 0) {
      const auth = getAuth(getApps()[0]);
      if (auth.currentUser) {
        await signOut(auth);
      }
    }
  } catch {
    // Bỏ qua nếu phiên hiện tại chỉ lưu ở localStorage
  }

  window.location.href = './register/register.html';
}

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

  renderUserProfile();
  renderEmojiPicker();
  renderSidebar();
  renderActivePage();
  bindEvents();
}

function saveState() {
  saveStatusEl.textContent = 'Đang lưu...';
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pages: state.pages,
      activePageId: state.activePageId
    }));
  } catch (error) {
    saveStatusEl.textContent = 'Không thể lưu';
    alert('Ảnh bìa này quá lớn để lưu trên thiết bị. Hãy thử chọn ảnh nhỏ hơn.');
    return;
  }
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
      <div class="page-item-actions">
        <button class="rename-page-btn" type="button" title="Đổi tên nhật ký" aria-label="Đổi tên nhật ký" data-rename="${page.id}">✎</button>
        <button class="delete-page-btn" type="button" title="Xóa nhật ký" data-delete="${page.id}">×</button>
      </div>
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

  if (page.coverImage) {
    pageCoverEl.style.background = `url("${page.coverImage}") center / cover no-repeat`;
  } else {
    pageCoverEl.style.background = COVER_GRADIENTS[page.coverIndex % COVER_GRADIENTS.length];
  }
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
    <button class="block-action-btn" type="button" title="Thêm khối bên dưới" data-action="add">+</button>
    <button class="block-action-btn" type="button" title="Xóa khối" data-action="delete">×</button>
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

function resizeCoverImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chọn tệp hình ảnh.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 900;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.fillStyle = '#1C1B19';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('Không thể đọc ảnh này.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Không thể mở tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

function startRenamePage(pageId) {
  const page = state.pages.find(p => p.id === pageId);
  if (!page) return;

  const item = Array.from(pageListEl.querySelectorAll('.page-item'))
    .find(el => el.dataset.id === pageId);
  const titleEl = item?.querySelector('.page-item-title');
  if (!item || !titleEl) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-page-input';
  input.value = page.title || '';
  input.placeholder = 'Tên nhật ký';
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finishRename = (cancel = false) => {
    if (finished) return;
    finished = true;
    if (!cancel) {
      const nextTitle = input.value.trim();
      page.title = nextTitle;
      saveState();
      if (page.id === state.activePageId) {
        pageTitleInput.value = nextTitle;
        topbarTitle.textContent = nextTitle || 'Nhật ký chưa đặt tên';
        updateWordCount();
      }
    }
    renderSidebar();
  };

  input.addEventListener('blur', () => finishRename(false));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finishRename(true);
    }
  });
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

  logoutBtn?.addEventListener('click', handleLogout);

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderSidebar();
  });

  pageListEl.addEventListener('click', (e) => {
    const renameId = e.target.dataset.rename;
    if (renameId) {
      e.stopPropagation();
      startRenamePage(renameId);
      return;
    }

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

  pageListEl.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.page-item');
    if (!item || e.target.closest('.delete-page-btn') || e.target.closest('.rename-page-btn')) return;
    e.preventDefault();
    e.stopPropagation();
    startRenamePage(item.dataset.id);
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
    document.getElementById('coverImageInput').click();
  });

  document.getElementById('coverImageInput').addEventListener('change', async (e) => {
    const page = getActivePage();
    const file = e.target.files?.[0];
    if (!page || !file) return;

    try {
      page.coverImage = await resizeCoverImage(file);
      saveState();
      renderActivePage();
    } catch (error) {
      alert(error.message);
    } finally {
      e.target.value = '';
    }
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