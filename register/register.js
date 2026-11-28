import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithCredential,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDuwXJDOXcL5-39e5eWuK6slSNooK-nYoM',
  authDomain: 'diary-88256.firebaseapp.com',
  projectId: 'diary-88256',
  storageBucket: 'diary-88256.firebasestorage.app',
  messagingSenderId: '981189600908',
  appId: '1:981189600908:web:00a74c3ded05dfb573bda9',
  measurementId: 'G-CEVCV6RNQT'
};

const hasFirebaseConfig =
  FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('YOUR_');

let auth = null;
let googleProvider = null;
let facebookProvider = null;

if (hasFirebaseConfig) {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  facebookProvider = new FacebookAuthProvider();
  facebookProvider.addScope('email');
}

const USERS_STORAGE_KEY = 'cozy_journal_users_v1';
const SESSION_STORAGE_KEY = 'cozy_journal_session_v1';
const JOURNAL_PREFIX = 'cozy_journal_data_';
const REDIRECT_PROVIDER_KEY = 'cozy_journal_oauth_redirect_provider_v1';
const PENDING_FACEBOOK_CREDENTIAL_KEY = 'cozy_journal_pending_facebook_credential_v1';
const PENDING_FACEBOOK_EMAIL_KEY = 'cozy_journal_pending_facebook_email_v1';

const COVER_GRADIENTS = [
  'linear-gradient(120deg, #2C2722 0%, #4A4034 55%, #1E1C19 100%)',
  'linear-gradient(120deg, #272522 0%, #3E3A34 50%, #1C1B19 100%)',
  'linear-gradient(120deg, #232723 0%, #374236 55%, #1C1B19 100%)',
  'linear-gradient(120deg, #282425 0%, #433B3D 55%, #1C1B19 100%)',
  'linear-gradient(120deg, #22201E 0%, #35312C 100%)'
];

const EMOJIS = ['☕', '🕯️', '📖', '🍂', '🌱', '✍️', '🌙', '🎧', '🪑', '💡', '🍵', '🧭', '📌', '🎨', '💻', '✨', '🏡', '🧸'];
const LEGACY_EMOJI_FALLBACKS = { '🪴': '🌱', '🪵': '🪑' };

let authMode = 'login';
let currentUser = null;
let pendingFacebookCredential = null;
let pendingFacebookEmail = '';

let state = {
  pages: [],
  activePageId: null,
  searchQuery: '',
  slashTargetBlockId: null
};

// Auth DOM Elements
const authScreenEl = document.getElementById('authScreen');
const appShellEl = document.getElementById('appShell');
const authHeadingEl = document.getElementById('authHeading');
const authSubEl = document.getElementById('authSub');
const authFormEl = document.getElementById('authForm');
const nameGroupEl = document.getElementById('nameGroup');
const authNameInput = document.getElementById('authName');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const eyeOpenIcon = document.getElementById('eyeOpenIcon');
const eyeOffIcon = document.getElementById('eyeOffIcon');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const facebookLoginBtn = document.getElementById('facebookLoginBtn');
const authErrorEl = document.getElementById('authError');
const inAppBrowserNoticeEl = document.getElementById('inAppBrowserNotice');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const switchAuthModeBtn = document.getElementById('switchAuthModeBtn');

// Workspace DOM Elements
const userAvatarEl = document.getElementById('userAvatar');
const currentUserNameEl = document.getElementById('currentUserName');
const currentUserEmailEl = document.getElementById('currentUserEmail');
const logoutBtn = document.getElementById('logoutBtn');
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

function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Instagram|Messenger|Zalo|TikTok|BytedanceWebview|musical_ly/i
    .test(navigator.userAgent || '');
}

function showOAuthError(message, err) {
  const code = err?.code || 'không có mã lỗi';
  const details = err?.message || String(err || 'Không có thông tin chi tiết.');
  authErrorEl.textContent = `${message}\nMã lỗi: ${code}\nChi tiết: ${details}`;
}

function isPopupFallbackError(err) {
  const popupErrors = [
    'auth/popup-blocked',
    'auth/popup-unsupported',
    'auth/operation-not-supported-in-this-environment'
  ];
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return popupErrors.includes(err?.code) ||
    (isMobile && err?.code === 'auth/web-storage-unsupported');
}

function init() {
  renderEmojiPicker();
  bindAuthEvents();
  bindWorkspaceEvents();
  if (isInAppBrowser()) {
    inAppBrowserNoticeEl.hidden = false;
  }

  if (auth) {
    const pendingOAuthRedirect = Boolean(sessionStorage.getItem(REDIRECT_PROVIDER_KEY));
    const redirectResultPromise = handleRedirectResult();
    onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        if (pendingOAuthRedirect && await redirectResultPromise) return;
        const providerId = fbUser.providerData?.[0]?.providerId || 'oauth';
        const profile = upsertOAuthUser({
          id: `oauth-${fbUser.uid}`,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Người dùng',
          email: fbUser.email || `${fbUser.uid}@oauth.local`,
          photoURL: extractPhotoURL(fbUser),
          provider: providerId
        });
        enterWorkspace(profile);
      } else if (!currentUser?.passwordHash) {
        showAuthScreen();
      }
    });
    return;
  }

  const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      const found = getUsers().find(u => u.id === session.userId);
      if (found) {
        enterWorkspace(found);
        return;
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  showAuthScreen();
}

/* ================= AUTH & USER STORAGE ================= */
function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function extractPhotoURL(fbUser) {
  if (!fbUser) return '';
  if (fbUser.photoURL) return fbUser.photoURL;
  const providerPhoto = fbUser.providerData?.find(p => p?.photoURL)?.photoURL;
  return providerPhoto || '';
}

function upsertOAuthUser(profile) {
  const users = getUsers();
  let existing = users.find(
    u => u.id === profile.id || (profile.email && u.email === profile.email)
  );
  if (!existing) {
    existing = {
      ...profile,
      photoURL: profile.photoURL || '',
      createdAt: new Date().toISOString()
    };
    users.push(existing);
  } else {
    existing.name = profile.name || existing.name;
    existing.email = profile.email || existing.email;
    if (profile.photoURL) {
      existing.photoURL = profile.photoURL;
    }
  }
  saveUsers(users);
  return existing;
}

function renderUserAvatar(user) {
  const displayName = user.name || user.email.split('@')[0];
  const initial = displayName.charAt(0).toUpperCase();

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

function hashPassword(password) {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function resetPasswordVisibility() {
  authPasswordInput.type = 'password';
  eyeOpenIcon.style.display = 'block';
  eyeOffIcon.style.display = 'none';
  togglePasswordBtn.setAttribute('aria-label', 'Hiện mật khẩu');
}

function setAuthMode(mode) {
  authMode = mode;
  authErrorEl.textContent = '';
  resetPasswordVisibility();

  if (mode === 'register') {
    authHeadingEl.textContent = 'Tạo tài khoản';
    authSubEl.textContent = 'Tạo hồ sơ riêng để lưu giữ nhật ký của bạn trên trình duyệt.';
    nameGroupEl.style.display = 'flex';
    authPasswordInput.setAttribute('autocomplete', 'new-password');
    authSubmitBtn.textContent = 'Tạo tài khoản';
    switchAuthModeBtn.textContent = 'Đã có tài khoản? Đăng nhập';
  } else {
    authHeadingEl.textContent = 'Đăng nhập';
    authSubEl.textContent = 'Chào mừng trở lại. Nhập thông tin để mở nhật ký của bạn.';
    nameGroupEl.style.display = 'none';
    authPasswordInput.setAttribute('autocomplete', 'current-password');
    authSubmitBtn.textContent = 'Tiếp tục với Email';
    switchAuthModeBtn.textContent = 'Chưa có tài khoản? Tạo tài khoản mới';
  }
}

function showAuthScreen() {
  currentUser = null;
  authScreenEl.style.display = 'flex';
  appShellEl.style.display = 'none';
  setAuthMode('login');
  authEmailInput.focus();
}

function enterWorkspace(user) {
  currentUser = user;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId: user.id }));

  authScreenEl.style.display = 'none';
  appShellEl.style.display = 'flex';

  const displayName = user.name || user.email.split('@')[0];
  renderUserAvatar(user);
  currentUserNameEl.textContent = displayName;
  currentUserEmailEl.textContent = user.email;

  loadUserJournals(user.id);
  renderSidebar();
  renderActivePage();
}

async function processOAuthResult(result, label) {
  let linkingFacebook = false;
  try {
    let u = result.user;

    if (label === 'Google' && pendingFacebookCredential) {
      const signedInEmail = (u.email || '').toLowerCase();
      if (pendingFacebookEmail && signedInEmail !== pendingFacebookEmail) {
        await signOut(auth);
        showOAuthError(`Hãy đăng nhập Google bằng email ${pendingFacebookEmail} để liên kết Facebook.`, {
          code: 'auth/email-mismatch',
          message: `Email Google phải trùng với ${pendingFacebookEmail}.`
        });
        return;
      }

      linkingFacebook = true;
      const linkedResult = await linkWithCredential(u, pendingFacebookCredential);
      u = linkedResult.user;
      pendingFacebookCredential = null;
      pendingFacebookEmail = '';
      linkingFacebook = false;
    }

    const profile = upsertOAuthUser({
      id: `oauth-${u.uid}`,
      name: u.displayName || u.email?.split('@')[0] || `Tài khoản ${label}`,
      email: u.email || `${u.uid}@${label.toLowerCase()}.local`,
      photoURL: extractPhotoURL(u),
      provider: label
    });
    authFormEl.reset();
    resetPasswordVisibility();
    enterWorkspace(profile);
  } catch (err) {
    if (linkingFacebook) {
      if (err?.code === 'auth/credential-already-in-use') {
        pendingFacebookCredential = null;
        pendingFacebookEmail = '';
        showOAuthError(
          'Tài khoản Facebook này đã được liên kết với một tài khoản nhật ký khác.',
          err
        );
      } else {
        showOAuthError(
          `Đã đăng nhập Google nhưng chưa liên kết được Facebook (${err?.code || 'lỗi Firebase'}). Bạn vẫn có thể dùng tài khoản Google.`,
          err
        );
      }
      return;
    }

    showOAuthError(`Đăng nhập ${label} thất bại.`, err);
  }
}

async function handleOAuthError(err, provider, label) {
  if (err?.code === 'auth/popup-closed-by-user') return;

  if (err?.code === 'auth/account-exists-with-different-credential' && label === 'Facebook') {
    pendingFacebookCredential = FacebookAuthProvider.credentialFromError(err);
    pendingFacebookEmail = (err.customData?.email || '').toLowerCase();
    if (pendingFacebookCredential) {
      const accountEmail = pendingFacebookEmail ? ` (${pendingFacebookEmail})` : '';
      showOAuthError(
        `Tài khoản${accountEmail} đã được đăng ký bằng một phương thức khác, thường là Google. ` +
        'Bấm "Tiếp tục với Google" bằng đúng email đó để đăng nhập và liên kết Facebook.',
        err
      );
      return;
    }
  }

  if (isPopupFallbackError(err)) {
    try {
      sessionStorage.setItem(REDIRECT_PROVIDER_KEY, label);
      if (pendingFacebookCredential) {
        sessionStorage.setItem(
          PENDING_FACEBOOK_CREDENTIAL_KEY,
          JSON.stringify(pendingFacebookCredential.toJSON())
        );
        sessionStorage.setItem(PENDING_FACEBOOK_EMAIL_KEY, pendingFacebookEmail);
      }
      await signInWithRedirect(auth, provider);
      return;
    } catch (redirectError) {
      sessionStorage.removeItem(REDIRECT_PROVIDER_KEY);
      sessionStorage.removeItem(PENDING_FACEBOOK_CREDENTIAL_KEY);
      sessionStorage.removeItem(PENDING_FACEBOOK_EMAIL_KEY);
      showOAuthError(`Không thể chuyển sang đăng nhập ${label} bằng chuyển hướng.`, redirectError);
      return;
    }
  }

  if (err?.code === 'auth/unauthorized-domain') {
    showOAuthError(
      'Tên miền website chưa được thêm vào Firebase Authentication > Authorized domains.',
      err
    );
    return;
  }

  if (err?.code === 'auth/operation-not-allowed') {
    showOAuthError(
      `Đăng nhập ${label} chưa được bật trong Firebase Authentication > Sign-in method.`,
      err
    );
    return;
  }

  showOAuthError(`Đăng nhập ${label} thất bại.`, err);
}

async function handleOAuthSignIn(provider, label) {
  authErrorEl.textContent = '';
  if (!auth || !provider) {
    authErrorEl.textContent =
      `Chưa điền FIREBASE_CONFIG thật trong register.js nên chưa mở đăng nhập ${label} thật được.`;
    return;
  }

  try {
    const popupPromise = signInWithPopup(auth, provider);
    const result = await popupPromise;
    await processOAuthResult(result, label);
  } catch (err) {
    await handleOAuthError(err, provider, label);
  }
}

async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (!result) {
      sessionStorage.removeItem(REDIRECT_PROVIDER_KEY);
      sessionStorage.removeItem(PENDING_FACEBOOK_CREDENTIAL_KEY);
      sessionStorage.removeItem(PENDING_FACEBOOK_EMAIL_KEY);
      return false;
    }

    const label = sessionStorage.getItem(REDIRECT_PROVIDER_KEY) ||
      (result.providerId === 'facebook.com' ? 'Facebook' : 'Google');
    sessionStorage.removeItem(REDIRECT_PROVIDER_KEY);

    const savedCredential = sessionStorage.getItem(PENDING_FACEBOOK_CREDENTIAL_KEY);
    if (savedCredential) {
      pendingFacebookCredential = OAuthProvider.credentialFromJSON(JSON.parse(savedCredential));
      pendingFacebookEmail = sessionStorage.getItem(PENDING_FACEBOOK_EMAIL_KEY) || '';
      sessionStorage.removeItem(PENDING_FACEBOOK_CREDENTIAL_KEY);
      sessionStorage.removeItem(PENDING_FACEBOOK_EMAIL_KEY);
    }

    await processOAuthResult(result, label);
    return true;
  } catch (err) {
    const label = sessionStorage.getItem(REDIRECT_PROVIDER_KEY) || 'OAuth';
    sessionStorage.removeItem(REDIRECT_PROVIDER_KEY);
    sessionStorage.removeItem(PENDING_FACEBOOK_CREDENTIAL_KEY);
    sessionStorage.removeItem(PENDING_FACEBOOK_EMAIL_KEY);
    showOAuthError(`Đăng nhập ${label} bằng chuyển hướng thất bại.`, err);
    return false;
  }
}

function getJournalStorageKey(userId) {
  return `${JOURNAL_PREFIX}${userId}`;
}

function loadUserJournals(userId) {
  const raw = localStorage.getItem(getJournalStorageKey(userId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state.pages = Array.isArray(parsed.pages) ? parsed.pages : [];
      let migratedEmoji = false;
      state.pages.forEach(page => {
        const replacement = LEGACY_EMOJI_FALLBACKS[page.emoji];
        if (replacement) {
          page.emoji = replacement;
          migratedEmoji = true;
        }
      });
      state.activePageId = state.pages.some(p => p.id === parsed.activePageId)
        ? parsed.activePageId
        : (state.pages[0]?.id || null);
      state.searchQuery = '';
      searchInput.value = '';
      if (migratedEmoji) saveState();
      return;
    } catch {
      // Fallback nếu dữ liệu lỗi
    }
  }

  state.pages = [];
  state.activePageId = null;
  state.searchQuery = '';
  searchInput.value = '';
}

function saveState() {
  if (!currentUser) return;
  saveStatusEl.textContent = 'Đang lưu...';
  try {
    localStorage.setItem(
      getJournalStorageKey(currentUser.id),
      JSON.stringify({
        pages: state.pages,
        activePageId: state.activePageId
      })
    );
  } catch (error) {
    saveStatusEl.textContent = 'Không thể lưu';
    saveStatusEl.title = error.message || 'Không đủ dung lượng lưu dữ liệu trên thiết bị.';
    return false;
  }
  saveStatusEl.title = '';
  setTimeout(() => {
    saveStatusEl.textContent = 'Đã lưu';
  }, 250);
  return true;
}

function bindAuthEvents() {
  togglePasswordBtn.addEventListener('click', () => {
    const isHidden = authPasswordInput.type === 'password';
    authPasswordInput.type = isHidden ? 'text' : 'password';
    eyeOpenIcon.style.display = isHidden ? 'none' : 'block';
    eyeOffIcon.style.display = isHidden ? 'block' : 'none';
    togglePasswordBtn.setAttribute('aria-label', isHidden ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  });

  googleLoginBtn.addEventListener('click', () => {
    handleOAuthSignIn(googleProvider, 'Google');
  });

  facebookLoginBtn.addEventListener('click', () => {
    handleOAuthSignIn(facebookProvider, 'Facebook');
  });

  switchAuthModeBtn.addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });

  authFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    authErrorEl.textContent = '';

    const name = authNameInput.value.trim();
    const email = authEmailInput.value.trim().toLowerCase();
    const password = authPasswordInput.value;

    if (!email) {
      authErrorEl.textContent = 'Vui lòng nhập email hoặc tên đăng nhập.';
      authEmailInput.focus();
      return;
    }

    if (password.length < 4) {
      authErrorEl.textContent = 'Mật khẩu cần ít nhất 4 ký tự.';
      authPasswordInput.focus();
      return;
    }

    const users = getUsers();
    const passwordHash = hashPassword(password);

    if (authMode === 'register') {
      const exists = users.some(u => u.email === email);
      if (exists) {
        authErrorEl.textContent = 'Tài khoản này đã tồn tại. Hãy chuyển sang đăng nhập.';
        return;
      }

      const newUser = {
        id: 'user-' + Date.now(),
        name: name || email.split('@')[0],
        email,
        passwordHash,
        photoURL: '',
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveUsers(users);
      authFormEl.reset();
      resetPasswordVisibility();
      enterWorkspace(newUser);
    } else {
      const matched = users.find(u => u.email === email);
      if (!matched) {
        authErrorEl.textContent = 'Không tìm thấy tài khoản. Hãy bấm "Tạo tài khoản mới" ở dưới.';
        return;
      }
      if (!matched.passwordHash || matched.passwordHash !== passwordHash) {
        authErrorEl.textContent = 'Mật khẩu chưa chính xác.';
        authPasswordInput.focus();
        return;
      }

      authFormEl.reset();
      resetPasswordVisibility();
      enterWorkspace(matched);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    closeSlashMenu();
    emojiPopover.classList.remove('open');
    if (auth && auth.currentUser) {
      try {
        await signOut(auth);
      } catch {
        // Bỏ qua lỗi signOut nếu có
      }
    }
    showAuthScreen();
  });
}

/* ================= JOURNAL WORKSPACE ================= */
function getActivePage() {
  return state.pages.find(p => p.id === state.activePageId) || null;
}

function createNewJournal() {
  if (!currentUser) return;
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
        const scale = Math.min(1280 / image.width, 720 / image.height, 1);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.fillStyle = '#1C1B19';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Không thể xử lý ảnh này.'));
            return;
          }
          const resultReader = new FileReader();
          resultReader.onload = () => resolve(resultReader.result);
          resultReader.onerror = () => reject(new Error('Không thể đọc ảnh đã xử lý.'));
          resultReader.readAsDataURL(blob);
        }, 'image/jpeg', 0.76);
      };
      image.onerror = () => reject(new Error('Không thể đọc ảnh này.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Không thể mở tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function bindWorkspaceEvents() {
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

  document.querySelector('.add-block-bar').addEventListener('click', (e) => {
    const button = e.target.closest('[data-insert]');
    if (button) appendBlock(button.dataset.insert);
  });

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

    const previousCover = page.coverImage;
    try {
      page.coverImage = await resizeCoverImage(file);
      if (!saveState()) {
        page.coverImage = previousCover;
        alert('Không đủ dung lượng lưu ảnh bìa. Hãy thử chọn ảnh nhỏ hơn hoặc xóa bớt nhật ký.');
      }
      renderActivePage();
    } catch (error) {
      alert(error.message || 'Không thể cập nhật ảnh bìa.');
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