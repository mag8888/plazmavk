// Telegram Web App API
const tg = window.Telegram?.WebApp;

// Initialize Telegram Web App
if (tg) {
    tg.ready();
    tg.expand();

    // Use Telegram theme colors
    // Force Monochrome Premium Theme (Ignore Telegram Dark Mode)
    // Force Dark Header to match new design
    tg.setHeaderColor('#0d1b2a');
    tg.setBackgroundColor('#ffffff');

    // Reset CSS variables to strict white theme
    document.documentElement.style.setProperty('--tg-bg-color', '#ffffff');
    document.documentElement.style.setProperty('--tg-text-color', '#000000');
    document.documentElement.style.setProperty('--tg-secondary-bg-color', '#f9f9f9');
    document.documentElement.style.setProperty('--tg-button-color', '#000000');
    document.documentElement.style.setProperty('--tg-button-text-color', '#ffffff');

    // Handle viewport changes (only expand)
    tg.onEvent('viewportChanged', () => {
        tg.expand();
    });

    // Force light theme status bar
    if (tg.setHeaderColor) {
        if (tg.setHeaderColor) {
            tg.setHeaderColor('#0d1b2a');
        }
    }
}

// Global state
let currentSection = null;
let userData = null;
let cartItems = [];
let favoritesSet = new Set();
let supportChatInterval = null;

// API Base URL - adjust based on your backend
const API_BASE = '/webapp/api';

// Shop/catalog UI state (tabs)
let SHOP_ACTIVE_CATEGORY_ID = 'all'; // 'all' | categoryId
let SHOP_CATEGORIES_CACHE = null;
let SHOP_PRODUCTS_CACHE = null;

// Certificates (types)
let CERT_TYPES_CACHE = null;

// Optional client-side catalog structure (categories -> subcategories -> SKU mapping)
let CATALOG_STRUCTURE = null;

async function loadCatalogStructure() {
    if (CATALOG_STRUCTURE) return CATALOG_STRUCTURE;
    try {
        const res = await fetch(`${API_BASE}/catalog-structure`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.success && Array.isArray(data.structure)) {
            CATALOG_STRUCTURE = data.structure;
            return CATALOG_STRUCTURE;
        }
    } catch (e) {
        console.warn('Failed to load catalog structure:', e);
    }
    CATALOG_STRUCTURE = null;
    return null;
}

function normalizeSku(sku) {
    return String(sku || '').trim().toUpperCase();
}

function skuPrefix(sku) {
    const s = normalizeSku(sku);
    const m = s.match(/^([A-Z]{1,3}\\d{4})-/);
    return m ? m[1] : '';
}

function matchProductsByRelatedSkus(allProducts, relatedSkus) {
    const want = (Array.isArray(relatedSkus) ? relatedSkus : []).map(normalizeSku);
    const wantSet = new Set(want);
    const wantPrefixes = new Set(want.map(skuPrefix).filter(Boolean));

    const out = [];
    const seen = new Set();
    for (const p of (allProducts || [])) {
        const ps = normalizeSku(p.sku || '');
        if (!ps) continue;
        const okExact = wantSet.has(ps);
        const okPrefix = wantPrefixes.size ? wantPrefixes.has(skuPrefix(ps)) : false;
        if (okExact || okPrefix) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                out.push(p);
            }
        }
    }
    return out;
}

function dedupeByKey(items, getKey) {
    const out = [];
    const seen = new Set();
    for (const item of (items || [])) {
        const key = String(getKey(item) || '');
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

function dedupeProductsById(products) {
    const out = [];
    const seen = new Set();
    for (const p of (products || [])) {
        const id = p && p.id;
        if (!id) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(p);
    }
    return out;
}

function dedupeCategoriesPreferMoreProducts(categories, productsByCategory) {
    // 1) убираем повторы по id
    const byId = new Map();
    (categories || []).forEach(cat => {
        if (cat && cat.id && !byId.has(cat.id)) byId.set(cat.id, cat);
    });
    const uniqueById = Array.from(byId.values());

    // 2) убираем повторы по name (берём категорию с большим количеством товаров)
    const byName = new Map();
    uniqueById.forEach(cat => {
        const name = String(cat?.name || '').trim();
        if (!name) return;
        const count = (productsByCategory && productsByCategory[cat.id]) ? productsByCategory[cat.id].length : 0;
        const prev = byName.get(name);
        if (!prev || count > prev.count) {
            byName.set(name, { cat, count });
        }
    });
    return Array.from(byName.values()).map(x => x.cat);
}

async function fetchAllActiveProducts() {
    const categoriesRes = await fetch(`${API_BASE}/categories`);
    if (!categoriesRes.ok) throw new Error('Failed to fetch categories');
    const categories = await categoriesRes.json();
    const all = [];
    (categories || []).forEach(cat => {
        (cat.products || []).forEach(p => all.push(p));
    });
    return all;
}

// Get Telegram user data
function getTelegramUserData() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return tg.initDataUnsafe.user;
    }

    // Fallback for development
    // return {
    //     id: 123456789,
    //     first_name: 'Test',
    //     last_name: 'User',
    //     username: 'testuser',
    //     language_code: 'ru'
    // };
    return null;
}

// Get headers with Telegram user data
function getApiHeaders() {
    const user = getTelegramUserData();
    let userJson = '{}';
    try {
        userJson = JSON.stringify(user || {});
    } catch (e) {
        console.error('Error stringifying user:', e);
    }

    const headers = {
        'Content-Type': 'application/json',
        'X-Telegram-User': encodeURIComponent(userJson)
    };

    // Add init data if available (for backend verification)
    if (tg && tg.initData) {
        headers['X-Telegram-Init-Data'] = tg.initData;
    }

    return headers;
}

// 1 PZ = 100 RUB
function pzToRub(pz) {
    const val = Math.round(Number(pz || 0) * 100);
    return val.toLocaleString('ru-RU');
}

// Just format PZ value (e.g. "120 PZ")
function formatPz(pz) {
    const val = Math.round(Number(pz || 0));
    return `${val} PZ`;
}

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    loadUserData();
    loadCartItems();
    loadFavorites();
    updateBadges();
    loadProductsOnMainPage(); // Load products immediately on main page
    loadRegions(); // Load dynamic regions
    checkGiftActivation(); // Activate gift if opened via gift link

    // Apply Telegram theme colors on load
    // Force Telegram Theme Variables Override on Load
    if (tg) {
        document.documentElement.style.setProperty('--tg-bg-color', '#ffffff');
        document.documentElement.style.setProperty('--tg-text-color', '#000000');
        document.documentElement.style.setProperty('--tg-secondary-bg-color', '#f9f9f9');
        document.documentElement.style.setProperty('--tg-button-color', '#000000');
        document.documentElement.style.setProperty('--tg-button-text-color', '#ffffff');
        document.documentElement.style.setProperty('--accent', '#000000');
    }

    // Add haptic feedback for buttons (if available)
    function addHapticFeedback(element) {
        element.addEventListener('click', function () {
            if (tg && tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
    }

    // Add haptic feedback to all buttons
    document.querySelectorAll('.btn, .control-btn, .back-btn, .content-card, .nav-item').forEach(addHapticFeedback);
});

// Ensure product cards open details on click (even if markup changes)
document.addEventListener('click', function (e) {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('button, a, input, label, .favorite-btn')) return;
    const card = target.closest('.product-card-forma, .product-card-forma-horizontal');
    if (!card) return;
    const id = card.getAttribute('data-product-id');
    if (!id) return;
    const type = card.getAttribute('data-product-type');
    if (type === 'plazma') showPlazmaProductDetails(id);
    else showProductDetails(id);
});

// Favorites (webapp)
async function loadFavorites() {
    try {
        const response = await fetch(`${API_BASE}/favorites`, { headers: getApiHeaders() });
        if (!response.ok) {
            favoritesSet = new Set();
            return;
        }
        const data = await response.json();
        const ids = Array.isArray(data?.productIds) ? data.productIds : [];
        favoritesSet = new Set(ids.map(String));
    } catch (e) {
        console.error('❌ Error loading favorites:', e);
        favoritesSet = new Set();
    }
}

function isFavorite(productId) {
    return favoritesSet && favoritesSet.has(String(productId));
}

function renderFavoriteButton(productId) {
    const active = isFavorite(productId);
    const cls = active ? 'favorite-btn active' : 'favorite-btn';
    const label = active ? 'Убрать из избранного' : 'В избранное';
    const icon = active ? '♥' : '♡';
    return `<button class="${cls}" aria-label="${label}" title="${label}" onclick="event.stopPropagation(); toggleFavorite('${productId}', this)">${icon}</button>`;
}

async function toggleFavorite(productId, btnEl) {
    if (!productId) return;
    try {
        // Optimistic update
        const currently = isFavorite(productId);
        if (currently) favoritesSet.delete(String(productId));
        else favoritesSet.add(String(productId));

        if (btnEl) {
            const nowActive = !currently;
            btnEl.classList.toggle('active', nowActive);
            btnEl.textContent = nowActive ? '♥' : '♡';
        }

        const response = await fetch(`${API_BASE}/favorites/toggle`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ productId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const serverActive = !!data?.isFavorite;
        if (serverActive) favoritesSet.add(String(productId));
        else favoritesSet.delete(String(productId));

        if (btnEl) {
            btnEl.classList.toggle('active', serverActive);
            btnEl.textContent = serverActive ? '♥' : '♡';
        }

        // If we're currently in favorites screen, refresh it
        if (currentSection === 'favorites') {
            const body = document.getElementById('section-body');
            if (body) {
                body.innerHTML = await loadFavoritesContent();
            }
        }
    } catch (e) {
        console.error('❌ Error toggling favorite:', e);
        showError('Не удалось обновить избранное. Попробуйте позже.');
        await loadFavorites();
        if (btnEl) {
            const active = isFavorite(productId);
            btnEl.classList.toggle('active', active);
            btnEl.textContent = active ? '♥' : '♡';
        }
    }
}

// Navigation functions
function closeApp() {
    if (tg) {
        tg.close();
    } else {
        // Fallback for development
        console.log('Closing app...');
    }
}

// Menu functions
function openMenu() {
    const drawer = document.getElementById('menu-drawer');
    drawer.classList.remove('hidden');
    setTimeout(() => {
        drawer.classList.add('open');
    }, 10);
}

function closeMenu() {
    const drawer = document.getElementById('menu-drawer');
    drawer.classList.remove('open');
    setTimeout(() => {
        drawer.classList.add('hidden');
    }, 300);
}

// Search functions
function openSearch() {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('open');
        loadCategoriesForSearch();
    }, 10);
}

function closeSearch() {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.remove('open');
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 300);
}

async function loadCategoriesForSearch() {
    const container = document.getElementById('search-body');
    try {
        const structure = await loadCatalogStructure();
        if (structure && structure.length > 0) {
            let html = '<div class="categories-list">';
            structure.forEach(group => {
                html += `
                    <div class="category-item" onclick="openStructuredCategory('${group.id}')">
                        <span class="category-icon">📁</span>
                        <span class="category-name">${escapeHtml(group.name)}</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        // fallback to DB categories
        const response = await fetch(`${API_BASE}/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        const categories = await response.json();
        if (categories && categories.length > 0) {
            let html = '<div class="categories-list">';
            categories.forEach(category => {
                html += `
                    <div class="category-item" onclick="showCategoryProducts('${category.id}')">
                        <span class="category-icon">📁</span>
                        <span class="category-name">${escapeHtml(category.name)}</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="empty-state"><p>Категории не найдены</p></div>';
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        container.innerHTML = '<div class="error-message"><p>Ошибка загрузки категорий</p></div>';
    }
}

async function openStructuredCategory(groupId) {
    closeSearch();
    openSection('shop');
    await showStructuredCategory(groupId);
}

async function showStructuredCategory(groupId) {
    const container = document.getElementById('section-body');
    try {
        const structure = await loadCatalogStructure();
        const group = (structure || []).find(g => g.id === groupId);
        if (!group) throw new Error('Category group not found');

        let html = '<div class="content-section">';
        html += `<button class="btn-back-to-catalog" onclick="openSection('shop')" style="margin-bottom: 12px;">← Назад</button>`;
        html += `<h3>${escapeHtml(group.name)}</h3>`;
        html += '<div class="categories-list" style="margin-top:10px;">';
        (group.subcategories || []).forEach(sc => {
            html += `
                <div class="category-item" onclick="showStructuredSubcategory('${group.id}','${sc.id}')">
                    <span class="category-icon">🧴</span>
                    <span class="category-name">${escapeHtml(sc.name)}</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            `;
        });
        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Structured category error:', e);
        container.innerHTML = '<div class="error-message"><p>Ошибка загрузки категорий</p></div>';
    }
}

async function showStructuredSubcategory(groupId, subId) {
    const container = document.getElementById('section-body');
    try {
        const structure = await loadCatalogStructure();
        const group = (structure || []).find(g => g.id === groupId);
        const sub = group && (group.subcategories || []).find(s => s.id === subId);
        if (!group || !sub) throw new Error('Subcategory not found');

        const allProducts = await fetchAllActiveProducts();
        const products = matchProductsByRelatedSkus(allProducts, sub.related_skus);

        let html = '<div class="content-section">';
        html += `<button class="btn-back-to-catalog" onclick="showStructuredCategory('${group.id}')" style="margin-bottom: 12px;">← ${escapeHtml(group.name)}</button>`;
        html += `<h3>${escapeHtml(sub.name)}</h3>`;
        if (sub.description) html += `<p style="color:#6b7280; margin-top:6px;">${escapeHtml(sub.description)}</p>`;

        if (products && products.length > 0) {
            html += '<div class="products-grid" style="margin-top:12px;">';
            products.forEach(product => { html += renderProductCard(product); });
            html += '</div>';
        } else {
            html += '<div class="empty-state"><p>Товары не найдены</p></div>';
        }

        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Structured subcategory error:', e);
        container.innerHTML = '<div class="error-message"><p>Ошибка загрузки товаров</p></div>';
    }
}

function showCategoryProducts(categoryId) {
    closeSearch();
    openShopCategory(categoryId);
}

async function loadProductsByCategory(categoryId) {
    const container = document.getElementById('section-body');
    try {
        // Backward compatible wrapper - now uses tabbed catalog
        await openShopCategory(categoryId);
    } catch (error) {
        console.error('Error loading products:', error);
        container.innerHTML = '<div class="error-message"><p>Ошибка загрузки товаров</p></div>';
    }
}

// Profile functions
function openProfile() {
    openSection('balance');
}

function closeProfile() {
    const overlay = document.getElementById('profile-overlay');
    overlay.classList.remove('open');
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 300);
}

async function loadProfileContent() {
    const container = document.getElementById('profile-body');
    try {
        // Load user profile and partner data
        const [userResponse, partnerResponse] = await Promise.all([
            fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() }),
            fetch(`${API_BASE}/partner/dashboard`, { headers: getApiHeaders() }).catch(() => ({ ok: false }))
        ]);

        if (!userResponse.ok) throw new Error('Failed to load user profile');

        const user = await userResponse.json();
        const partnerData = partnerResponse.ok ? await partnerResponse.json() : null;

        // Handle structure { profile: ..., stats: ... }
        const partner = partnerData?.profile || null;
        const stats = partnerData?.stats || null;

        const telegramUser = getTelegramUserDataSafe(); // Use safe wrapper

        // Реферальная ссылка с юзернеймом в конце
        // FORCED to iplazmabot as per user request
        const botUsername = 'iplazmabot';
        let referralLink = `https://t.me/${botUsername}`;

        // Получаем username пользователя для реферальной ссылки
        let username = null;
        if (telegramUser?.username?.trim()) {
            username = telegramUser.username.trim();
        } else if (user?.username?.trim()) {
            username = user.username.trim();
        }

        // Формируем ссылку: ПРИОРИТЕТ 1 - referralCode партнера
        if (partner?.referralCode) {
            const prefix = partner.programType === 'MULTI_LEVEL' ? 'ref_multi' : 'ref_direct';
            referralLink = `https://t.me/${botUsername}?start=${prefix}_${partner.referralCode}`;
        }
        // ПРИОРИТЕТ 2 - username (старый формат)
        else if (username) {
            referralLink = `https://t.me/${botUsername}?start=${username}`;
        }
        // Fallback: используем ID
        else {
            const userId = telegramUser?.id || user?.telegramId;
            if (userId) {
                referralLink = `https://t.me/${botUsername}?start=${userId}`;
            }
        }

        let html = `
            <div class="profile-content-wrapper">
                <div class="profile-header-info">
                    <div class="profile-avatar">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                    <h3>${escapeHtml(user.firstName || 'Пользователь')} ${escapeHtml(user.lastName || '')}</h3>
                    ${user.username ? `<p class="profile-username">@${escapeHtml(user.username)}</p>` : ''}
                </div>
                
                <div class="profile-section">
                    <h4>Реферальная ссылка</h4>
                    <div class="referral-link-box">
                        <input type="text" id="referral-link-input" value="${escapeHtml(referralLink)}" readonly onclick="this.select();">
                        <button class="btn-copy" onclick="copyReferralLink()">📋</button>
                    </div>
                    <p class="referral-hint">Поделитесь этой ссылкой с друзьями и получайте бонусы!</p>
                </div>
        `;

        if (partner) {
            // Partner Dashboard
            const referralCode = partner.referralCode;
            const balance = partner.balance || 0;
            const bonuses = partner.bonus || 0;
            const totalPartners = stats?.partners || partner.totalPartners || 0;

            const isActive = partner.isActive;
            const expiresAt = partner.expiresAt ? new Date(partner.expiresAt) : null;
            const activatedAt = partner.activatedAt ? new Date(partner.activatedAt) : null;

            // Format dates
            const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const expireDateStr = expiresAt ? dateFormatter.format(expiresAt) : '-';
            const activeSinceStr = activatedAt ? dateFormatter.format(activatedAt) : '-';

            html += `
            <div class="partner-dashboard">
                <div class="partner-header">
                    <h2>Партнёрская программа</h2>
                    <div class="partner-status ${isActive ? 'badge-success' : 'badge-warning'}">
                        ${isActive ? 'Активен' : 'Не активен'}
                    </div>
                </div>
                
                ${isActive ? `
                <div class="partner-subscription-info" style="margin-bottom: 15px; padding: 12px; background: #f0f7ff; border-radius: 8px;">
                    <div style="font-size: 14px; margin-bottom: 4px;">📅 Подписка активна до: <strong>${expireDateStr}</strong></div>
                    <div style="font-size: 14px; color: #666;">Следующий платеж: ${expireDateStr}</div>
                </div>
                ` : `
                <div class="partner-subscription-info" style="margin-bottom: 15px; padding: 12px; background: #fff3f3; border-radius: 8px;">
                     <div style="font-size: 14px; color: #d63031;">Подписка не активна. Совершите покупку от 12 000 ₽ для активации.</div>
                </div>
                `}

                <div class="partner-stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${balance.toFixed(0)} ₽</div>
                        <div class="stat-label">Баланс</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${bonuses.toFixed(0)} ₽</div>
                        <div class="stat-label">Заработано</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${totalPartners}</div>
                        <div class="stat-label">Партнёров</div>
                    </div>
                </div>

                <div class="referral-section">
                    <h3>Ваша реферальная ссылка</h3>
                    <p>Станьте партнёром Plazma Water и получайте 15% по вашей ссылке!</p>
                    
                    <div class="referral-link-box">
                        <input type="text" value="${referralLink}" readonly id="refLinkInput">
                        <button class="btn-icon" onclick="copyReferralLink()">
                            📋
                        </button>
                    </div>

                    <div style="margin-top: 12px; display: flex; gap: 10px;">
                        <button class="btn" onclick="shareReferralLink('${referralLink}')">
                            📤 Поделиться
                        </button>
                         <button class="btn btn-secondary" onclick="showQrCode('${escapeAttr(partner.referralDirectQrUrl || '')}')" style="width: auto; aspect-ratio: 1;">
                            📱 QR
                        </button>
                    </div>
                </div>

                <div class="partner-info-card">
                    <h3>Условия программы</h3>
                    <ul class="partner-benefits">
                        <li>
                            <span class="benefit-icon">💎</span>
                            <div>
                                <strong>15% с покупок</strong>
                                <p>Вы получаете 15% от суммы заказов ваших прямых рефералов.</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>`;
        } else {
            // Not a partner or not active
            html += `
            <div class="partner-promo">
                <div class="promo-icon">🤝</div>
                <h2>Станьте партнёром</h2>
                <p>Рекомендуйте Plazma и зарабатывайте 15% с покупок ваших друзей!</p>

                <div class="benefits-grid">
                    <div class="benefit-item">
                        <div class="benefit-value">15%</div>
                        <div class="benefit-desc">Комиссия с продаж</div>
                    </div>
                    <div class="benefit-item">
                        <div class="benefit-value">0 ₽</div>
                        <div class="benefit-desc">Вложений</div>
                    </div>
                </div>

                <div class="promo-actions">
                   <p style="opacity: 0.8; font-size: 14px; margin-bottom: 16px;">
                     Для активации партнерской программы необходимо совершить покупку от 12 000 ₽.
                   </p>
                   <button class="btn" onclick="openShop()">Перейти в каталог</button>
                </div>
            </div>`;
        }

        html += `
                <div class="profile-section">
                    <h4>Баланс</h4>
                    <div class="balance-display">
                        <span class="balance-value">${formatRubFromPz(user.balance || 0)}</span>
                    </div>
                    <button class="btn" onclick="openSection('balance')" style="margin-top: 12px; width: 100%;">Пополнить баланс</button>
                </div>
            </div>
        `;

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading profile:', error);
        container.innerHTML = '<div class="error-message"><p>Ошибка загрузки профиля</p></div>';
    }
}

function shareReferralLink(link) {
    if (!link) { showError('Ссылка не загружена'); return; }
    const text = `Привет! Присоединяйся к Plazma Water — натуральная плазменная вода для здоровья и красоты 💧\n\nПереходи по ссылке: ${link}`;
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

    // Try Telegram WebApp first
    if (window.Telegram?.WebApp?.openTelegramLink) {
        try { window.Telegram.WebApp.openTelegramLink(tgShareUrl); return; } catch (e) { }
    }
    // Fallback: open link
    if (window.Telegram?.WebApp?.openLink) {
        try { window.Telegram.WebApp.openLink(tgShareUrl); return; } catch (e) { }
    }
    // Browser fallback
    window.open(tgShareUrl, '_blank');
}

async function copyReferralLink(link) {
    const input = document.getElementById('referral-link-input');

    let linkText = (link ?? (input?.value ?? '')).toString();

    // Clean up the link text - remove any undefined/null values
    if (linkText.includes('undefined') || linkText.includes('null')) {
        console.warn('Link contains undefined/null, cleaning up...');
        linkText = linkText.replace(/undefined/g, '').replace(/null/g, '');
    }

    linkText = linkText.trim();

    // Final validation
    if (!linkText || linkText === 'undefined' || linkText === 'null') {
        console.error('Referral link is empty or invalid:', linkText);
        showError('Ошибка: ссылка не загружена. Попробуйте обновить страницу.');
        return;
    }

    // Ensure it's a valid URL
    if (!linkText.startsWith('http')) {
        console.error('Invalid link format:', linkText);
        showError('Ошибка: неверный формат ссылки');
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(linkText);
        } else {
            // Fallback for older browsers
            if (input) {
                input.value = linkText;
                input.select();
                input.setSelectionRange(0, 99999);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = linkText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
        }

        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }

        showSuccess('✅ Реферальная ссылка скопирована!');
    } catch (error) {
        console.error('Error copying referral link:', error);
        showError('Ошибка копирования ссылки. Попробуйте выделить и скопировать вручную.');
    }
}

// Cart function
function openCart() {
    openSection('cart');
}

async function loadCartContent() {
    try {
        const response = await fetch(`${API_BASE}/cart/items`, { headers: getApiHeaders() });

        if (!response.ok) {
            if (response.status === 401) {
                console.warn('⚠️ Unauthorized - user not authenticated');
                return `
                    <div class="content-section">
                        <h3>Корзина</h3>
                        <p>Для просмотра корзины необходимо авторизоваться</p>
                        <button class="btn" onclick="closeSection(); loadProductsOnMainPage();">Перейти к каталогу</button>
                    </div>
                `;
            }

            if (response.status === 503) {
                console.error('❌ Service unavailable');
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: 'Сервис временно недоступен' };
                }
                return `
                    <div class="content-section">
                        <div class="error-message">
                            <h3>Сервис временно недоступен</h3>
                            <p>${errorData.error || 'База данных временно недоступна. Попробуйте позже.'}</p>
                            <button class="btn" onclick="closeSection(); loadProductsOnMainPage();" style="margin-top: 16px;">
                                Перейти к каталогу
                            </button>
                        </div>
                    </div>
                `;
            }

            let errorData = {};
            try {
                errorData = await response.json();
            } catch (e) {
                const errorText = await response.text();
                errorData = { error: errorText || 'Неизвестная ошибка' };
            }

            console.error('❌ Cart loading error:', response.status, errorData);
            return `
                <div class="content-section">
                    <div class="error-message">
                        <h3>Ошибка загрузки корзины</h3>
                        <p>${errorData.error || 'Произошла ошибка при загрузке корзины. Попробуйте обновить страницу.'}</p>
                        <button class="btn" onclick="closeSection(); location.reload();" style="margin-top: 16px;">
                            Обновить страницу
                        </button>
                        <button class="btn btn-secondary" onclick="closeSection(); loadProductsOnMainPage();" style="margin-top: 12px;">
                            Перейти к каталогу
                        </button>
                    </div>
                </div>
            `;
        }

        const items = await response.json();

        // Загружаем данные пользователя для отображения баланса
        let userBalance = 0;
        try {
            const userResponse = await fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() });
            if (userResponse.ok) {
                const userData = await userResponse.json();
                userBalance = userData.balance || 0;
            }
        } catch (error) {
            console.warn('⚠️ Failed to load user balance:', error);
            // Продолжаем без баланса
        }

        if (!items || items.length === 0) {
            return `
                <div class="content-section">
                    <h3>Корзина пуста</h3>
                    <p>Добавьте товары в корзину, чтобы продолжить</p>
                    <button class="btn" onclick="closeSection(); loadProductsOnMainPage();">Перейти к каталогу</button>
                </div>
            `;
        }

        let total = 0;
        let html = '<div class="cart-items-grid">';

        items.forEach(item => {
            // Пропускаем товары без продукта (удаленные/деактивированные)
            if (!item.product) {
                console.warn('⚠️ Cart item without product:', item.id);
                return;
            }

            const product = item.product;
            const itemTotal = (product.price || 0) * (item.quantity || 1);
            total += itemTotal;

            html += `
                <div class="cart-item-tile">
                    <div class="cart-item-image-wrapper">
                        ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${escapeHtml(product.title || 'Товар')}" class="cart-item-image">` : '<div class="cart-item-image-placeholder">📦</div>'}
                        <button class="btn-cart-remove" onclick="removeFromCart('${item.id}')">✕</button>
                    </div>
                    <div class="cart-item-info">
                        <h4>${escapeHtml(product.title || 'Без названия')}</h4>
                        <p class="cart-item-price">${pzToRub(product.price || 0)} ₽</p>
                        <div class="cart-item-quantity-controls">
                            <button class="btn-quantity" onclick="updateCartQuantity('${item.id}', ${(item.quantity || 1) - 1})" ${(item.quantity || 1) <= 1 ? 'disabled' : ''}>−</button>
                            <span class="cart-item-quantity">${item.quantity || 1}</span>
                            <button class="btn-quantity" onclick="updateCartQuantity('${item.id}', ${(item.quantity || 1) + 1})">+</button>
                        </div>
                        <p class="cart-item-total">${pzToRub(itemTotal)} ₽</p>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        html += `
            <div class="cart-summary">
                <div class="cart-total">
                    <div class="cart-total-row">
                        <span>Итого:</span>
                        <strong>${pzToRub(total)} ₽</strong>
                    </div>
                </div>

                ${(!(userBalance > 0 || false) && total < 120) ? `
                <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid #ff6b6b; border-radius: 12px; padding: 12px; margin: 12px 0; font-size: 13px; line-height: 1.4;">
                    Чтобы активировать систему лояльности и получать скидку 10% на свои покупки и партнёрку 15% от покупок ваших друзей, вам нужно добрать <b>${pzToRub(120 - total)} ₽</b>
                </div>
                ` : ''}
                <button class="btn btn-primary checkout-btn" onclick="checkoutCart()" style="width: 100%; margin-top: 16px;">
                    Оформить заказ (${pzToRub(total)} ₽)
                </button>
            </div>
        `;

        return html;
    } catch (error) {
        console.error('❌ Error loading cart:', error);
        return `
            <div class="content-section">
                <div class="error-message">
                    <h3>Ошибка загрузки корзины</h3>
                    <p>Попробуйте обновить страницу или вернуться позже</p>
                    <button class="btn" onclick="closeSection(); loadProductsOnMainPage();" style="margin-top: 16px;">
                        Перейти к каталогу
                    </button>
                </div>
            </div>
        `;
    }
}

async function updateCartQuantity(cartItemId, newQuantity) {
    if (newQuantity < 1) {
        // Если количество 0 или меньше, удаляем товар
        await removeFromCart(cartItemId);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cart/update/${cartItemId}`, {
            method: 'PUT',
            headers: getApiHeaders(),
            body: JSON.stringify({ quantity: newQuantity })
        });

        if (response.ok) {
            await loadCartItems();
            updateCartBadge();
            // Reload cart content
            const container = document.getElementById('section-body');
            if (container) {
                container.innerHTML = await loadCartContent();
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            showError(errorData.error || 'Ошибка обновления количества');
        }
    } catch (error) {
        console.error('Error updating cart quantity:', error);
        showError('Ошибка обновления количества');
    }
}

async function removeFromCart(cartItemId) {
    try {
        const response = await fetch(`${API_BASE}/cart/remove/${cartItemId}`, {
            method: 'DELETE',
            headers: getApiHeaders()
        });

        if (response.ok) {
            await loadCartItems();
            updateCartBadge();
            // Reload cart content
            const container = document.getElementById('section-body');
            if (container) {
                container.innerHTML = await loadCartContent();
            }
            showSuccess('Товар удален из корзины');
        } else {
            showError('Ошибка удаления товара');
        }
    } catch (error) {
        console.error('Error removing from cart:', error);
        showError('Ошибка удаления товара');
    }
}

async function checkoutCart() {
    try {
        const response = await fetch(`${API_BASE}/cart/items`, { headers: getApiHeaders() });
        if (!response.ok) throw new Error('Failed to fetch cart items');

        const items = await response.json();
        if (!items || items.length === 0) {
            showError('Корзина пуста');
            return;
        }

        // Фильтруем только валидные товары (с продуктом и ценой)
        const validItems = items.filter(item => item.product && item.product.price);

        if (validItems.length === 0) {
            showError('В корзине нет доступных товаров');
            return;
        }

        // Вычисляем общую сумму в ₽ (цена хранится в PZ; 1 PZ = 100 ₽)
        const totalRub = validItems.reduce((sum, item) => {
            return sum + (Number(item.product.price || 0) * 100) * (item.quantity || 1);
        }, 0);

        // Загружаем баланс пользователя
        const userResponse = await fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() });
        let userBalance = 0;
        if (userResponse.ok) {
            const userData = await userResponse.json();
            userBalance = userData.balance || 0;
        }

        // Показываем форму оформления (в интерфейсе суммы показываем в ₽)
        showDeliveryForm(validItems, totalRub, userBalance);

    } catch (error) {
        console.error('❌ Error checkout:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        showError(`Ошибка оформления заказа: ${error.message || 'Неизвестная ошибка'}`);
    }
}

// Обработка заказа с оплатой с баланса
async function processOrderWithBalance(items, total, partialAmount = null, phone = null, address = null, certificateCode = null) {
    try {
        const orderItems = items.map(item => ({
            productId: item.product.id,
            title: item.product.title,
            price: item.product.price,
            quantity: item.quantity
        }));

        const amountToPay = partialAmount || total;
        const message = partialAmount
            ? `Заказ из корзины. Оплачено с баланса: ${pzToRub(amountToPay)} ₽ из ${pzToRub(total)} ₽`
            : `Заказ из корзины. Оплачено с баланса: ${pzToRub(total)} ₽`;

        const orderResponse = await fetch(`${API_BASE}/orders/create`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
                items: orderItems,
                message: message,
                paidFromBalance: amountToPay,
                phone: phone,
                deliveryAddress: address,
                certificateCode: certificateCode || undefined
            })
        });

        if (orderResponse.ok) {
            const orderData = await orderResponse.json().catch(() => ({}));
            const payablePz = Number(orderData?.payablePz);
            const certAppliedPz = Number(orderData?.certificateAppliedPz || 0) || 0;
            // NOTE: If paying partially, we use explicit partialAmount (calculated on client)
            // If paying fully, we use payablePz from backend (total - certs)

            showSuccess(`Заказ оформлен!`);

            closeSection();
            await loadCartItems();
            updateCartBadge();
        } else {
            const errorData = await orderResponse.json();
            showError(`Ошибка оформления заказа: ${errorData.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error('Error processing order with balance:', error);
        showError('Ошибка оформления заказа');
    }
}

// Обычное оформление заказа
async function processOrderNormal(items, phone = null, address = null, certificateCode = null) {
    try {
        const orderItems = items.map(item => ({
            productId: item.product.id,
            title: item.product.title,
            price: item.product.price,
            quantity: item.quantity
        }));

        const message = 'Заказ из корзины';

        const orderResponse = await fetch(`${API_BASE}/orders/create`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
                items: orderItems,
                message: message,
                phone: phone,
                deliveryAddress: address,
                certificateCode: certificateCode || undefined
            })
        });

        if (orderResponse.ok) {
            showSuccess('Заказ оформлен! Администратор свяжется с вами.');
            closeSection();
            await loadCartItems();
            updateCartBadge();
        } else {
            const errorData = await orderResponse.json();
            showError(`Ошибка оформления заказа: ${errorData.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error('Error processing order:', error);
        showError('Ошибка оформления заказа');
    }
}

function showHome() {
    closeSection();
    // Update bottom nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('.nav-item').classList.add('active');
}

function showFavorites() {
    // Update bottom nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item')[3].classList.add('active');

    // Show favorites section
    openSection('favorites');
}

function openSection(sectionName) {
    // Clear any existing intervals
    if (supportChatInterval) {
        clearInterval(supportChatInterval);
        supportChatInterval = null;
    }

    currentSection = sectionName;
    const overlay = document.getElementById('section-overlay');
    const title = document.getElementById('section-title');
    const body = document.getElementById('section-body');

    // Set section title
    const titles = {
        shop: 'Каталог',
        partner: 'Партнёрка',
        audio: 'Звуковые матрицы',
        reviews: 'Отзывы',
        about: 'О нас',
        // оставляем для обратной совместимости (если где-то ещё остались ссылки на 'chats')
        chats: 'Поддержка',
        support: 'Поддержка',
        favorites: 'Избранное',
        cart: 'Корзина',
        certificates: 'Сертификаты',
        promotions: 'Акции',
        contacts: 'Контакты',
        balance: 'Баланс',
        specialists: 'Специалисты',
        'specialist-detail': 'Специалист',
        'plazma-product-detail': 'Товар'
    };

    title.textContent = titles[sectionName] || 'Раздел';

    // Главные разделы (из нижнего меню): нижнее меню всегда видно.
    // Исключение: "Партнеры" — стрелка назад нужна (как на внутренних страницах).
    try {
        const mainSections = new Set(['about', 'reviews', 'support', 'favorites', 'partner', 'chats']);
        const isMain = mainSections.has(String(sectionName));
        const showBackInHeader = String(sectionName) === 'partner';
        if (overlay && overlay.classList) {
            overlay.classList.toggle('no-back', isMain && !showBackInHeader);
            overlay.classList.toggle('main-section', isMain);
        }
        if (document && document.body && document.body.classList) {
            document.body.classList.toggle('main-section-open', isMain);
        }
    } catch (e) {
        console.warn('Failed to toggle no-back:', e);
    }

    // Load section content
    loadSectionContent(sectionName, body);

    // Show overlay
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('open');
    }, 10);
}

function closeSection() {
    if (supportChatInterval) {
        clearInterval(supportChatInterval);
        supportChatInterval = null;
    }

    const overlay = document.getElementById('section-overlay');
    overlay.classList.remove('open');
    try {
        if (overlay && overlay.classList) {
            overlay.classList.remove('main-section');
            overlay.classList.remove('no-back');
        }
        if (document && document.body && document.body.classList) {
            document.body.classList.remove('main-section-open');
        }
    } catch (_) { }
    setTimeout(() => {
        overlay.classList.add('hidden');
        currentSection = null;
    }, 300);
}

// Load section content
async function loadSectionContent(sectionName, container) {
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

    try {
        let content = '';

        switch (sectionName) {
            case 'shop':
                content = await loadShopContent();
                break;
            case 'partner':
                content = await loadPartnerContent();
                break;
            case 'reviews':
                content = await loadReviewsContent();
                break;
            case 'about':
                content = await loadAboutContent();
                break;
            case 'chats':
                // Раньше был список чатов, но сейчас нужен прямой переход в чат поддержки.
                content = await loadSupportContent();
                break;
            case 'support':
                content = await loadSupportContent();
                break;
            case 'favorites':
                content = await loadFavoritesContent();
                break;
            case 'certificates':
                content = await loadCertificatesContent();
                break;
            case 'promotions':
                content = await loadPromotionsContent();
                break;
            case 'contacts':
                content = loadContactsContent();
                break;
            case 'cart':
                content = await loadCartContent();
                break;
            case 'balance':
                content = await loadBalanceContent();
                break;
            case 'partners':
                await showPartners();
                return; // showPartners already sets innerHTML
            default:
                content = '<div class="error-message"><h3>Раздел не найден</h3><p>Попробуйте позже</p></div>';
        }

        container.innerHTML = content;

        // Post-render hooks
        if (sectionName === 'support' || sectionName === 'chats') {
            initSupportChat();
        }
    } catch (error) {
        console.error('Error loading section:', error);
        container.innerHTML = '<div class="error-message"><h3>Ошибка загрузки</h3><p>Попробуйте позже</p></div>';
    }
}



// Load products on main page immediately
function isSubcategoryName(name) {
    return String(name || '').includes(' > ');
}

function getTopLevelCategories(categories) {
    return (categories || []).filter(c => c && c.id && c.name && !isSubcategoryName(c.name));
}

function findCoverImageForCategory(category, products, categories) {
    const explicit = String(category?.imageUrl || '').trim();
    if (explicit) return explicit;
    const name = String(category?.name || '');
    // Special case: cosmetics includes subcategories
    if (name === 'Косметика') {
        const p = (products || []).find(x => x?.imageUrl && (x?.category?.name === 'Косметика' || String(x?.category?.name || '').startsWith('Косметика >')));
        return p?.imageUrl || '';
    }
    // Regular: first product in this category with image
    const p = (products || []).find(x => x?.imageUrl && String(x?.category?.id || '') === String(category?.id || ''));
    return p?.imageUrl || '';
}

function renderCategoryCovers(categories, products) {
    const top = getTopLevelCategories(categories);
    if (!top.length) return '';

    let html = `
    <div class="category-covers">
        <div class="category-covers-header">Категории</div>
        <div class="category-covers-scroll">
    `;
    top.forEach(cat => {
        const cover = findCoverImageForCategory(cat, products, categories);
        const bg = cover ? `style="background-image:url('${escapeAttr(cover)}')"` : '';
        html += `
          <div class="category-cover-card" ${bg} onclick="openShopCategory('${escapeAttr(cat.id)}')">
            <div class="category-cover-overlay"></div>
            <div class="category-cover-title">${escapeHtml(cat.name)}</div>
          </div>
        `;
    });
    html += `</div></div > `;
    return html;
}

function setShopActiveCategory(categoryId) {
    SHOP_ACTIVE_CATEGORY_ID = categoryId || 'all';
}

async function ensureShopDataLoaded() {
    if (SHOP_CATEGORIES_CACHE && SHOP_PRODUCTS_CACHE) return;
    try {
        const [categoriesResponse, productsResponse] = await Promise.all([
            fetch(`${API_BASE}/categories`),
            fetch(`${API_BASE}/products`)
        ]);
        if (!categoriesResponse.ok) throw new Error('Failed to fetch categories');
        if (!productsResponse.ok) throw new Error('Failed to fetch products');
        let categories = await categoriesResponse.json();
        const products = await productsResponse.json();
        SHOP_CATEGORIES_CACHE = Array.isArray(categories) ? categories : [];
        SHOP_PRODUCTS_CACHE = Array.isArray(products) ? products : [];
    } catch (e) {
        throw e;
    }
}

function getProductsForShopSelection(categoryId, categories, products) {
    const sel = String(categoryId || 'all');
    if (sel === 'all') return products || [];
    const cat = (categories || []).find(c => String(c?.id || '') === sel);
    if (!cat) return [];
    if (String(cat.name || '') === 'Косметика') {
        const cosmeticIds = new Set(
            (categories || [])
                .filter(c => c.name === 'Косметика' || String(c.name || '').startsWith('Косметика >'))
                .map(c => String(c.id))
        );
        return (products || []).filter(p => p && p.category && cosmeticIds.has(String(p.category.id)));
    }
    return (products || []).filter(p => String(p?.category?.id || '') === sel);
}

function renderShopTabs(categories, activeId) {
    const top = getTopLevelCategories(categories);
    const active = String(activeId || 'all');
    let html = `<div class="category-tabs" role="tablist" aria-label="Категории">`;
    html += `<button class="category-tab ${active === 'all' ? 'active' : ''}" type="button" onclick="openShopCategory('all')">Все товары</button>`;
    top.forEach(cat => {
        html += `<button class="category-tab ${active === String(cat.id) ? 'active' : ''}" type="button" onclick="openShopCategory('${escapeAttr(cat.id)}')">${escapeHtml(cat.name)}</button>`;
    });
    html += `<button class="category-tab ${active === 'certificates' ? 'active' : ''}" type="button" onclick="openSection('certificates')">Сертификаты</button>`;
    html += `</div>`;
    return html;
}

async function openShopCategory(categoryId) {
    setShopActiveCategory(categoryId);
    if (currentSection !== 'shop') {
        openSection('shop');
        return;
    }
    // Rerender in-place
    const container = document.getElementById('section-body');
    if (container) {
        container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        container.innerHTML = await loadShopContent();
    }
}

async function ensureCertificateTypesLoaded() {
    if (CERT_TYPES_CACHE) return;
    try {
        const res = await fetch(`${API_BASE}/certificates/types`, { headers: getApiHeaders() });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.success && Array.isArray(data.types)) {
            CERT_TYPES_CACHE = data.types;
            return;
        }
        throw new Error(data?.error || 'Failed to load certificates');
    } catch (e) {
        CERT_TYPES_CACHE = [];
    }
}

function renderCertificateCard(t) {
    const priceRub = Number(t?.priceRub || 0) || 0;
    const title = escapeHtml(String(t?.title || 'Сертификат'));
    const cover = String(t?.imageUrl || '').trim();
    const img = cover
        ? `<div class="product-card-image"><img src="${escapeAttr(cover)}" alt="${title}" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');"></div>`
        : `<div class="product-card-image no-image"><div class="product-image-placeholder-icon">🎁</div></div>`;
    return `
      <div class="product-card-forma" onclick="showCertificateDetails('${escapeAttr(t.id)}')" style="position: relative;">
        ${img}
        <div class="product-card-content">
          <h3 class="product-card-title">${title}</h3>
          <div class="product-card-footer">
            <div class="product-card-price">
              <span class="price-value">${priceRub.toFixed(0)} ₽</span>
            </div>
            <button class="product-card-add" type="button" aria-label="Открыть сертификат" onclick="event.stopPropagation(); showCertificateDetails('${escapeAttr(t.id)}')">+</button>
          </div>
        </div>
      </div>
    `;
}

async function showCertificateDetails(typeId) {
    await ensureCertificateTypesLoaded();
    const list = Array.isArray(CERT_TYPES_CACHE) ? CERT_TYPES_CACHE : [];
    const t = list.find(x => String(x?.id || '') === String(typeId || '')) || null;
    if (!t) {
        showError('Сертификат не найден');
        return;
    }
    openSection('certificates');
    document.getElementById('section-title').textContent = 'Сертификат';

    const priceRub = Number(t.priceRub || 0) || 0;
    const valueRub = Number(t.valueRub || 0) || 0;
    const cover = String(t.imageUrl || '').trim();
    const title = escapeHtml(String(t.title || 'Подарочный сертификат'));
    const desc = t.description ? `<div class="content-section" style="margin-top:12px;"><p>${escapeHtml(String(t.description))}</p></div>` : '';

    // reuse qty control state from product detail
    resetProductDetailQty(String(t.id));

    const content = `
      <div class="content-section">
        ${cover ? `<div class="product-details-image"><img src="${escapeAttr(cover)}" alt="${title}" style="width:100%; border-radius: 14px;" onerror="this.style.display='none'"></div>` : ''}
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-top: 12px;">
          <h3 style="margin:0;">${title}</h3>
        </div>
        <div style="margin-top:10px; display:flex; justify-content:space-between; gap:12px; align-items:center;">
          <div style="font-size:16px; font-weight:800;">${priceRub.toFixed(0)} ₽</div>
          <div style="font-size:13px; color:#6b7280;">Номинал: ${valueRub.toFixed(0)} ₽</div>
        </div>

        <div style="margin-top:12px;">
          <div class="qty-control" aria-label="Количество">
            <button class="qty-btn" type="button" aria-label="Уменьшить" onclick="changeProductDetailQty(-1)">−</button>
            <div class="qty-value" id="product-detail-qty">1</div>
            <button class="qty-btn" type="button" aria-label="Увеличить" onclick="changeProductDetailQty(1)">+</button>
          </div>
        </div>

        <button class="btn" style="margin-top:12px; width:100%;" onclick="buyCertificateType('${escapeAttr(t.id)}', getProductDetailQty())">
          Купить сертификат
        </button>
        <div style="margin-top:10px; font-size:12px; color:#6b7280; line-height:1.35;">
          Покупка списывается с баланса. После покупки вы получите код сертификата и сможете применить его при оформлении заказа.
        </div>
      </div>
      ${desc}
    `;

    showProductsSection(content);
}

async function buyCertificateType(typeId, quantity) {
    const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
    try {
        const res = await fetch(`${API_BASE}/certificates/buy`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ typeId, quantity: qty })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            showError(data?.error || 'Ошибка покупки сертификата');
            return;
        }
        const codes = Array.isArray(data?.certificates) ? data.certificates.map(c => c.code).filter(Boolean) : [];
        const msg = codes.length
            ? `Сертификат куплен!\n\nКоды:\n${codes.join('\n')}\n\nСкопируй код и применяй при оформлении заказа.`
            : 'Сертификат куплен!';
        showSuccess(msg);
    } catch (e) {
        console.error('buyCertificateType error:', e);
        showError('Ошибка покупки сертификата');
    }
}

async function loadCertificatesContent() {
    // ── Только подарочный сертификат (без вкладок типов) ──
    let html = `<div class="shop-catalog">`;
    html += await buildGiftCertSection();
    html += `</div>`;
    return html;
}

// Globals for gift certificate form state (set by buildGiftCertSection)
let _giftIsPartner = false;
let _giftBalanceRub = 0;

async function buildGiftCertSection() {
    // Fetch user profile for balance + partner status
    let balanceRub = 0;
    let isPartner = false;
    try {
        const r = await fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() });
        if (r.ok) {
            const d = await r.json();
            balanceRub = Math.round(Number(d?.balance || 0));
            isPartner = !!(d?.partner?.isActive);
        }
    } catch { }

    // Store in globals so updateGiftCertTotal() can read them
    _giftIsPartner = isPartner;
    _giftBalanceRub = balanceRub;

    const partnerNote = isPartner
        ? `<div style="background:linear-gradient(135deg,#1a1a2e,#16213e); color:#fff; padding:10px 14px; border-radius:12px; font-size:13px; margin-bottom:14px;">
            🤝 <b>Партнёрская привилегия:</b> сертификат обойдётся вам на 10% дешевле.<br>
            Пример: дарите 10 000 ₽ — платите <b>9 000 ₽</b>
           </div>`
        : '';

    // My certificates
    let myCertsHtml = '';

    let activationHtml = `
        <div style="background:#f9fafb; border-radius:16px; padding:16px; margin-bottom: 20px;">
            <div style="font-weight:800; font-size:16px; margin-bottom:8px;">✨ Получили подарок?</div>
            <div style="font-size:13px; color:#6b7280; margin-bottom:12px;">Вставьте код из ссылки, чтобы зачислить подарочный сертификат себе.</div>
            <input id="manual-gift-token" type="text" placeholder="Например: a1b2c3d4e5f6g7h8..."
                style="width:100%; padding:12px 14px; border-radius:12px; border:1.5px solid #e5e7eb;
                    font-size:15px; font-family:inherit; box-sizing:border-box; outline:none; margin-bottom:12px;"
                onfocus="this.style.borderColor='#1a1a2e'" onblur="this.style.borderColor='#e5e7eb'">
            <button onclick="manualActivateGiftToken()" style="
                width:100%; padding:14px; border-radius:14px; border:none;
                background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color:#fff; font-size:15px; font-weight:700; cursor:pointer;">
                Активировать
            </button>
        </div>
    `;
    try {
        const mc = await fetch(`${API_BASE}/certificates/my`, { headers: getApiHeaders() });
        if (mc.ok) {
            const md = await mc.json();
            const certs = Array.isArray(md?.certificates) ? md.certificates : [];
            if (certs.length > 0) {
                myCertsHtml = `<div style="margin-bottom:20px;">
                    <div style="font-weight:700; font-size:15px; margin-bottom:10px;">🎀 Мои сертификаты</div>`;
                certs.forEach(c => {
                    const amountRub = Math.round(Number(c.amountRub || 0) || Number(c.initialPz || 0) * 100);
                    const bgUrl = c.imageUrl || 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1772107030/plazma/certificates/fgpp96vijifxbjzisln8.png';
                    myCertsHtml += `
                    <div style="
                        background: url('${bgUrl}') center/cover no-repeat;
                        border-radius:20px; padding:24px 20px; margin-bottom:14px;
                        box-shadow:0 6px 20px rgba(26,26,46,0.35);
                        display:flex; align-items:flex-end; justify-content:space-between;
                        min-height:200px; position:relative; overflow:hidden;
                    ">
                        <div style="background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 12px; backdrop-filter: blur(4px);">
                            <div style="font-weight:800; font-size:24px; color:#fff; letter-spacing:-0.5px; text-shadow:0 1px 2px rgba(0,0,0,0.5);">${amountRub.toLocaleString('ru-RU')} ₽</div>
                            <div style="font-size:11px; color:rgba(255,255,255,0.85); margin-top:2px;">
                                Код: <b>${escapeHtml(c.code)}</b>
                                <span onclick="event.stopPropagation(); copyShareText('${escapeHtml(c.code)}')" style="margin-left:6px; cursor:pointer; color:#60a5fa; text-decoration:underline;">Копировать</span>
                            </div>
                        </div>
                        <button onclick="openGiftModal('${escapeAttr(c.id)}', ${amountRub})" style="
                            padding:10px 18px; border-radius:14px; border:1px solid rgba(255,255,255,0.5);
                            background:rgba(26,26,46,0.5); backdrop-filter:blur(4px);
                            color:#fff; font-size:13px; font-weight:700; cursor:pointer;
                            white-space:nowrap; flex-shrink:0; margin-left:12px; box-shadow:0 2px 8px rgba(0,0,0,0.2);
                        ">Подарить</button>
                    </div>`;
                });
                myCertsHtml += `</div>`;
            }
        }
    } catch { }

    let templates = [];
    try {
        const tr = await fetch(`${API_BASE}/certificate-templates`, { headers: getApiHeaders() });
        if (tr.ok) {
            const td = await tr.json();
            templates = td.templates || [];
        }
    } catch { }

    if (templates.length === 0) {
        templates = [
            { imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1772107030/plazma/certificates/fgpp96vijifxbjzisln8.png' },
            { imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1772440894/plazma/certificates/hfazabilttijyunxsutg.jpg' },
            { imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1772267061/plazma/certificates/uoq0s1b1xxcyurp7jx2y.jpg' }
        ];
    }
    const defaultDesignUrl = templates[0].imageUrl;

    return `
    <div style="margin-top:8px;">
        ${activationHtml}
        ${myCertsHtml}
        <div style="font-weight:800; font-size:17px; margin-bottom:14px; margin-top:${myCertsHtml ? '8px' : '0'};">🎁 Подарочный сертификат</div>
        ${partnerNote}
        
        <div style="margin-bottom: 12px; font-size:14px; color:#374151; font-weight:600;">Выберите дизайн:</div>
        <div id="gift-cert-designs" style="display:flex; overflow-x:auto; gap:12px; margin-bottom:16px; padding-bottom:8px; -webkit-overflow-scrolling:touch;">
            <div onclick="uploadCustomGiftDesign()" id="gift-cert-upload-btn"
                 style="min-width:140px; height:90px; border-radius:12px; border:2px dashed #9ca3af; cursor:pointer;
                 display:flex; align-items:center; justify-content:center; flex-direction:column;
                 background: #f9fafb; color: #6b7280; transition: border 0.2s;">
                <div style="font-size: 24px;">+</div>
                <div style="font-size: 11px; font-weight:600; text-align:center; padding: 0 4px;">Свое фото</div>
            </div>
            ${templates.map((t, idx) => `
            <div onclick="selectGiftDesign(this, '${t.imageUrl.replace(/'/g, "\\'")}')" 
                 style="min-width:140px; height:90px; border-radius:12px; border:2px solid ${idx === 0 ? '#1a1a2e' : 'transparent'}; cursor:pointer;
                 background: url('${t.imageUrl.replace(/'/g, "\\'")}') center/cover no-repeat;">
            </div>
            `).join('')}
        </div>
        <input type="hidden" id="gift-cert-image" value="${defaultDesignUrl.replace(/"/g, '&quot;')}">

        <div id="gift-cert-preview" style="
            background: url('${defaultDesignUrl.replace(/'/g, "\\'")}') center/cover no-repeat;
            border-radius:20px; 
            margin-bottom:16px;
            box-shadow:0 6px 20px rgba(26,26,46,0.35);
            min-height:200px; 
            width:100%;
            transition: background 0.3s ease;
        "></div>

        <div style="background:#f9fafb; border-radius:16px; padding:16px;">
            <div style="font-size:13px; color:#6b7280; margin-bottom:10px;">Введите сумму сертификата (₽)</div>
            <input id="gift-cert-amount" type="number" min="5000" step="500" placeholder="Минимум 5 000 ₽"
                style="width:100%; padding:12px 14px; border-radius:12px; border:1.5px solid #e5e7eb;
                    font-size:15px; font-family:inherit; box-sizing:border-box; outline:none;"
                oninput="updateGiftCertTotal()"
                onfocus="this.style.borderColor='#1a1a2e'" onblur="this.style.borderColor='#e5e7eb'">


            <div id="gift-cert-total" style="margin-top:12px; font-size:14px; color:#374151; min-height:20px;"></div>
            <div style="margin-top:12px; display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="gift-cert-use-balance" onchange="updateGiftCertTotal()"
                    style="width:18px; height:18px; cursor:pointer;">
                <label for="gift-cert-use-balance" style="font-size:13px; color:#374151; cursor:pointer;">
                    Списать с баланса (${balanceRub.toLocaleString('ru-RU')} ₽)
                </label>
            </div>

            <button id="buy-gift-cert-btn" onclick="buyGiftCertificate(${isPartner ? 'true' : 'false'}, ${balanceRub})" style="
                margin-top:14px; width:100%; padding:14px; border-radius:14px; border:none;
                background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color:#fff; font-size:15px; font-weight:700; cursor:pointer;
                box-shadow:0 4px 12px rgba(26,26,46,0.3);
            ">Купить сертификат</button>
        </div>
    </div>

    <!-- Gift Modal -->
    <div id="gift-modal" style="display:none; position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,0.5); align-items:flex-end; justify-content:center;">
        <div style="background:#fff; border-radius:24px 24px 0 0; padding:24px 20px 32px; width:100%; max-width:480px; animation:slideUp 0.25s ease;">
            <div style="font-weight:800; font-size:17px; margin-bottom:16px;">🎁 Подарить сертификат</div>
            <div style="font-size:13px; color:#6b7280; margin-bottom:6px;">Введите юзернейм получателя</div>
            <input id="gift-recipient-username" type="text" placeholder="@username"
                style="width:100%; padding:12px 14px; border-radius:12px; border:1.5px solid #e5e7eb;
                    font-size:15px; font-family:inherit; box-sizing:border-box; outline:none;"
                onfocus="this.style.borderColor='#1a1a2e'" onblur="this.style.borderColor='#e5e7eb'">
            <div style="display:flex; align-items:center; gap:8px; margin:14px 0 10px;">
                <div style="flex:1; height:1px; background:#e5e7eb;"></div>
                <div style="font-size:12px; color:#9ca3af;">или скопируйте ссылку</div>
                <div style="flex:1; height:1px; background:#e5e7eb;"></div>
            </div>
            <button onclick="generateGiftLink()" style="
                width:100%; padding:11px; border-radius:12px;
                border:1.5px solid #1a1a2e; background:transparent;
                color:#1a1a2e; font-size:14px; font-weight:700; cursor:pointer;">
                🔗 Получить ссылку для подарка
            </button>
            <div id="gift-link-result" style="margin-top:12px; display:none;">
                <div style="font-size:13px; color:#6b7280; margin-bottom:6px;" id="gift-link-label"></div>
                <div style="background:#f3f4f6; border-radius:10px; padding:10px; font-size:12px; word-break:break-all;" id="gift-link-text"></div>
                <button onclick="copyGiftLink()" style="margin-top:8px; width:100%; padding:10px; border-radius:10px; border:1.5px solid #1a1a2e; background:transparent; color:#1a1a2e; font-weight:700; cursor:pointer;">
                    📋 Скопировать ссылку
                </button>
            </div>
            <div style="display:flex; gap:10px; margin-top:14px;">
                <button onclick="sendGiftCertificate()" style="
                    flex:1; padding:13px; border-radius:13px; border:none;
                    background:linear-gradient(135deg,#1a1a2e,#16213e);
                    color:#fff; font-weight:700; cursor:pointer;">Отправить</button>
                <button onclick="closeGiftModal()" style="
                    flex:1; padding:13px; border-radius:13px; border:1.5px solid #e5e7eb;
                    background:transparent; color:#6b7280; font-weight:600; cursor:pointer;">Отмена</button>
            </div>
        </div>
    </div>`;
}

function updateGiftCertTotal() {
    const amountInput = document.getElementById('gift-cert-amount');
    const totalDiv = document.getElementById('gift-cert-total');
    const buyBtn = document.getElementById('buy-gift-cert-btn');
    const useBalance = document.getElementById('gift-cert-use-balance')?.checked;
    if (!amountInput || !totalDiv) return;

    const amount = Math.round(Number(amountInput.value) || 0);

    const isPartner = _giftIsPartner;
    const balanceRub = _giftBalanceRub;
    const costRub = isPartner ? Math.round(amount * 0.9) : amount;
    const fromBalance = useBalance ? Math.min(balanceRub, costRub) : 0;
    const toPay = costRub - fromBalance;

    if (amount < 5000) {
        totalDiv.textContent = '';
        if (buyBtn) {
            buyBtn.textContent = 'Купить сертификат';
            buyBtn.onclick = () => buyGiftCertificate(isPartner, balanceRub);
        }
        return;
    }

    let text = `Номинал сертификата: ${amount.toLocaleString('ru-RU')} ₽`;
    if (isPartner) text += ` → к оплате со скидкой: ${costRub.toLocaleString('ru-RU')} ₽`;
    if (fromBalance > 0) text += `<br>С баланса: ${fromBalance.toLocaleString('ru-RU')} ₽`;

    if (toPay > 0) {
        text += `<br><b>💳 Не хватает на балансе: ${toPay.toLocaleString('ru-RU')} ₽</b>`;
        if (buyBtn) {
            buyBtn.textContent = `Пополнить через менеджера (${toPay.toLocaleString('ru-RU')} ₽)`;
            buyBtn.onclick = () => requestTopupViaManager(toPay, amount);
        }
    } else {
        text += `<br><b>✅ Полностью покрывается балансом</b>`;
        if (buyBtn) {
            buyBtn.textContent = 'Оплатить сертификат';
            buyBtn.onclick = () => buyGiftCertificate(isPartner, balanceRub);
        }
    }

    totalDiv.innerHTML = text;
}

async function requestTopupViaManager(amountRub, faceValueRub) {
    if (!amountRub) return;
    const certImage = document.getElementById('gift-cert-image')?.value || '';
    try {
        const res = await fetch(`${API_BASE}/certificates/request-manager-topup`, {
            method: 'POST',
            headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ amountRub, faceValueRub: faceValueRub || amountRub, certificateImageUrl: certImage })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            showError(data?.error || 'Ошибка отправки запроса');
            return;
        }
        showSuccess('Запрос отправлен менеджеру! Вы также можете написать напрямую: @Aurelia_8888', 5000);

        // Открытие ссылки
        const textToSend = `Здравствуйте! Хочу пополнить баланс на сумму ${amountRub} ₽ для покупки сертификата.`;
        const link = `https://t.me/Aurelia_8888?text=${encodeURIComponent(textToSend)}`;
        if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(link);
        } else {
            window.open(link, '_blank');
        }
    } catch (e) {
        showError('Ошибка отправки запроса на пополнение');
    }
}

async function buyGiftCertificate(isPartner, balanceRub) {
    const input = document.getElementById('gift-cert-amount');
    const useBalance = document.getElementById('gift-cert-use-balance')?.checked;
    const imgInput = document.getElementById('gift-cert-image');
    const amount = Math.round(Number(input?.value) || 0);
    if (amount < 5000) { showError('Минимальная сумма — 5 000 ₽'); return; }

    const imageUrl = imgInput ? imgInput.value : 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1772107030/plazma/certificates/fgpp96vijifxbjzisln8.png';

    try {
        const res = await fetch(`${API_BASE}/certificates/buy-gift`, {
            method: 'POST',
            headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ amountRub: amount, useBalance, imageUrl })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) { showError(data?.error || 'Ошибка покупки'); return; }

        const paid = data.balancePaidRub || 0;
        const rest = data.remainingCostRub || 0;
        let msg = `✅ Сертификат на ${amount.toLocaleString('ru-RU')} ₽ создан!`;
        if (paid > 0) msg += `\nС баланса списано: ${paid.toLocaleString('ru-RU')} ₽`;
        if (rest > 0) msg += `\nОстаток для оплаты: ${rest.toLocaleString('ru-RU')} ₽ (свяжитесь с нами)`;

        showSuccess(msg);
        if (input) input.value = '';
        // Reload certificates section
        setTimeout(() => openSection('certificates'), 1500);
    } catch (e) {
        showError('Ошибка покупки сертификата');
    }
}

let _currentGiftCertId = null;

window.selectGiftDesign = function (element, url) {
    const container = document.getElementById('gift-cert-designs');
    if (container) {
        Array.from(container.children).forEach(child => {
            child.style.borderColor = child.id === 'gift-cert-upload-btn' ? '#9ca3af' : 'transparent';
        });
    }
    element.style.borderColor = '#1a1a2e';

    const preview = document.getElementById('gift-cert-preview');
    if (preview) {
        preview.style.background = `url('${url}') center/cover no-repeat`;
    }

    const imgInput = document.getElementById('gift-cert-image');
    if (imgInput) {
        imgInput.value = url;
    }
}

window.uploadCustomGiftDesign = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showError('Файл слишком большой (максимум 5 МБ)');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        const btn = document.getElementById('gift-cert-upload-btn');
        const oldContent = btn.innerHTML;
        btn.innerHTML = '<div class="loading-spinner" style="width:24px;height:24px;border-width:2px;border-color:#1a1a2e;border-top-color:transparent;"></div>';
        btn.style.pointerEvents = 'none';

        try {
            const headers = getApiHeaders();
            delete headers['Content-Type']; // Let browser set multipart/form-data boundary

            const res = await fetch(`${API_BASE}/certificates/upload-design`, {
                method: 'POST',
                headers,
                body: formData
            });
            const data = await res.json().catch(()=>({}));
            
            btn.innerHTML = oldContent;
            btn.style.pointerEvents = 'auto';

            if (!res.ok || !data.success) {
                showError(data.error || 'Ошибка загрузки фото');
                return;
            }

            // Create new card for uploaded image
            const container = document.getElementById('gift-cert-designs');
            const newCard = document.createElement('div');
            newCard.style.minWidth = '140px';
            newCard.style.height = '90px';
            newCard.style.borderRadius = '12px';
            newCard.style.border = '2px solid transparent';
            newCard.style.cursor = 'pointer';
            newCard.style.background = `url('${data.url}') center/cover no-repeat`;
            newCard.onclick = function() { selectGiftDesign(this, data.url); };
            
            container.insertBefore(newCard, btn.nextSibling);
            selectGiftDesign(newCard, data.url);
            showSuccess('Дизайн успешно загружен!');

        } catch (err) {
            btn.innerHTML = oldContent;
            btn.style.pointerEvents = 'auto';
            showError('Сетевая ошибка при загрузке фото');
        }
    };
    input.click();
};

function openGiftModal(certId, amountRub) {
    _currentGiftCertId = certId;
    const modal = document.getElementById('gift-modal');
    const inp = document.getElementById('gift-recipient-username');
    const linkDiv = document.getElementById('gift-link-result');
    if (inp) inp.value = '';
    if (linkDiv) linkDiv.style.display = 'none';
    if (modal) modal.style.display = 'flex';
}

function closeGiftModal() {
    const modal = document.getElementById('gift-modal');
    if (modal) modal.style.display = 'none';
    _currentGiftCertId = null;
}

async function generateGiftLink() {
    if (!_currentGiftCertId) return;
    try {
        const res = await fetch(`${API_BASE}/certificates/gift`, {
            method: 'POST',
            headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ certificateId: _currentGiftCertId, username: '' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) { showError(data?.error || 'Ошибка'); return; }
        _currentGiftLink = data.giftLink || '';
        const linkDiv = document.getElementById('gift-link-result');
        const linkLabel = document.getElementById('gift-link-label');
        const linkText = document.getElementById('gift-link-text');
        if (linkDiv) linkDiv.style.display = 'block';
        if (linkLabel) linkLabel.textContent = 'Ссылка для получателя:';
        if (linkText) linkText.textContent = _currentGiftLink;
    } catch (e) { showError('Ошибка генерации ссылки'); }
}

let _currentGiftLink = '';

async function sendGiftCertificate() {
    const username = document.getElementById('gift-recipient-username')?.value?.trim();
    if (!_currentGiftCertId) return;

    try {
        const res = await fetch(`${API_BASE}/certificates/gift`, {
            method: 'POST',
            headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ certificateId: _currentGiftCertId, username })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) { showError(data?.error || 'Ошибка'); return; }

        if (data.sent) {
            closeGiftModal();
            showSuccess(`🎁 Сертификат на ${Number(data.amountRub).toLocaleString('ru-RU')} ₽ подарен @${data.recipientUsername}!`);
            setTimeout(() => openSection('certificates'), 1800);
        } else {
            // Show gift link
            _currentGiftLink = data.giftLink || '';
            const linkDiv = document.getElementById('gift-link-result');
            const linkLabel = document.getElementById('gift-link-label');
            const linkText = document.getElementById('gift-link-text');
            if (linkDiv) linkDiv.style.display = 'block';
            if (linkLabel) linkLabel.textContent = data.userNotFound
                ? `Пользователь @${username} не найден. Поделитесь ссылкой:`
                : 'Ссылка для получателя:';
            if (linkText) linkText.textContent = _currentGiftLink;
        }
    } catch (e) {
        showError('Ошибка отправки подарка');
    }
}

function copyGiftLink() {
    if (!_currentGiftLink) return;
    navigator.clipboard?.writeText(_currentGiftLink).then(() => showSuccess('Ссылка скопирована!')).catch(() => {
        // fallback
        const el = document.createElement('textarea');
        el.value = _currentGiftLink;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showSuccess('Ссылка скопирована!');
    });
}

async function checkGiftActivation() {
    // Check Telegram WebApp startParam for gift token
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || '';
    if (!startParam.startsWith('gift_')) return;
    const token = startParam.slice(5);
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/certificates/activate/${encodeURIComponent(token)}`, {
            headers: getApiHeaders()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            if (res.status !== 401) showError(data?.error || 'Ошибка активации подарка');
            return;
        }
        const amountRub = Number(data.amountRub).toLocaleString('ru-RU');
        const sender = data.senderName || 'Пользователь';
        showSuccess(`🎁 ${sender} подарил вам ${amountRub} ₽!\n\nСумма добавлена на ваш баланс 🎉`);
        setTimeout(() => openSection('certificates'), 2000);
    } catch { }
}

async function manualActivateGiftToken() {
    const input = document.getElementById('manual-gift-token');
    const token = input ? input.value.trim() : '';
    let extracted = token;
    if (!extracted) {
        showError('Пожалуйста, введите код сертификата (часть ссылки после gift_)');
        return;
    }

    // allow pasting the full link or the raw gift_XXX 
    if (extracted.includes('startapp=gift_')) {
        extracted = extracted.split('startapp=gift_')[1].split('&')[0].trim();
    } else if (extracted.startsWith('gift_')) {
        extracted = extracted.slice(5).trim();
    }

    try {
        const res = await fetch(`${API_BASE}/certificates/activate/${encodeURIComponent(extracted)}`, {
            headers: getApiHeaders()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            showError(data?.error || 'Ошибка активации сертификата');
            return;
        }
        const amountRub = Number(data.amountRub).toLocaleString('ru-RU');
        const sender = data.senderName || 'Пользователь';
        showSuccess(`🎁 ${sender} подарил вам ${amountRub} ₽!\n\nСумма добавлена в Мои сертификаты 🎉`);

        if (input) input.value = '';
        setTimeout(() => openSection('certificates'), 2000);
    } catch {
        showError('Сетевая ошибка при активации');
    }
}

async function loadProductsOnMainPage() {
    const container = document.getElementById('products-container');
    if (!container) return; // Container might not exist in overlay mode

    const fetchWithTimeout = async (resource, options = {}) => {
        const { timeout = 15000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    };

    try {
        console.log('🛒 Loading products on main page...');
        const [productsRes, categoriesRes] = await Promise.all([
            fetchWithTimeout(`${API_BASE}/products`).catch(e => { throw new Error(`Products fetch failed: ${e.message}`) }),
            fetchWithTimeout(`${API_BASE}/categories`).catch(() => ({ ok: false }))
        ]);

        if (!productsRes.ok) {
            throw new Error(`HTTP error! status: ${productsRes.status}`);
        }

        const products = await productsRes.json();
        const allCategories = (categoriesRes && categoriesRes.ok) ? await categoriesRes.json().catch(() => []) : [];
        console.log(`✅ Loaded ${products?.length || 0} products`);

        if (products && Array.isArray(products) && products.length > 0) {
            let html = '';
            // 1) Categories with covers
            if (Array.isArray(allCategories) && allCategories.length) {
                html += renderCategoryCovers(allCategories, products);
            }
            // 2) All products grid
            html += `
              <div class="products-scroll-container">
                <div class="section-header-inline">
                  <h2 class="section-title-inline">Каталог</h2>
                </div>
                <div class="products-grid">
            `;
            products.forEach(p => { html += renderProductCard(p); });
            html += `
                </div>
              </div>
            `;
            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                    <p style="font-size: 18px; margin-bottom: 20px;">📦 Каталог пока пуст</p>
                </div>
            `;
        }

        // Загружаем товары из Plazma API
        await loadPlazmaProducts();

    } catch (error) {
        console.error('❌ Error loading products:', error);
        if (container) {
            const errorText = error.message || 'Неизвестная ошибка';
            container.innerHTML = `
                <div class="error-message" style="padding: 40px 20px; text-align: center;">
                    <p>Ошибка загрузки товаров</p>
                    <p style="font-size: 12px; color: #666; margin: 10px 0;">${escapeHtml(errorText)}</p>
                    <button class="btn" onclick="loadProductsOnMainPage()" style="margin-top: 20px;">
                        🔄 Попробовать снова
                    </button>
                </div>
            `;
        }
    }
}

// Загрузка товаров из Plazma API
async function loadPlazmaProducts() {
    const plazmaSection = document.getElementById('plazma-products-section');
    const plazmaContainer = document.getElementById('plazma-products-container');

    if (!plazmaSection || !plazmaContainer) {
        console.warn('⚠️ Plazma products section not found');
        return;
    }

    // Показываем секцию с индикатором загрузки
    plazmaSection.style.display = 'block';

    try {
        console.log('🛒 Loading products from Plazma API...');
        console.log('📍 API endpoint:', `${API_BASE}/plazma/products`);

        // Используем бэкенд endpoint для получения товаров из Plazma API
        let response;
        try {
            response = await fetch(`${API_BASE}/plazma/products`);
        } catch (netEx) {
            console.warn('⚠️ Network error loading Plazma products:', netEx);
            plazmaSection.style.display = 'none';
            return;
        }

        console.log('📡 Response status:', response.status, response.statusText);

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            console.warn('⚠️ Plazma API returned HTML instead of JSON. Likely 404 or auth error.');
            plazmaSection.style.display = 'none';
            return;
        }

        if (!response.ok) {
            let errorData = { error: 'Unknown error' };
            try {
                errorData = await response.json();
            } catch (e) { /* ignore json parse error on error response */ }

            console.warn('⚠️ Failed to load Plazma products:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData.error || errorData.message
            });

            // Если это 404 или 503 (сервис недоступен), просто скрываем секцию
            if (response.status === 404 || response.status === 503) {
                console.log('ℹ️ Plazma API не настроен или недоступен, скрываем секцию');
                plazmaSection.style.display = 'none';
                return;
            }

            // Для других ошибок показываем сообщение
            const horizontalContainer = plazmaContainer.querySelector('.products-horizontal');
            if (horizontalContainer) {
                horizontalContainer.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #999;">
                        <p>Товары временно недоступны</p>
                    </div>
                `;
            }
            return;
        }

        const result = await response.json();
        console.log('📦 Response from backend:', {
            success: result.success,
            hasProducts: !!result.products,
            productsLength: Array.isArray(result.products) ? result.products.length : 'not array',
            error: result.error
        });

        const products = result.products || result.data || [];

        console.log(`✅ Loaded ${products?.length || 0} products from Plazma API`);

        const horizontalContainer = plazmaContainer.querySelector('.products-horizontal');
        if (!horizontalContainer) {
            console.error('❌ Horizontal container not found in Plazma section');
            plazmaSection.style.display = 'none';
            return;
        }


        // Custom sort for Plazma products to match specific order
        function sortPlazmaProducts(a, b) {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();

            // 1. "Плазменный набор" - всегда первый
            if (titleA.includes('плазменный набор')) return -1;
            if (titleB.includes('плазменный набор')) return 1;

            // 2. Определенный порядок для плазмы
            const order = [
                'противовирусная',
                'медная',
                'углеродная',
                'цинковая',
                'магниевая',
                'железная',
                'автогармония'
            ];

            const indexA = order.findIndex(key => titleA.includes(key));
            const indexB = order.findIndex(key => titleB.includes(key));

            // Если оба товара в списке приоритетов
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }

            // Если только A в списке
            if (indexA !== -1) return -1;
            // Если только B в списке
            if (indexB !== -1) return 1;

            // 3. Артефакты (браслет, кристалл, кулон) - в конец
            const artifacts = ['браслет', 'кристалл', 'кулон'];
            const isArtifactA = artifacts.some(key => titleA.includes(key));
            const isArtifactB = artifacts.some(key => titleB.includes(key));

            if (isArtifactA && !isArtifactB) return 1; // A (артефакт) идет после B (обычного)
            if (!isArtifactA && isArtifactB) return -1; // B (артефакт) идет после A (обычного)

            // Остальные - по алфавиту или сохраняем порядок
            return 0;
        }

        if (products && Array.isArray(products) && products.length > 0) {
            // Сортировка
            products.sort(sortPlazmaProducts);

            let html = '';
            products.forEach((product, index) => {
                console.log(`📦 Product ${index + 1}:`, {
                    id: product.id,
                    title: product.title,
                    hasImage: !!product.imageUrl,
                    price: product.price || product.priceRub
                });
                html += renderPlazmaProductCard(product);
            });
            horizontalContainer.innerHTML = html;
            plazmaSection.style.display = 'block';
            console.log('✅ Plazma products section displayed with', products.length, 'products');
        } else {
            console.warn('⚠️ No products to display, hiding Plazma section');
            plazmaSection.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ Error loading Plazma products:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        // При ошибке сети или других ошибках скрываем секцию
        plazmaSection.style.display = 'none';
    }
}

// Render cosmetics category with mixed products from subcategories
function renderCosmeticsCategory(categoryId, allProducts, cosmeticsSubcategories) {
    try {
        // Группируем товары по подкатегориям
        const productsBySubcategory = {};
        cosmeticsSubcategories.forEach(subcat => {
            productsBySubcategory[subcat.id] = allProducts.filter(p => p.category?.id === subcat.id);
        });

        // Создаем микс: по одному товару из каждой подкатегории по очереди
        const mixedProducts = [];
        const subcategoryIds = Object.keys(productsBySubcategory).filter(id => productsBySubcategory[id].length > 0);

        if (subcategoryIds.length === 0) {
            // Если нет подкатегорий, берем первые товары из всех
            return `
                <div class="products-scroll-container">
                    <div class="section-header-inline">
                        <h2 class="section-title-inline" onclick="showCosmeticsSubcategories('${categoryId}')" style="cursor: pointer;">${escapeHtml('Косметика')} <span style="font-size: 18px; margin-left: 8px;">→</span></h2>
                    </div>
                    <div class="products-scroll-wrapper">
                        <div class="products-horizontal">
                            ${allProducts.slice(0, 10).map(p => renderProductCardHorizontal(p)).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Берем по одному товару из каждой подкатегории по очереди, максимум 9 товаров
        let maxProducts = 0;
        subcategoryIds.forEach(subcatId => {
            if (productsBySubcategory[subcatId].length > maxProducts) {
                maxProducts = productsBySubcategory[subcatId].length;
            }
        });

        // Берем товары по кругу из каждой подкатегории, но не более 9
        for (let round = 0; round < maxProducts && mixedProducts.length < 9; round++) {
            for (const subcatId of subcategoryIds) {
                if (mixedProducts.length >= 9) break;
                const subcatProducts = productsBySubcategory[subcatId];
                if (subcatProducts && subcatProducts.length > round) {
                    mixedProducts.push(subcatProducts[round]);
                }
            }
        }

        let html = `
            <div class="products-scroll-container">
                <div class="section-header-inline">
                    <h2 class="section-title-inline" onclick="showCosmeticsSubcategories('${categoryId}')" style="cursor: pointer;">${escapeHtml('Косметика')}</h2>
                </div>
                <div class="products-scroll-wrapper">
                    <div class="products-horizontal">
        `;

        mixedProducts.forEach(product => {
            html += renderProductCardHorizontal(product);
        });

        // Кнопка "Перейти на все категории"
        html += `
                        <div class="product-card-more" onclick="showCosmeticsSubcategories('${categoryId}')">
                            <div class="more-icon">📁</div>
                            <div class="more-text">Все категории</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return html;
    } catch (error) {
        console.error('Error rendering cosmetics category:', error);
        // Fallback: показываем все товары как обычно
        return `
            <div class="products-scroll-container">
                <div class="section-header-inline">
                    <h2 class="section-title-inline">${escapeHtml('Косметика')}</h2>
                </div>
                <div class="products-scroll-wrapper">
                    <div class="products-horizontal">
                        ${allProducts.slice(0, 9).map(p => renderProductCardHorizontal(p)).join('')}
                    </div>
                </div>
            </div>
        `;
    }
}

// Show cosmetics subcategories - отображаем товары из всех подкатегорий горизонтально
async function showCosmeticsSubcategories(parentCategoryId) {
    try {
        // Открываем секцию каталога
        openSection('shop');

        const container = document.getElementById('section-body');
        container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

        // Загружаем категории и товары
        const [categoriesResponse, productsResponse] = await Promise.all([
            fetch(`${API_BASE}/categories`),
            fetch(`${API_BASE}/products`)
        ]);

        if (!categoriesResponse.ok) throw new Error('Failed to fetch categories');
        if (!productsResponse.ok) throw new Error('Failed to fetch products');

        const allCategories = await categoriesResponse.json();
        const products = await productsResponse.json();

        // Находим подкатегории "Косметика"
        let cosmeticsSubcategories = allCategories.filter(cat =>
            cat.name && cat.name.startsWith('Косметика >') && cat.name !== 'Косметика'
        );
        cosmeticsSubcategories = dedupeCategoriesPreferMoreProducts(cosmeticsSubcategories, productsByCategory);

        // Группируем товары по категориям
        const productsByCategory = {};
        products.forEach(product => {
            const categoryId = product.category?.id || 'uncategorized';
            if (!productsByCategory[categoryId]) {
                productsByCategory[categoryId] = [];
            }
            productsByCategory[categoryId].push(product);
        });

        let html = '<div class="products-main-container">';

        // Отображаем каждую подкатегорию как горизонтальную линию
        cosmeticsSubcategories.forEach(subcat => {
            const subcatProducts = productsByCategory[subcat.id] || [];
            if (subcatProducts.length === 0) return;

            html += `
                <div class="products-scroll-container">
                    <div class="section-header-inline">
                        <h2 class="section-title-inline" onclick="showCategoryProducts('${subcat.id}')" style="cursor: pointer;">${escapeHtml(subcat.name)}</h2>
                    </div>
                    <div class="products-scroll-wrapper">
                        <div class="products-horizontal">
            `;

            subcatProducts.forEach(product => {
                html += renderProductCardHorizontal(product);
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });

        if (cosmeticsSubcategories.length === 0 || cosmeticsSubcategories.every(subcat => !productsByCategory[subcat.id] || productsByCategory[subcat.id].length === 0)) {
            html += `
                <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                <p style="font-size: 18px; margin-bottom: 20px;">📦 В подкатегориях пока нет товаров</p>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading cosmetics subcategories:', error);
        showError('Ошибка загрузки подкатегорий');
    }
}

// Helper: Clean product title
function cleanProductTitle(title) {
    if (!title) return '';
    // Take part before " - " or " | " (removed " with " to keep full names)
    // FIXED: Show full title to distinguish variants
    let clean = title; // title.split(/ - | \| /i)[0];

    // Remove trailing weight info like " 50g", " 50 G", " 50 г"
    clean = clean.replace(/\s+\d+\s*[gг]$/i, '');

    return escapeHtml(clean.trim());
}

// Helper: Extract product weight from text
function extractProductWeight(text) {
    if (!text) return { weight: null, cleanSummary: '' };

    // Look for patterns like "BEC: 50 г" or "50g" or "50 г"
    // The specific user pattern: "/ 55 BEC: 50 г /"

    // Regex to find "BEC: <value>"
    const weightMatch = text.match(/(?:BEC|ВЕС|Вес|Weight)[:\s]+(\d+\s*[гg])/i);
    let weight = weightMatch ? weightMatch[1] : null;

    // Also try to find just "50 g" if BEC line matches
    if (!weight) {
        const simpleMatch = text.match(/(\d+\s*[гg])/i);
        if (simpleMatch && (text.includes('BEC') || text.includes('ВЕС') || text.includes('Weight'))) {
            weight = simpleMatch[1];
        }
    }

    // Clean the text by removing the weight line/segment
    let cleanSummary = text;

    // 1. Remove specific "/ 55 BEC: 50 г /" pattern
    cleanSummary = cleanSummary.replace(/\/ \d+ (?:BEC|ВЕС|Вес|Weight):.*?(\/|$)/gi, '');

    // 2. Remove standalone "BEC: 50 g" or "ВЕС: 50 г"
    cleanSummary = cleanSummary.replace(/(?:BEC|ВЕС|Вес|Weight)[:\s]+\d+\s*[гg][\s\.,]*/gi, '');

    // 3. Remove "КРАТКОЕ ОПИСАНИЕ:" prefix
    cleanSummary = cleanSummary.replace(/^КРАТКОЕ ОПИСАНИЕ:\s*/i, '');

    // 5. Remove leading weight like "55 г" or "55g" at start of string
    cleanSummary = cleanSummary.replace(/^\s*\d+\s*[гg]\s+/i, '');

    // 4. Remove extra slashes or whitespace left over
    cleanSummary = cleanSummary.replace(/^\s*[\/\|]\s*/, '').trim();

    return { weight, cleanSummary };
}

// Render product card in horizontal scroll format
function renderProductCardHorizontal(product) {
    const imageHtml = product.imageUrl
        ? `<div class="product-card-image" onclick="event.stopPropagation(); showProductDetails('${product.id}')"><img src="${product.imageUrl}" alt="${escapeHtml(product.title || 'Товар')}" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');"></div>`
        : `<div class="product-card-image no-image" onclick="event.stopPropagation(); showProductDetails('${product.id}')"><div class="product-image-placeholder-icon">📦</div></div>`;
    const title = cleanProductTitle(product.title || 'Без названия');
    const { weight, cleanSummary } = extractProductWeight(product.summary || product.description || '');
    const summary = escapeHtml(cleanSummary.substring(0, 80));
    const priceRub = product.price ? (product.price * 100).toFixed(0) : '0';
    return `
        <div class="product-card-forma-horizontal" data-product-id="${escapeAttr(product.id)}" data-product-type="product" onclick="showProductDetails('${product.id}')" style="position: relative;">
            ${renderFavoriteButton(product.id)}
            ${imageHtml}
            <div class="product-card-content">
                <h3 class="product-card-title">${title}</h3>
                <div class="product-card-footer">
                    <div class="product-card-price">
                        <span class="price-value">${priceRub} ₽</span>
                    </div>
                    <button class="product-card-add" type="button" aria-label="Открыть товар" onclick="event.stopPropagation(); showProductDetails('${product.id}')">
                        +
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Render product card in FORMA Store style (for grid view)
function renderProductCard(product) {
    const imageHtml = product.imageUrl
        ? `<div class="product-card-image" onclick="event.stopPropagation(); showProductDetails('${product.id}')"><img src="${product.imageUrl}" alt="${escapeHtml(product.title || 'Товар')}" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');"></div>`
        : `<div class="product-card-image no-image" onclick="event.stopPropagation(); showProductDetails('${product.id}')"><div class="product-image-placeholder-icon">📦</div></div>`;
    const title = cleanProductTitle(product.title || 'Без названия');
    const { weight, cleanSummary } = extractProductWeight(product.summary || product.description || '');
    const summary = escapeHtml(cleanSummary.substring(0, 100));
    const priceRub = product.price ? (product.price * 100).toFixed(0) : '0';
    return `
        <div class="product-card-forma" data-product-id="${escapeAttr(product.id)}" data-product-type="product" onclick="showProductDetails('${product.id}')" style="position: relative;">
            ${renderFavoriteButton(product.id)}
            ${imageHtml}
            <div class="product-card-content">
                <h3 class="product-card-title">${title}</h3>
                <div class="product-card-footer">
                    <div class="product-card-price">
                        <span class="price-value">${priceRub} ₽</span>
                    </div>
                    <button class="product-card-add" type="button" aria-label="Открыть товар" onclick="event.stopPropagation(); showProductDetails('${product.id}')">
                        +
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Render Plazma API product card
function renderPlazmaProductCard(product) {
    const imageHtml = product.imageUrl
        ? `<div class="product-card-image" onclick="event.stopPropagation(); showPlazmaProductDetails('${product.id}')"><img src="${product.imageUrl}" alt="${escapeHtml(product.title || 'Товар')}" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');"></div>`
        : `<div class="product-card-image no-image" onclick="event.stopPropagation(); showPlazmaProductDetails('${product.id}')"><div class="product-image-placeholder-icon">📦</div></div>`;
    const title = cleanProductTitle(product.title || 'Без названия');
    const { weight, cleanSummary } = extractProductWeight(product.summary || product.description || '');
    const summary = escapeHtml(cleanSummary.substring(0, 80));
    const priceRub = product.priceRub || (product.price ? (product.price * 100).toFixed(0) : '0');
    return `
        <div class="product-card-forma-horizontal" data-product-id="${escapeAttr(product.id)}" data-product-type="plazma" onclick="showPlazmaProductDetails('${product.id}')">
            ${imageHtml}
            <div class="product-card-content">
                <h3 class="product-card-title">${title}</h3>
                <div class="product-card-footer">
                    <div class="product-card-price">
                        <span class="price-value">${priceRub} ₽</span>
                    </div>
                    <button class="product-card-add" type="button" aria-label="Открыть товар" onclick="event.stopPropagation(); showPlazmaProductDetails('${product.id}')">
                        +
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Show Plazma product details
async function showPlazmaProductDetails(productId) {
    try {
        const response = await fetch(`${API_BASE}/plazma/products/${productId}`);
        if (!response.ok) {
            showError('Товар не найден');
            return;
        }

        const result = await response.json();
        const product = result.product || result.data;

        if (!product) {
            showError('Товар не найден');
            return;
        }

        // Открываем детали товара в отдельном окне или показываем информацию
        showPlazmaProductModal(product);
    } catch (error) {
        console.error('Error loading Plazma product:', error);
        showError('Ошибка загрузки товара');
    }
}

// Show Plazma product modal
function showPlazmaProductModal(product) {
    const title = cleanProductTitle(product.title || 'Товар');
    const { weight, cleanSummary } = extractProductWeight(product.description || product.summary || '');
    // Sanitize instead of escape
    const descriptionHTML = window.DOMPurify
        ? DOMPurify.sanitize(cleanSummary || 'Описание отсутствует', { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span'], ALLOWED_ATTR: ['href', 'style', 'class'] })
        : escapeHtml(cleanSummary || 'Описание отсутствует');
    const priceRub = product.priceRub || (product.price ? (product.price * 100).toFixed(0) : '0');
    const imageUrl = product.imageUrl || '';

    openSection('plazma-product-detail');
    document.getElementById('section-title').textContent = title;
    document.getElementById('section-body').innerHTML = `
        <div class="content-section">
            ${imageUrl ? `<div class="product-image-full"><img src="${imageUrl}" alt="${title}" style="width: 100%; border-radius: 12px;"></div>` : ''}
            <div class="product-details-content">
                <div class="product-details-header">
                    <h2>${title}</h2>
                </div>
                <div class="product-header-row">
                    <div class="product-price">💰 ${priceRub} ₽</div>
                    ${weight ? `<div class="product-weight-badge-large">${weight}</div>` : ''}
                </div>
                <p>${descriptionHTML}</p>
                <button class="btn" onclick="addPlazmaProductToCart('${product.id}', '${escapeHtml(title)}', ${product.price || 0}); closeSection();" style="margin-top: 20px;">
                    🛒 Добавить в корзину
                </button>
            </div>
        </div>
    `;
}

// Add Plazma product to cart (creates a special order request)
async function addPlazmaProductToCart(productId, productTitle, price) {
    try {
        // Создаем заказ через Plazma API
        const response = await fetch(`${API_BASE}/plazma/orders`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
                productId: productId,
                productTitle: productTitle,
                price: price,
                quantity: 1
            })
        });

        if (response.ok) {
            showSuccess(`Товар "${productTitle}" добавлен в заказ! Администратор свяжется с вами.`);
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            showError(errorData.error || 'Ошибка добавления товара');
        }
    } catch (error) {
        console.error('Error adding Plazma product:', error);
        showError('Ошибка добавления товара');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Escape attribute values for safe interpolation into HTML attributes
function escapeAttr(text) {
    // escapeHtml covers &,<,>, but not quotes reliably for attribute context
    return escapeHtml(String(text ?? ''))
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Shop content - каталог с табами категорий + сетка товаров
async function loadShopContent() {
    try {
        console.log('🛒 Loading shop catalog...');
        await ensureShopDataLoaded();
        const categories = Array.isArray(SHOP_CATEGORIES_CACHE) ? SHOP_CATEGORIES_CACHE : [];
        const products = Array.isArray(SHOP_PRODUCTS_CACHE) ? SHOP_PRODUCTS_CACHE : [];

        const activeId = String(SHOP_ACTIVE_CATEGORY_ID || 'all');
        const filtered = getProductsForShopSelection(activeId, categories, products);

        let content = `<div class="shop-catalog">`;
        content += renderShopTabs(categories, activeId);
        content += `<div class="products-grid" style="margin-top: 12px;">`;

        if (filtered && filtered.length) {
            filtered.forEach(p => { content += renderProductCard(p); });
        } else {
            content += `<div class="empty-state"><p>Товары не найдены</p></div>`;
        }

        content += `</div></div>`;
        return content;
    } catch (error) {
        console.error('❌ Error loading shop content:', error);
        return `
            <div class="error-message">
                <h3>Ошибка загрузки каталога</h3>
                <p>${error?.message || 'Попробуйте позже'}</p>
                <button class="btn" onclick="openShopCategory('all')" style="margin-top: 20px;">
                    🔄 Попробовать снова
                </button>
            </div>
        `;
    }
}

// Import products function
async function importProducts() {
    try {
        console.log('🤖 Starting product import...');
        showSuccess('Запускаю импорт товаров...');

        const response = await fetch(`${API_BASE}/import-products`, {
            method: 'POST',
            headers: getApiHeaders()
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Импорт запущен! Обновите страницу через минуту.');
            setTimeout(() => {
                location.reload();
            }, 5000);
        } else {
            showError(result.message || 'Ошибка импорта');
        }
    } catch (error) {
        console.error('❌ Error importing products:', error);
        showError('Ошибка запуска импорта');
    }
}

// Partner content
// Partner content
async function loadPartnerContent() {
    return `
        <div class="content-section">
            <h3>Партнёрская программа</h3>
            <p>Станьте партнёром Plazma Water и получайте бонусы 15% по вашей ссылке!</p>
            
            <div class="partner-promo-info" style="background: #f9f9f9; border-radius: 12px; padding: 16px; margin: 20px 0;">
                <p style="margin-bottom: 12px;"><strong>Как стать партнером:</strong></p>
                <ul style="padding-left: 20px; color: #333;">
                    <li>Совершите покупку на сумму от 12 000 ₽</li>
                    <li>Получите реферальную ссылку автоматически</li>
                </ul>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="openShop()">
                    🛍 Перейти в каталог
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="showPartnerDashboard()">
                    📊 Личный кабинет
                </button>
            </div>
        </div>
    `;
}

// Audio content
async function loadAudioContent() {
    return `
        <div class="content-section">
            <h3>Звуковые матрицы Гаряева</h3>
            <p>Уникальные аудиофайлы для оздоровления, записанные методом Гаряева.</p>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="playAudio('matrix1')">
                    🎵 Матрица 1 - Восстановление
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="playAudio('matrix2')">
                    🎵 Матрица 2 - Энергия
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="playAudio('matrix3')">
                    🎵 Матрица 3 - Гармония
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="playAudio('matrix4')">
                    🎵 Матрица 4 - Исцеление
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="playAudio('matrix5')">
                    🎵 Матрица 5 - Трансформация
                </button>
            </div>
        </div>
    `;
}

// Reviews content
async function loadReviewsContent(activeTab = 'internal') {
    const makeTab = (id, label, active) => `
        <button onclick="switchReviewTab('${id}')" id="rv-tab-${id}" style="
            flex: 1; padding: 9px 12px; border-radius: 24px; border: 2px solid ${active ? 'transparent' : '#e5e7eb'};
            background: ${active ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'transparent'};
            color: ${active ? '#fff' : '#6b7280'}; font-size: 13px; font-weight: ${active ? '700' : '600'};
            cursor: ${active ? 'default' : 'pointer'}; letter-spacing: 0.3px; transition: all 0.2s ease;
            ${active ? 'box-shadow: 0 4px 12px rgba(26,26,46,0.3);' : ''}
        " ${active ? '' : `onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#e5e7eb'"`}>${label}</button>
    `;

    const tabsHtml = `
        <div style="display: flex; gap: 6px; margin-bottom: 20px;">
            <button onclick="openSection('about')" style="
                flex: 1; padding: 9px 12px; border-radius: 24px; border: 2px solid #e5e7eb;
                background: transparent; color: #6b7280; font-size: 13px; font-weight: 600;
                cursor: pointer; transition: all 0.2s ease; letter-spacing: 0.3px;
            " onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#e5e7eb'">О нас</button>
            ${makeTab('internal', 'Отзывы', activeTab === 'internal')}
            ${makeTab('external', 'С сайта', activeTab === 'external')}
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/reviews`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reviews = await response.json();

        let content = `<div class="content-section">${tabsHtml}`;

        if (reviews && reviews.length > 0) {
            reviews.forEach(review => {
                const stars = '⭐'.repeat(Math.min(5, Number(review.rating) || 5));
                content += `
                    <div style="
                        background: #ffffff;
                        border: 1px solid rgba(0,0,0,0.07);
                        border-radius: 16px;
                        padding: 18px 16px;
                        margin-bottom: 14px;
                        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                        position: relative;
                        overflow: hidden;
                    ">
                        <div style="
                            position: absolute; top: 0; left: 0; right: 0; height: 3px;
                            background: linear-gradient(90deg, #1a1a2e, #4a90d9);
                        "></div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            ${review.photoUrl
                        ? `<img src="${escapeAttr(review.photoUrl)}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; flex-shrink:0;" onerror="this.outerHTML='<div style=\\'width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#1a1a2e 0%,#4a90d9 100%);display:flex;align-items:center;justify-content:center;font-size:16px;color:white;font-weight:700;flex-shrink:0;\\'>${escapeHtml((review.name || 'А').charAt(0).toUpperCase())}</div>'">`
                        : `<div style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,#1a1a2e 0%,#4a90d9 100%); display:flex; align-items:center; justify-content:center; font-size:16px; color:white; font-weight:700; flex-shrink:0;">${escapeHtml((review.name || 'А').charAt(0).toUpperCase())}</div>`
                    }
                            <div>
                                <div style="font-weight: 700; font-size: 15px; color: #111;">${escapeHtml(review.name || '')}</div>
                                <div style="font-size: 13px; color: #f59e0b; letter-spacing: 1px;">${stars}</div>
                            </div>
                        </div>
                        <p style="color: #374151; line-height: 1.65; font-size: 14px; margin: 0;">${escapeHtml(review.content || '')}</p>
                        ${review.link ? `<p style="margin-top: 12px; margin-bottom: 0;"><a href="${review.link}" target="_blank" style="color: #1a1a2e; text-decoration: underline; font-size: 13px;">Подробнее →</a></p>` : ''}
                    </div>
                `;
            });
        } else {
            content += `
                <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
                    <div style="font-size: 48px; margin-bottom: 12px;">💬</div>
                    <p style="font-size: 15px;">Отзывов пока нет</p>
                </div>
            `;
        }

        // "Оставить отзыв" button
        content += `
            <div style="margin-top: 8px; margin-bottom: 24px;">
                <button onclick="openReviewForm()" style="
                    width: 100%; padding: 14px 20px; border-radius: 16px; border: none;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: #ffffff; font-size: 15px; font-weight: 700;
                    cursor: pointer; box-shadow: 0 4px 14px rgba(26,26,46,0.35);
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    transition: opacity 0.2s;
                " onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
                    ✍️ Оставить отзыв
                </button>
            </div>
        `;

        content += '</div>';

        // Review form modal (injected once)
        content += `
            <div id="review-form-modal" style="
                display: none; position: fixed; inset: 0; z-index: 9999;
                background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
                align-items: flex-end; justify-content: center;
            " onclick="if(event.target===this) closeReviewForm()">
                <div style="
                    background: #fff; border-radius: 24px 24px 0 0;
                    padding: 24px 20px 32px; width: 100%; max-width: 500px;
                    box-shadow: 0 -6px 30px rgba(0,0,0,0.18);
                    animation: slideUp 0.28s ease;
                ">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
                        <h3 style="margin:0; font-size:18px; font-weight:800;">✍️ Ваш отзыв</h3>
                        <button onclick="closeReviewForm()" style="
                            background:none; border:none; font-size:22px; cursor:pointer; color:#9ca3af; line-height:1;
                        ">✕</button>
                    </div>

                    <textarea id="review-text" placeholder="Поделитесь своими впечатлениями о Plazma Water…" style="
                        width: 100%; min-height: 120px; padding: 14px; border-radius: 14px;
                        border: 1.5px solid #e5e7eb; font-size: 14px; line-height: 1.6;
                        resize: vertical; font-family: inherit; box-sizing: border-box;
                        outline: none; transition: border-color 0.2s;
                    " oninput="updateReviewCharCount(this)" maxlength="2000"></textarea>
                    <div style="text-align:right; font-size:12px; color:#9ca3af; margin-top:4px;">
                        <span id="review-char-count">0</span>/2000
                    </div>

                    <label style="
                        display: flex; align-items: center; gap: 10px; margin-top: 14px;
                        padding: 12px 16px; border-radius: 14px; border: 1.5px dashed #d1d5db;
                        cursor: pointer; transition: border-color 0.2s;
                    " onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#d1d5db'">
                        <span style="font-size:22px;">📎</span>
                        <div>
                            <div style="font-weight:600; font-size:14px;">Добавить фото или видео</div>
                            <div style="font-size:12px; color:#9ca3af;">Необязательно · JPEG, PNG, MP4, MOV</div>
                        </div>
                        <input id="review-media" type="file" accept="image/*,video/*" style="display:none"
                            onchange="previewReviewMedia(this)">
                    </label>
                    <div id="review-media-preview" style="margin-top:10px;"></div>

                    <input id="review-link" type="url" placeholder="Ссылка (необязательно) — отзыв на сторонней площадке" style="
                        width: 100%; padding: 12px 14px; border-radius: 14px; margin-top: 12px;
                        border: 1.5px solid #e5e7eb; font-size: 14px; font-family: inherit;
                        box-sizing: border-box; outline: none; color: #111;
                        transition: border-color 0.2s;
                    " onfocus="this.style.borderColor='#1a1a2e'" onblur="this.style.borderColor='#e5e7eb'">

                    <button onclick="submitReview()" id="review-submit-btn" style="
                        width: 100%; margin-top: 18px; padding: 15px 20px; border-radius: 16px;
                        border: none; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
                        box-shadow: 0 4px 14px rgba(26,26,46,0.35); transition: opacity 0.2s;
                    " onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
                        Отправить отзыв
                    </button>
                    <p style="text-align:center; font-size:12px; color:#9ca3af; margin-top:10px; margin-bottom:0;">
                        Отзыв появится после проверки администратором
                    </p>
                </div>
            </div>
            <style>
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            </style>
        `;

        return content;
    } catch (error) {
        return `<div class="content-section">${tabsHtml}<div class="error-message"><h3>Ошибка загрузки отзывов</h3><p>Попробуйте позже</p></div></div>`;
    }
}

function openReviewForm() {
    const modal = document.getElementById('review-form-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('review-text')?.focus();
    }
}

function closeReviewForm() {
    const modal = document.getElementById('review-form-modal');
    if (modal) modal.style.display = 'none';
}

function updateReviewCharCount(el) {
    const counter = document.getElementById('review-char-count');
    if (counter) counter.textContent = el.value.length;
}

function previewReviewMedia(input) {
    const preview = document.getElementById('review-media-preview');
    if (!preview) return;
    const file = input.files?.[0];
    if (!file) { preview.innerHTML = ''; return; }

    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);
    preview.innerHTML = isVideo
        ? `<video src="${url}" controls style="width:100%; border-radius:12px; max-height:180px; object-fit:cover;"></video>`
        : `<img src="${url}" style="width:100%; border-radius:12px; max-height:180px; object-fit:cover;">`;
}

async function submitReview() {
    const text = document.getElementById('review-text')?.value?.trim();
    const mediaInput = document.getElementById('review-media');
    const btn = document.getElementById('review-submit-btn');

    if (!text || text.length < 5) {
        showError('Напишите текст отзыва (минимум 5 символов)');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Отправляется…'; }

    try {
        const link = document.getElementById('review-link')?.value?.trim();

        const formData = new FormData();
        formData.append('content', text);
        if (link) formData.append('link', link);
        if (mediaInput?.files?.[0]) {
            formData.append('media', mediaInput.files[0]);
        }

        // Build headers manually (no Content-Type — browser sets multipart boundary)
        const headers = {};
        const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (telegramUser) {
            try { headers['X-Telegram-User'] = encodeURIComponent(JSON.stringify(telegramUser)); } catch (_) { }
        }

        const response = await fetch(`${API_BASE}/reviews/submit`, {
            method: 'POST',
            headers,
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showError(data.error || 'Ошибка отправки');
            return;
        }

        closeReviewForm();
        showSuccess('Спасибо за ваш отзыв! Он появится после проверки 🙏');

        // Reset form
        if (document.getElementById('review-text')) document.getElementById('review-text').value = '';
        if (document.getElementById('review-link')) document.getElementById('review-link').value = '';
        if (document.getElementById('review-media-preview')) document.getElementById('review-media-preview').innerHTML = '';
        if (document.getElementById('review-char-count')) document.getElementById('review-char-count').textContent = '0';
        if (mediaInput) mediaInput.value = '';

    } catch (err) {
        console.error('submitReview error:', err);
        showError('Ошибка отправки. Попробуйте ещё раз.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Отправить отзыв'; }
    }
}


async function switchReviewTab(tab) {
    const body = document.getElementById('section-body');
    if (!body) return;
    if (tab === 'external') {
        body.innerHTML = await buildExternalGalleryHtml();
    } else {
        body.innerHTML = await loadReviewsContent('internal');
    }
}

async function buildExternalGalleryHtml() {
    const makeTab = (id, label, active) => `
        <button onclick="switchReviewTab('${id}')" id="rv-tab-${id}" style="
            flex: 1; padding: 9px 12px; border-radius: 24px; border: 2px solid ${active ? 'transparent' : '#e5e7eb'};
            background: ${active ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'transparent'};
            color: ${active ? '#fff' : '#6b7280'}; font-size: 13px; font-weight: ${active ? '700' : '600'};
            cursor: ${active ? 'default' : 'pointer'}; letter-spacing: 0.3px;
            ${active ? 'box-shadow: 0 4px 12px rgba(26,26,46,0.3);' : ''}
        " ${active ? '' : `onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#e5e7eb'"`}>${label}</button>
    `;
    const tabsHtml = `
        <div style="display: flex; gap: 6px; margin-bottom: 20px;">
            <button onclick="openSection('about')" style="
                flex: 1; padding: 9px 12px; border-radius: 24px; border: 2px solid #e5e7eb;
                background: transparent; color: #6b7280; font-size: 13px; font-weight: 600;
                cursor: pointer; transition: all 0.2s ease;
            " onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#e5e7eb'">О нас</button>
            ${makeTab('internal', 'Отзывы', false)}
            ${makeTab('external', 'С сайта', true)}
        </div>
    `;

    let galleryHtml = `<div class="content-section">${tabsHtml}`;

    try {
        const resp = await fetch(`${API_BASE}/reviews/external`);
        const data = resp.ok ? await resp.json() : { images: [], textReviews: [] };
        const images = Array.isArray(data.images) ? data.images : [];

        if (images.length === 0) {
            galleryHtml += `<div style="text-align:center; padding:40px 0; color:#9ca3af;"><p>Галерея временно недоступна</p></div>`;
        } else {
            // 1-column list
            galleryHtml += `<div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">`;
            images.forEach((url, i) => {
                galleryHtml += `
                    <div style="border-radius: 14px; overflow: hidden; cursor: zoom-in;"
                         onclick="showReviewImage('${escapeAttr(url)}')">
                        <img src="${escapeAttr(url)}" loading="lazy" style="
                            width: 100%; display: block; border-radius: 14px;
                        " onerror="this.parentElement.style.display='none'"
                           onload="if(this.naturalHeight < 40 || this.naturalWidth < 40) this.parentElement.style.display='none'"
                           alt="Отзыв ${i + 1}">
                    </div>
                `;
            });
            galleryHtml += `</div>`;
        }
    } catch (e) {
        galleryHtml += `<div style="text-align:center; padding:40px 0; color:#9ca3af;"><p>Ошибка загрузки галереи</p></div>`;
    }

    galleryHtml += `
        </div>
        <!-- Lightbox -->
        <div id="review-lightbox" style="
            display:none; position:fixed; inset:0; z-index:10000;
            background:rgba(0,0,0,0.92); align-items:center; justify-content:center;
        " onclick="document.getElementById('review-lightbox').style.display='none'">
            <img id="review-lightbox-img" src="" style="max-width:95vw; max-height:90vh; border-radius:12px; object-fit:contain;">
        </div>
    `;
    return galleryHtml;
}

function showReviewImage(url) {
    const lb = document.getElementById('review-lightbox');
    const img = document.getElementById('review-lightbox-img');
    if (lb && img) {
        img.src = url;
        lb.style.display = 'flex';
    }
}

// About content
async function loadAboutContent() {
    const tabsHtml = `
        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
            <button style="
                flex: 1; padding: 10px 16px; border-radius: 24px; border: 2px solid transparent;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: #ffffff; font-size: 14px; font-weight: 700;
                cursor: default; letter-spacing: 0.3px;
                box-shadow: 0 4px 12px rgba(26,26,46,0.35);
            ">
                О нас
            </button>
            <button onclick="openSection('reviews')" style="
                flex: 1; padding: 10px 16px; border-radius: 24px; border: 2px solid #e5e7eb;
                background: transparent; color: #6b7280; font-size: 14px; font-weight: 600;
                cursor: pointer; transition: all 0.2s ease; letter-spacing: 0.3px;
            "
            onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#e5e7eb'">
                Отзывы
            </button>
        </div>
    `;
    return `
        <div class="content-section">
            ${tabsHtml}
            <p><strong>🌀 Добро пожаловать в эру будущего!</strong></p>
            <p>🧬 Plazma Water — это инновационный водный раствор, содержащий микроэлементы в уникальной плазменной наноструктуре. Благодаря особой технологии, частицы в составе имеют нано-размер и равномерно распределены в воде, что обеспечивает их естественное взаимодействие с биологическими системами организма.</p>
            
            <p>В отличие от традиционных форм добавок, где усвоение может быть ограничено, плазменная наноформа способствует более мягкому и естественному включению микроэлементов в обменные процессы. При этом не требуется участие дополнительных вспомогательных веществ, что делает продукт лёгким для восприятия и безопасным при разумном использовании.</p>
            
            <p>💧 Plazma Water не является лекарственным средством и не предназначен для лечения или диагностики заболеваний. Его использование направлено на поддержание оптимального водно-минерального баланса, повышение комфорта, энергии и общего самочувствия. Это самое настоящее клеточное питание.</p>
            
            <p>Технология плазменной наноструктуризации воды основана на принципах взаимодействия магнитно-гравитационных полей, описанных в современной физике плазмы. Такая структура способствует гармонизации внутренней среды организма и может поддерживать естественные защитные и адаптационные функции.</p>
            
            <p>Наши технологии позволяют считывать информацию, которую несут живые растения и вещества, и записать их на кристаллические плазменные структуры. На чистую воду перенесён информационно-полевой сигнал растения или вещества, что многократно усиливает эффективность продукта без потерь. Это научный принцип гомеопатии.</p>
            
            <p>🌀 Plazma Water - Zero Point Energy (Энергией Нулевой Точки). Наша технология берет начало там, где заканчивается обычная химия. Это новая физика воды.</p>

            <div style="margin-top: 18px; display: flex; flex-direction: column; gap: 10px;">
              <a href="https://iplazma.com/whatsplazma" target="_blank" class="btn btn-primary" style="text-decoration: none; text-align: center;">
                  🌍 Наша миссия
              </a>
              <button class="btn btn-secondary" onclick="openSection('support')">
                  💬 Написать в поддержку
              </button>
            </div>
        </div>
    `;
}

// Support content
async function loadSupportContent() {
    return `
        <div class="content-section">
            <h3>Служба поддержки</h3>
            <p>Напишите свой вопрос прямо здесь — команда Plazma Water ответит как можно быстрее.</p>

            <div id="support-chat" style="margin-top: 16px;">
                <div id="support-messages" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 14px; padding: 14px; height: 340px; overflow-y: auto;">
                    <div class="loading"><div class="loading-spinner"></div></div>
                </div>

                <div style="display: grid; gap: 10px; margin-top: 12px;">
                    <input id="supportMessageInput" type="text" placeholder="Напишите сообщение…" style="width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border-color);" />
                    <button class="btn" onclick="sendSupportChatMessage()" style="width: 100%;">Отправить</button>
                </div>

                <p style="margin-top: 10px; color: #9ca3af; font-size: 12px;">
                    Поддержка 24/7. Если нужен срочный контакт — напишите номер телефона, и мы перезвоним.
                </p>
            </div>
        </div>
    `;
}

// Chats list (for bottom navigation)
async function loadChatsContent() {
    return `
        <div class="content-section">
            <h3>Чаты</h3>
            <div style="margin-top: 14px; display: grid; gap: 12px;">
                <div class="content-card support-card" onclick="openSection('support')" style="cursor: pointer;">
                    <div class="card-image"></div>
                    <div class="card-content">
                        <h4>Служба поддержки</h4>
                        <p>Написать в поддержку</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Favorites content
async function loadFavoritesContent() {
    try {
        // Ensure latest favorites are loaded
        await loadFavorites();
        const response = await fetch(`${API_BASE}/favorites/products`, { headers: getApiHeaders() });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return `
                <div class="content-section">
                    <h3>Избранное</h3>
                    <div class="error-message">
                        <h3>Ошибка загрузки</h3>
                        <p>${escapeHtml(errorData?.error || 'Не удалось загрузить избранное')}</p>
                    </div>
                </div>
            `;
        }

        const products = await response.json();
        const list = Array.isArray(products) ? products : [];

        if (list.length === 0) {
            return `
                <div class="content-section">
                    <h3>Избранное</h3>
                    <p>Ваши сохранённые товары</p>
                    <div style="margin: 20px 0;">
                        <p style="color: #666666; text-align: center;">Пока ничего не добавлено в избранное</p>
                    </div>
                </div>
            `;
        }

        let html = `
            <div class="content-section">
                <h3>Избранное</h3>
                <p>Ваши сохранённые товары</p>
                <div class="products-grid favorites-products-grid" style="margin-top: 12px;">
        `;

        list.forEach((p) => {
            html += renderProductCard(p);
        });

        html += `
                </div>
            </div>
        `;

        return html;
    } catch (e) {
        console.error('❌ Error loading favorites content:', e);
        return '<div class="error-message"><h3>Ошибка загрузки избранного</h3><p>Попробуйте позже</p></div>';
    }
}

// Action functions

async function addToCart(productId, quantity = 1) {
    if (!productId) {
        console.error('❌ No productId provided');
        showError('Ошибка: не указан товар');
        return false;
    }

    try {
        console.log('🛒 Adding product to cart:', productId);

        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ productId, quantity: Number(quantity) || 1 })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Product added to cart:', result);

            // Анимация корзины
            animateCartIcon();

            // Оптимистичное обновление счетчика
            incrementCartBadge(Number(quantity) || 1);

            // Загружаем обновленную корзину (счетчик обновится с точными данными)
            await loadCartItems();

            showSuccess('Товар добавлен в корзину!');
            return true;
        } else {
            // Получаем детали ошибки
            let errorMessage = 'Ошибка добавления в корзину';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                console.error('❌ Add to cart error response:', errorData);
            } catch (e) {
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMessage = errorText;
                    }
                } catch (textError) {
                    console.error('❌ Failed to parse error:', textError);
                }
            }

            console.error('❌ Add to cart error:', response.status, errorMessage);

            if (response.status === 401) {
                showError('Необходимо авторизоваться для добавления в корзину');
            } else if (response.status === 400) {
                showError(errorMessage || 'Неверные данные товара');
            } else if (response.status === 404) {
                showError('Товар не найден');
            } else if (response.status === 503) {
                showError('Сервис временно недоступен. Попробуйте позже.');
            } else {
                showError(errorMessage || 'Ошибка добавления в корзину');
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Error adding to cart:', error);

        let errorDetails = '';
        if (error?.message) errorDetails += error.message;
        if (error?.stack) console.error('Stack:', error.stack);

        // Network errors often appear as TypeError in fetch
        if (error.name === 'TypeError' && (error.message === 'Failed to fetch' || error.message.includes('Network') || error.message.includes('Load failed'))) {
            showError('Ошибка сети. Проверьте интернет соединение.');
            return false;
        }

        // Specific handling for "Type error" which is often a fetch failure on Safari
        if (error.name === 'TypeError' || error.message === 'Type error') {
            showError(`Ошибка соединения (Type Error). Попробуйте позже. \nДетали: ${errorDetails}`);
            return false;
        }

        showError(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
        return false;
    }
}

async function addToCartAndOpenCart(productId, quantity = 1) {
    const ok = await addToCart(productId, quantity);
    if (ok) {
        openCart();
    }
}

async function buyNowFromProduct(productId, quantity = 1) {
    const ok = await addToCart(productId, quantity);
    if (ok) {
        await checkoutCart();
    }
}

// Анимация иконки корзины при добавлении товара
function animateCartIcon() {
    try {
        const cartButton = document.querySelector('.control-btn[onclick="openCart()"]');
        if (cartButton) {
            cartButton.style.transform = 'scale(1.2)';
            cartButton.style.transition = 'transform 0.3s ease';

            setTimeout(() => {
                cartButton.style.transform = 'scale(1)';
            }, 300);
        }

        // Анимация бейджа
        const cartBadge = document.querySelector('.cart-badge');
        if (cartBadge) {
            cartBadge.style.transform = 'scale(1.5)';
            cartBadge.style.transition = 'transform 0.3s ease';

            setTimeout(() => {
                cartBadge.style.transform = 'scale(1)';
            }, 300);
        }
    } catch (e) {
        console.error('Animation error:', e);
    }
}


async function buyProduct(productId, quantity = 1) {
    try {
        const response = await fetch(`${API_BASE}/orders/create`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
                items: [{ productId, quantity: Number(quantity) || 1 }],
                message: 'Покупка через веб-приложение'
            })
        });

        if (response.ok) {
            showSuccess('Заказ создан! Ожидайте подтверждения.');
            // После создания заказа запрашиваем телефон и адрес
            await requestContactAndAddress();
        } else {
            const errorData = await response.json().catch(() => ({}));
            showError(`Ошибка создания заказа: ${errorData.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error('Error creating order:', error);
        showError('Ошибка создания заказа');
    }
}

async function activatePartnerProgram(type) {
    try {
        console.log('🤝 Redirecting to partner dashboard:', type);
        // Instead of generating a fake code, redirect to the real partner dashboard
        // which loads actual data from the API
        showPartnerDashboard();
    } catch (error) {
        console.error('Error showing partner program:', error);
        showError('Ошибка отображения программы');
    }
}

async function showPartnerDashboard() {
    try {
        const response = await fetch(`${API_BASE}/partner/dashboard`, { headers: getApiHeaders() });
        const dashboard = await response.json();

        let content = '<div class="content-section">';
        content += '<button class="btn btn-secondary" onclick="openSection(\'partner\')" style="margin-bottom: 20px;">← Назад</button>';
        content += '<h3>Личный кабинет партнёра</h3>';

        if (dashboard) {
            // Activation status banner
            const isActive = dashboard.profile && dashboard.profile.isActive;

            if (isActive) {
                content += `
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                                color: white; 
                                padding: 16px; 
                                border-radius: 12px; 
                                margin-bottom: 20px;
                                text-align: center;
                                font-weight: 600;
                                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                        ✅ Ваша партнёрка активна
                    </div>
                `;
            } else {
                content += `
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                                color: white; 
                                padding: 16px; 
                                border-radius: 12px; 
                                margin-bottom: 20px;
                                text-align: center;
                                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                        <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Партнёрская программа не активна</div>
                        <div style="font-size: 14px; opacity: 0.95; margin-bottom: 4px;">Совершите покупки на сумму от 12,000 ₽ для активации</div>
                        <div style="font-size: 12px; opacity: 0.85; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 8px;">
                             ℹ️ Партнёрка действует 2 месяца.<br>
                             Для продления — купите на 12 000 ₽ до окончания срока.
                        </div>
                    </div>
                `;
            }

            // Safe access to profile data
            const profile = dashboard.profile || {};
            const botUsername = 'iplazmabot';
            const referralLink = profile.referralCode
                ? `https://t.me/${botUsername}?start=ref_direct_${profile.referralCode}`
                : 'Ссылка будет доступна после активации';

            content += `
                <div style="background: #f9f9f9; 
                            border: 1px solid var(--border-color); 
                            border-radius: 12px; 
                            padding: 20px; 
                            margin-bottom: 20px;">
                    <h4 style="color: #000000; margin-bottom: 16px;">📊 Статистика</h4>
                    <p style="color: #333333; margin-bottom: 8px;">💰 Баланс: ${formatPz(dashboard.balance || 0)}</p>
                    <p style="color: #333333; margin-bottom: 8px;">👥 Партнёры: ${dashboard.partners || 0}</p>
                    <p style="color: #333333; margin-bottom: 8px;">🎁 Всего бонусов: ${formatPz(dashboard.bonus || 0)}</p>
                </div>
                
                <div class="referral-section" style="margin: 20px 0;">
                    <h3>Ваша реферальная ссылка</h3>
                    <p>Делитесь ссылкой и получайте 15% с покупок приглашённых!</p>
                    
                    <div class="referral-link-box" style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input type="text" value="${referralLink}" readonly id="refLinkInput" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #ccc;">
                        <button class="btn-icon" onclick="copyReferralLink(document.getElementById('refLinkInput').value)" style="padding: 10px;">
                            📋
                        </button>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button class="btn" onclick="shareReferralLink('${referralLink}')" style="flex: 1;">
                            📤 Поделиться
                        </button>
                        <button class="btn btn-secondary" onclick="showQrCode('${escapeAttr(profile.referralDirectQrUrl || '')}')" style="width: auto; aspect-ratio: 1; display: flex; align-items: center; justify-content: center;">
                            📱 QR
                        </button>
                    </div>
                </div>
                
                <div style="margin: 20px 0; background: #f9f9f9; border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;">
                    <button onclick="toggleInlinePartners(this)" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:none; border:none; cursor:pointer; font-size:15px; font-weight:700; color:#000;">
                        <span>👥 Мои партнёры (${dashboard.partners || 0})</span>
                        <span id="partners-chevron" style="font-size:18px; transition:transform 0.2s;">▼</span>
                    </button>
                    <div id="inline-partners-list" style="display:none; padding:0 20px 16px;">
                        <div class="loading-spinner" style="margin: 10px auto;"></div>
                    </div>
                </div>
                
                <div style="margin: 20px 0; 
                            background: #f9f9f9; 
                            border: 1px solid var(--border-color); 
                            border-radius: 12px; 
                            padding: 20px;">
                    <h4 style="color: #000000; margin-bottom: 12px;">📋 Правила партнёрской программы</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #333333; line-height: 1.8;">
                        <li>Получайте 15% от каждой покупки ваших рефералов</li>
                        <li>Активация: покупка на 12 000 ₽ → 15% на 2 месяца</li>
                        <li>Скидка 10% на свои покупки при активной партнёрке</li>
                        <li>Для продления — снова купите на 12 000 ₽ до окончания срока</li>
                        <li>Бонусы начисляются автоматически на ваш баланс</li>
                        <li>🎁 Самым активным партнёрам мы дарим подарки</li>
                    </ul>
                </div>
            `;
        } else {
            content += '<p>Сначала активируйте партнёрскую программу</p>';
        }

        content += '</div>';

        document.getElementById('section-body').innerHTML = content;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        if (error.stack) console.error(error.stack);
        const errorText = error && error.message ? error.message : 'Неизвестная ошибка';
        document.getElementById('section-body').innerHTML = `<div class="error-message"><h3>Ошибка загрузки кабинета</h3><p>${escapeHtml(errorText)}</p><p style="font-size:12px; margin-top:10px;">Попробуйте позже</p></div>`;
    }
}

function playAudio(matrixId) {
    showSuccess(`Воспроизведение матрицы ${matrixId}...`);
}

function toggleInlinePartners(btn) {
    const list = document.getElementById('inline-partners-list');
    const chevron = document.getElementById('partners-chevron');
    if (!list) return;
    const isOpen = list.style.display !== 'none';
    if (isOpen) {
        list.style.display = 'none';
        if (chevron) chevron.style.transform = '';
    } else {
        list.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        // Load only once
        if (!list.dataset.loaded) {
            list.dataset.loaded = '1';
            loadInlinePartnersList();
        }
    }
}

async function loadInlinePartnersList() {
    const container = document.getElementById('inline-partners-list');
    if (!container) return;
    try {
        const resp = await fetch(`${API_BASE}/partner/referrals`, { headers: getApiHeaders() });
        const data = await resp.json();

        const direct = (data.directPartners || []);
        if (direct.length === 0) {
            container.innerHTML = '<p style="color:#777; font-size:14px; text-align:center;">Пока нет партнёров</p>';
            return;
        }

        const rows = direct.map((p, i) => {
            const name = p.username ? `@${p.username}` : (p.firstName || `#${i + 1}`);
            const since = p.joinedAt ? new Date(p.joinedAt).toLocaleDateString('ru-RU') : '';
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
                <span style="font-size:14px;">${i + 1}. ${escapeHtml(name)}</span>
                ${since ? `<span style="font-size:12px; color:#777;">с ${since}</span>` : ''}
            </div>`;
        }).join('');

        container.innerHTML = rows;
    } catch (e) {
        container.innerHTML = '<p style="color:#777; font-size:13px; text-align:center;">Не удалось загрузить список</p>';
    }
}

async function showVideo() {
    try {
        console.log('🎥 Getting video URL...');

        // Получаем ссылку на видео с сервера
        const response = await fetch(`${API_BASE}/video/url`);
        if (response.ok) {
            const data = await response.json();
            const videoUrl = data.videoUrl;

            console.log('✅ Video URL received:', videoUrl);

            if (tg && tg.openLink) {
                // Открываем видео в Telegram
                tg.openLink(videoUrl);
            } else if (tg && tg.openTelegramLink) {
                // Альтернативный способ открытия ссылки
                tg.openTelegramLink(videoUrl);
            } else {
                // Fallback - открываем в новом окне/вкладке
                window.open(videoUrl, '_blank');
            }
        } else {
            console.error('Failed to get video URL:', response.status);
            showError('Ошибка получения ссылки на видео');
        }
    } catch (error) {
        console.error('Error getting video URL:', error);
        showError('Ошибка открытия видео');
    }
}

function openTelegram() {
    // Ссылка на Telegram канал (замените на реальную)
    const telegramUrl = 'https://t.me/your_channel_username'; // Замените на реальную ссылку

    if (tg && tg.openLink) {
        // Открываем Telegram канал в Telegram
        tg.openLink(telegramUrl);
    } else if (tg && tg.openTelegramLink) {
        // Альтернативный способ открытия ссылки
        tg.openTelegramLink(telegramUrl);
    } else {
        // Fallback - открываем в новом окне/вкладке
        window.open(telegramUrl, '_blank');
    }
}

// Функции для партнёрской программы

function showShareText(text) {
    const content = `
        <div class="content-section">
            <h3>📤 Текст для отправки друзьям</h3>
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #3d3d3d 100%); 
                        border: 1px solid rgba(255, 255, 255, 0.1); 
                        border-radius: 12px; 
                        padding: 16px; 
                        margin: 20px 0;">
                <p style="color: #ffffff; white-space: pre-line; line-height: 1.5;">${text}</p>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="copyShareText('${text.replace(/'/g, "\\'")}')">
                    📋 Скопировать текст
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="showPartnerProgram()">
                    ← Назад к программе
                </button>
            </div>
        </div>
    `;

    showProductsSection(content);
}

function copyShareText(text) {
    try {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('Текст скопирован в буфер обмена!');
        }).catch(() => {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showSuccess('Текст скопирован!');
        });
    } catch (error) {
        console.error('Error copying text:', error);
        showError('Не удалось скопировать текст');
    }
}

function showPartnerProgram() {
    // Load real partner data from API
    fetch(`${API_BASE}/partner/dashboard`, { headers: getApiHeaders() })
        .then(resp => resp.ok ? resp.json() : null)
        .then(dashboard => {
            const botUsername = 'iplazmabot';
            let content = '<div class="content-section">';
            content += '<h3>Партнёрская программа</h3>';
            content += '<p>Станьте партнёром Plazma Water и получайте бонусы 15% по вашей ссылке!</p>';

            if (dashboard && dashboard.profile && dashboard.profile.referralCode) {
                const profile = dashboard.profile;
                const referralLink = `https://t.me/${botUsername}?start=ref_direct_${profile.referralCode}`;
                const isActive = profile.isActive;

                if (isActive) {
                    content += `
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px; border-radius: 12px; margin: 16px 0; text-align: center; font-weight: 600;">
                            ✅ Партнёрская программа активна
                        </div>`;
                } else {
                    content += `
                        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px; border-radius: 12px; margin: 16px 0; text-align: center;">
                            <div style="font-weight: 600; margin-bottom: 4px;">⚠️ Партнёрская программа не активна</div>
                            <div style="font-size: 13px; opacity: 0.9;">Совершите покупку от 12 000 ₽ для активации</div>
                        </div>`;
                }

                content += `
                    <div style="background: #f9f9f9; border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin: 16px 0;">
                        <h4 style="color: #000; margin-bottom: 8px;">🔗 Ваша реферальная ссылка:</h4>
                        <div class="referral-link-box" style="display: flex; gap: 8px; margin-bottom: 12px;">
                            <input type="text" value="${referralLink}" readonly id="partnerRefLinkInput" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 13px;" onclick="this.select();">
                            <button class="btn-icon" onclick="copyReferralLink(document.getElementById('partnerRefLinkInput').value)" style="padding: 10px;">📋</button>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn" onclick="shareReferralLink('${referralLink}')" style="flex: 1;">📤 Поделиться</button>
                        </div>
                    </div>`;
            } else {
                content += `
                    <div class="partner-promo-info" style="background: #f9f9f9; border-radius: 12px; padding: 16px; margin: 20px 0;">
                        <p style="margin-bottom: 12px;"><strong>Как стать партнером:</strong></p>
                        <ul style="padding-left: 20px; color: #333;">
                            <li>Совершите покупку на сумму от 12 000 ₽</li>
                            <li>Получите реферальную ссылку автоматически</li>
                        </ul>
                    </div>`;
            }

            content += `
                <div style="margin: 20px 0;">
                    <button class="btn" onclick="openShop()">🛍 Перейти в каталог</button>
                </div>
                <div style="margin: 20px 0;">
                    <button class="btn btn-secondary" onclick="showPartnerDashboard()">📊 Личный кабинет</button>
                </div>
            </div>`;

            showProductsSection(content);
        })
        .catch(err => {
            console.error('Error loading partner program:', err);
            // Fallback: show basic info
            const content = `
                <div class="content-section">
                    <h3>Партнёрская программа</h3>
                    <p>Станьте партнёром Plazma Water и получайте бонусы 15% по вашей ссылке!</p>
                    <div style="margin: 20px 0;">
                        <button class="btn" onclick="openShop()">🛍 Перейти в каталог</button>
                    </div>
                    <div style="margin: 20px 0;">
                        <button class="btn btn-secondary" onclick="showPartnerDashboard()">📊 Личный кабинет</button>
                    </div>
                </div>`;
            showProductsSection(content);
        });
}

// Support chat (webapp)
let supportMessages = [];

function initSupportChat() {
    // Only run if the section is present
    const box = document.getElementById('support-messages');
    if (!box) return;

    // Enter-to-send
    const input = document.getElementById('supportMessageInput');
    if (input && !input.__supportEnterBound) {
        input.__supportEnterBound = true;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendSupportChatMessage();
            }
        });
    }

    loadSupportChatMessages();

    // Start polling
    if (supportChatInterval) clearInterval(supportChatInterval);
    supportChatInterval = setInterval(loadSupportChatMessages, 3000);
}

function renderSupportMessages() {
    const box = document.getElementById('support-messages');
    if (!box) return;

    if (!supportMessages || supportMessages.length === 0) {
        box.innerHTML = `
            <div style="text-align:center; padding: 24px 10px; color:#6b7280;">
                <p style="margin:0 0 8px 0;">Сообщений пока нет</p>
                <p style="margin:0; font-size:12px;">Напишите нам — мы ответим как можно быстрее.</p>
            </div>
        `;
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
    supportMessages.forEach((m) => {
        const isUser = m.direction === 'user';
        const align = isUser ? 'flex-end' : 'flex-start';
        const bg = isUser ? '#111827' : '#f3f4f6';
        const color = isUser ? '#ffffff' : '#111827';
        const time = m.createdAt ? new Date(m.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

        html += `
            <div style="display:flex; justify-content:${align};">
                <div style="max-width: 85%; background:${bg}; color:${color}; border-radius: 14px; padding: 10px 12px; line-height:1.35;">
                    <div style="white-space:pre-wrap; word-break:break-word;">${escapeHtml(m.text || '')}</div>
                    ${time ? `<div style="margin-top:6px; font-size:11px; opacity:0.7; text-align:right;">${escapeHtml(time)}</div>` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';

    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

async function loadSupportChatMessages() {
    const box = document.getElementById('support-messages');

    // Stop polling if the element is no longer in the DOM
    if (!box) {
        if (supportChatInterval) {
            clearInterval(supportChatInterval);
            supportChatInterval = null;
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/support/messages`, { headers: getApiHeaders() });
        if (!response.ok) {
            // Keep silent api errors during polling, unless it's the initial empty state
            if (!supportMessages || supportMessages.length === 0) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Failed to load support messages: ${response.status} ${errorText}`);
            }
            return;
        }
        const data = await response.json();
        const newMessages = Array.isArray(data) ? data : [];

        // Only render if changed (simple serialization check)
        if (JSON.stringify(newMessages) !== JSON.stringify(supportMessages)) {
            supportMessages = newMessages;
            renderSupportMessages();
        }
    } catch (error) {
        console.error('❌ Error loading support messages:', error);
        if (!supportMessages || supportMessages.length === 0) {
            box.innerHTML = `
                <div class="error-message">
                    <h3>Ошибка загрузки чата</h3>
                    <p>Попробуйте обновить страницу.</p>
                    <button class="btn" onclick="loadSupportChatMessages()" style="margin-top:12px;">Обновить</button>
                </div>
            `;
        }
    }
}

async function sendSupportChatMessage() {
    const input = document.getElementById('supportMessageInput');
    const text = (input?.value || '').trim();
    if (!text) return;

    try {
        if (input) input.value = '';
        // Optimistic UI
        supportMessages = [...(supportMessages || []), { direction: 'user', text, createdAt: new Date().toISOString() }];
        renderSupportMessages();

        const response = await fetch(`${API_BASE}/support/messages`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error || `HTTP ${response.status}`);
        }

        // Refresh from server (ensures order + IDs)
        await loadSupportChatMessages();
    } catch (error) {
        console.error('❌ Error sending support message:', error);
        showError('Не удалось отправить сообщение. Попробуйте еще раз.');
        // Reload to avoid diverging optimistic state
        await loadSupportChatMessages().catch(() => { });
    }
}

function showReferralLink() {
    showSuccess('Копирование реферальной ссылки...');
    // Здесь можно добавить логику показа ссылки
}

async function showPartners() {
    try {
        const response = await fetch(`${API_BASE}/partner/referrals`, { headers: getApiHeaders() });
        if (!response.ok) {
            throw new Error('Failed to fetch referrals');
        }

        const data = await response.json();
        const directPartners = data.directPartners || [];
        const multiPartners = data.multiPartners || [];

        let html = '<div class="partners-list-container">';
        html += '<h3>👥 Мои рефералы</h3>';

        if (directPartners.length === 0 && multiPartners.length === 0) {
            html += '<p>Пока нет рефералов. Приглашайте друзей по вашей реферальной ссылке!</p>';
        } else {
            if (directPartners.length > 0) {
                html += '<h4>🎯 Прямые рефералы (1-й уровень)</h4>';
                html += '<ul class="referrals-list">';
                directPartners.forEach((partner, index) => {
                    const displayName = partner.username ? `@${partner.username}` : (partner.firstName || `ID:${partner.telegramId?.slice(-5) || ''}`);
                    const joinedDate = partner.joinedAt ? new Date(partner.joinedAt).toLocaleDateString('ru-RU') : '';
                    html += `<li>${index + 1}. ${escapeHtml(displayName)}${joinedDate ? ` (с ${joinedDate})` : ''}</li>`;
                });
                html += '</ul>';
            }

            if (multiPartners.length > 0) {
                html += '<h4>🌳 Многоуровневые рефералы</h4>';
                html += '<ul class="referrals-list">';
                multiPartners.forEach((partner, index) => {
                    const displayName = partner.username ? `@${partner.username}` : (partner.firstName || `ID:${partner.telegramId?.slice(-5) || ''}`);
                    const level = partner.level || 2;
                    const joinedDate = partner.joinedAt ? new Date(partner.joinedAt).toLocaleDateString('ru-RU') : '';
                    html += `<li>${index + 1}. ${escapeHtml(displayName)} (${level}-й уровень)${joinedDate ? ` - с ${joinedDate}` : ''}</li>`;
                });
                html += '</ul>';
            }
        }

        html += '</div>';

        const container = document.getElementById('section-body');
        if (container) {
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading partners:', error);
        showError('Ошибка загрузки списка рефералов');
    }
}

// Show products section with custom content
function showProductsSection(content) {
    currentSection = 'shop';
    const overlay = document.getElementById('section-overlay');
    const title = document.getElementById('section-title');
    const body = document.getElementById('section-body');

    // Set section title
    title.textContent = 'Товары';

    // Set custom content
    body.innerHTML = content;

    // Show overlay
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('open');
    }, 10);
}

// Show instruction modal
function showInstruction(productId, instructionText) {
    const modal = document.createElement('div');
    modal.className = 'instruction-modal';
    modal.innerHTML = `
        <div class="instruction-overlay" onclick="closeInstruction()">
            <div class="instruction-content" onclick="event.stopPropagation()">
                <div class="instruction-header">
                    <h3>📋 Инструкция по применению</h3>
                    <button class="btn-close" onclick="closeInstruction()">×</button>
                </div>
                <div class="instruction-body">
                    <div class="instruction-text rich-text-content">
                        ${window.DOMPurify ? DOMPurify.sanitize(instructionText, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span'], ALLOWED_ATTR: ['href', 'style', 'class'] }) : escapeHtml(instructionText)}
                    </div>
                </div>
                <div class="instruction-footer">
                    <button class="btn btn-secondary" onclick="closeInstruction()">Закрыть</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add animation
    setTimeout(() => {
        modal.querySelector('.instruction-content').style.transform = 'scale(1)';
    }, 10);
}

// Close instruction modal
function closeInstruction() {
    const modal = document.querySelector('.instruction-modal');
    if (modal) {
        modal.querySelector('.instruction-content').style.transform = 'scale(0.8)';
        setTimeout(() => {
            modal.remove();
        }, 200);
    }
}

// NOTE: showCategoryProducts is defined earlier in this file.
// This legacy duplicate implementation was removed to avoid "Identifier ... has already been declared"
// and potential runtime issues in strict environments.

// NOTE: do not add duplicate addToCart/buyProduct implementations below.

// Contact and address collection functions
async function requestContactAndAddress() {
    // Сначала проверяем, есть ли у пользователя уже сохраненные данные
    const user = await loadUserData();

    if (user && user.phone && user.deliveryAddress) {
        // У пользователя есть и телефон и адрес - показываем подтверждение
        await showAddressConfirmation(user.deliveryAddress);
    } else if (user && user.phone) {
        // Есть только телефон - запрашиваем адрес
        await requestDeliveryAddress();
    } else {
        // Нет ни телефона, ни адреса - запрашиваем телефон
        await requestPhoneNumber();
    }
}

async function requestPhoneNumber() {
    const content = `
        <div class="content-section">
            <h3>📞 Номер телефона</h3>
            <p>Для быстрой связи поделитесь своим номером телефона:</p>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="shareContact()">
                    📞 Поделиться контактом
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="enterPhoneManually()">
                    ✏️ Ввести номер вручную
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="skipPhone()">
                    ⏭️ Пропустить
                </button>
            </div>
        </div>
    `;

    showProductsSection(content);
}

async function requestDeliveryAddress() {
    const content = `
        <div class="content-section">
            <h3>📍 Адрес доставки</h3>
            <p>Укажите адрес для доставки заказа:</p>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="selectAddressType('bali')">
                    🇮🇩 Бали - район и вилла
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="selectAddressType('russia')">
                    🇷🇺 РФ - город и адрес
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="selectAddressType('custom')">
                    ✏️ Ввести свой вариант
                </button>
            </div>
            
            <div style="margin: 30px 0; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <button class="btn btn-outline" onclick="skipAddress()" style="margin-right: 10px;">
                    ⏭️ Пропустить
                </button>
                <button class="btn btn-outline" onclick="closeSection()">
                    ❌ Отмена
                </button>
            </div>
        </div>
    `;

    showProductsSection(content);
}

async function showAddressConfirmation(address) {
    const content = `
        <div class="content-section">
            <h3>📍 Подтверждение адреса</h3>
            <p>Вам доставить на этот адрес?</p>
            
            <div style="background: #f9f9f9; 
                        border: 1px solid var(--border-color); 
                        border-radius: 12px; 
                        padding: 16px; 
                        margin: 20px 0;">
                <p style="color: #000000; font-weight: bold;">${address}</p>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="confirmAddress('${address}')">
                    💾 Сохранить и продолжить
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-secondary" onclick="changeAddress()">
                    ✏️ Изменить адрес
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-outline" onclick="skipAddress()">
                    ⏭️ Пропустить адрес
                </button>
            </div>
        </div>
    `;

    showProductsSection(content);
}

// Contact sharing functions
async function shareContact() {
    if (tg && tg.requestContact) {
        try {
            const contact = await tg.requestContact();
            if (contact && contact.phone_number) {
                await savePhoneNumber(contact.phone_number);
                await requestDeliveryAddress();
            }
        } catch (error) {
            console.error('Error requesting contact:', error);
            showError('Ошибка получения контакта');
        }
    } else {
        // Fallback to manual input if Telegram API is not available
        await enterPhoneManually();
    }
}

async function enterPhoneManually() {
    const phone = prompt('Введите номер телефона:');
    if (phone) {
        await savePhoneNumber(phone);
        await requestDeliveryAddress();
    }
}

async function skipPhone() {
    await requestDeliveryAddress();
}

async function savePhoneNumber(phone) {
    try {
        const response = await fetch(`${API_BASE}/user/phone`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ phone })
        });

        if (response.ok) {
            showSuccess('Номер телефона сохранен!');
        } else {
            showError('Ошибка сохранения номера');
        }
    } catch (error) {
        console.error('Error saving phone:', error);
        showError('Ошибка сохранения номера');
    }
}

// Address functions
async function selectAddressType(type) {
    let title = '';
    let placeholder = '';
    let example = '';

    switch (type) {
        case 'bali':
            title = '🇮🇩 Адрес для Бали';
            placeholder = 'Например: Семиньяк, Villa Seminyak Resort';
            example = 'Укажите район и название виллы';
            break;
        case 'russia':
            title = '🇷🇺 Адрес для России';
            placeholder = 'Например: Москва, ул. Тверская, д. 10, кв. 5';
            example = 'Укажите город и точный адрес';
            break;
        case 'custom':
            title = '✏️ Ваш адрес';
            placeholder = 'Введите полный адрес доставки';
            example = 'Укажите адрес в произвольной форме';
            break;
    }

    const content = `
        <div class="content-section">
            <h3>${title}</h3>
            <p>${example}:</p>
            
            <div style="margin: 20px 0;">
                <input type="text" id="addressInput" placeholder="${placeholder}" 
                       style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); 
                              background: rgba(255, 255, 255, 0.1); color: white; font-size: 16px;">
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="saveAddressFromInput('${type}')">
                    💾 Сохранить адрес
                </button>
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn btn-outline" onclick="requestDeliveryAddress()">
                    ← Назад к выбору
                </button>
            </div>
        </div>
    `;

    showProductsSection(content);

    // Focus on input
    setTimeout(() => {
        const input = document.getElementById('addressInput');
        if (input) {
            input.focus();
        }
    }, 100);
}

async function saveAddressFromInput(type) {
    const input = document.getElementById('addressInput');
    const address = input ? input.value.trim() : '';

    if (!address) {
        showError('Пожалуйста, введите адрес');
        return;
    }

    await saveDeliveryAddress(type, address);
}

async function skipAddress() {
    showSuccess('Адрес пропущен. Заказ будет обработан без указания адреса.');
    closeSection();
}

async function changeAddress() {
    await requestDeliveryAddress();
}

async function saveDeliveryAddress(type, address) {
    try {
        const fullAddress = `${type}: ${address}`;
        const response = await fetch(`${API_BASE}/user/address`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ address: fullAddress })
        });

        if (response.ok) {
            showSuccess('Адрес сохранен!');
            closeSection();
        } else {
            showError('Ошибка сохранения адреса');
        }
    } catch (error) {
        console.error('Error saving address:', error);
        showError('Ошибка сохранения адреса');
    }
}

async function confirmAddress(address) {
    showSuccess('Адрес подтвержден! Заказ будет доставлен по указанному адресу.');
    closeSection();
}
// NOTE: changeAddress is defined above; duplicate removed.

// New section content loaders
function _deprecated_loadCertificatesContent() {
    return '';
}

async function loadPromotionsContent() {
    try {
        const response = await fetch(`${API_BASE}/promotions`, { headers: getApiHeaders() });
        if (!response.ok) throw new Error('Failed to fetch promotions');
        const promotions = await response.json();

        if (!promotions || promotions.length === 0) {
            return `
                <div class="content-section">
                    <h3>🎉 Акции и скидки</h3>
                    <p>На данный момент активных акций нет. Следите за обновлениями!</p>
                </div>
            `;
        }

        let html = '<div class="promotions-list" style="display: flex; flex-direction: column; gap: 16px;">';

        promotions.forEach(p => {
            const imageHtml = p.imageUrl ? `<img src="${p.imageUrl}" alt="${escapeHtml(p.title)}" style="width: 100%; height: auto; border-radius: 12px; margin-bottom: 12px; object-fit: cover;">` : '';

            let actionButton = '';
            let showCatalogButton = true;

            if (p.product) {
                // If linked to product, clicking the whole card or a button opens the product
                actionButton = `
                    <button class="btn btn-primary" onclick="showProductDetails('${p.product.id}')" style="width: 100%; margin-bottom: 8px;">
                        ${escapeHtml(p.buttonText || 'Перейти к товару')}
                    </button>
                `;
            } else if (p.buttonLink && p.buttonLink !== '#catalog' && p.buttonLink !== '/catalog') {
                actionButton = `
                    <a href="${p.buttonLink}" target="_blank" class="btn btn-primary" style="display: block; text-align: center; text-decoration: none; margin-bottom: 8px;">
                        ${escapeHtml(p.buttonText || 'Подробнее')}
                    </a>
                `;
            } else {
                // Default button to go to the catalog
                showCatalogButton = false;
                actionButton = `
                    <button class="btn btn-primary" onclick="closeSection(); loadProductsOnMainPage(); document.getElementById('products-container').scrollIntoView({behavior: 'smooth'})" style="width: 100%;">
                        ${escapeHtml(p.buttonText || 'В каталог')}
                    </button>
                `;
            }

            const catalogButtonHtml = showCatalogButton ? `
                <button class="btn btn-secondary" onclick="closeSection(); loadProductsOnMainPage(); document.getElementById('products-container').scrollIntoView({behavior: 'smooth'})" style="width: 100%;">
                    В каталог
                </button>
            ` : '';

            html += `
                <div class="content-section" style="padding: 16px;">
                    ${imageHtml}
                    <h3 style="margin-top: 0; margin-bottom: 8px;">${escapeHtml(p.title)}</h3>
                    ${p.description ? `<div style="margin-bottom: 16px; color: #555;">${window.DOMPurify ? DOMPurify.sanitize(p.description, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span'], ALLOWED_ATTR: ['href', 'style', 'class'] }) : escapeHtml(p.description)}</div>` : ''}
                    <div style="display: flex; flex-direction: column;">
                        ${actionButton}
                        ${catalogButtonHtml}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;

    } catch (error) {
        console.error('Error loading promotions:', error);
        return `
            <div class="content-section">
                <h3>🎉 Акции и скидки</h3>
                <p>Не удалось загрузить акции. Попробуйте позже.</p>
            </div>
        `;
    }
}

function loadContactsContent() {
    return `
        <div class="content-section">
            <h3>📞 Контакты</h3>
            <div class="contacts-list">
                <div class="contact-item">
                    <strong>Email:</strong>
                    <a href="mailto:plazmations@gmail.com">plazmations@gmail.com</a>
                </div>
                <div class="contact-item">
                    <strong>Telegram:</strong>
                    <a href="https://t.me/iplasmanano" target="_blank">@iplasmanano</a>
                </div>
                <div class="contact-item">
                    <strong>ВКонтакте:</strong>
                    <a href="https://vk.com/iplazma" target="_blank">vk.com/iplazma</a>
                </div>
                <div class="contact-item">
                    <strong>Сертификаты:</strong>
                    <a href="http://iplazma.com/serfs" target="_blank">iplazma.com/serfs</a>
                </div>
                <div class="contact-item">
                    <strong>Instagram:</strong>
                    <a href="https://www.instagram.com/iplazmanano/" target="_blank">@iplazmanano</a>
                </div>
            </div>
            
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                <p>ИП Глухов Дмитрий Валерьевич</p>
                <p>ИНН 773127019548</p>
            </div>
        </div>
    `;
}

async function loadBalanceContent() {
    try {
        const [profileResp, topupResp] = await Promise.all([
            fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() }),
            fetch(`${API_BASE}/balance/topup-info`, { headers: getApiHeaders() })
        ]);
        const profile = await profileResp.json().catch(() => ({}));
        const topup = await topupResp.json().catch(() => ({}));
        const balance = Number(profile?.balance || 0) || 0;
        const text = String(topup?.text || '').trim();
        const safeText = text ? escapeHtml(text).replace(/\n/g, '<br>') : 'Реквизиты пополнения появятся позже.';

        return `
            <div class="content-section">
                <h3>💰 Баланс</h3>
                <div class="balance-display" style="margin-bottom: 16px;">
                    <span class="balance-label">Ваш баланс:</span>
                    <span class="balance-value">${formatPz(balance)}</span>
                </div>
                <button class="btn" onclick="openSection('partner')" style="width: 100%; margin-bottom: 16px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px;">
                    <span>⭐</span> <span>Партнёрский кабинет</span>
                </button>
                <div style="margin-bottom: 16px; padding: 14px; border: 1px solid var(--border-color); border-radius: 12px; background: #ffffff;">
                    <div style="font-weight: 800; margin-bottom: 8px;">Реквизиты пополнения</div>
                    <div style="color: #4b5563; font-size: 14px; line-height: 1.5;">${safeText}</div>
                </div>
                <div style="padding: 14px; border: 1px solid var(--border-color); border-radius: 12px; background: #ffffff;">
                    <div style="font-weight: 800; margin-bottom: 10px;">Загрузите чек</div>
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label for="balance-topup-amount">Сумма пополнения (₽)</label>
                        <input id="balance-topup-amount" type="number" min="10" step="1" class="delivery-input" placeholder="Например: 1000">
                    </div>
                    <div class="form-group" style="margin-bottom: 10px;">
                        <input id="balance-topup-receipt" type="file" accept="image/*" class="delivery-input">
                    </div>
                    <button class="btn" onclick="submitBalanceTopupReceipt()" style="width: 100%;">Отправить</button>
                    <div id="balance-topup-status" style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);"></div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading balance content:', error);
        return '<div class="error-message"><h3>Ошибка</h3><p>Не удалось загрузить баланс</p></div>';
    }
}

async function submitBalanceTopupReceipt() {
    try {
        const amountEl = document.getElementById('balance-topup-amount');
        const fileEl = document.getElementById('balance-topup-receipt');
        const statusEl = document.getElementById('balance-topup-status');
        const amount = Math.round(Number(amountEl?.value || 0));
        if (!Number.isFinite(amount) || amount <= 0) {
            showError('Введите сумму пополнения');
            return;
        }
        if (!fileEl || !fileEl.files || !fileEl.files[0]) {
            showError('Загрузите чек');
            return;
        }

        if (statusEl) statusEl.textContent = 'Отправляем чек...';
        const form = new FormData();
        form.append('amountRub', String(amount));
        form.append('receipt', fileEl.files[0]);

        const resp = await fetch(`${API_BASE}/balance/topup-receipt`, {
            method: 'POST',
            headers: { 'X-Telegram-User': JSON.stringify(getTelegramUserData()) },
            body: form
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.success) {
            throw new Error(data?.error || 'Ошибка отправки чека');
        }
        if (statusEl) statusEl.textContent = 'Чек отправлен. Мы проверим оплату и пополним баланс.';
        showSuccess('Чек отправлен');
        if (fileEl) fileEl.value = '';
    } catch (e) {
        console.error('Receipt submit error:', e);
        showError('Не удалось отправить чек');
    }
}

// Balance top-up dialog
function showBalanceTopUpDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'balance-topup-modal';
    dialog.innerHTML = `
        <div class="balance-topup-overlay" onclick="closeBalanceTopUpDialog()"></div>
        <div class="balance-topup-content">
            <div class="balance-topup-header">
                <h3>💰 Пополнить баланс</h3>
                <button class="balance-topup-close" onclick="closeBalanceTopUpDialog()">×</button>
            </div>
            <div class="balance-topup-body">
                <p style="margin-bottom: 12px; color: var(--text-secondary);">Введите сумму пополнения (₽):</p>
                <input type="number" id="topup-amount" class="delivery-input" min="10" step="10" placeholder="Например: 1000" style="margin-bottom: 12px;">
                <button class="btn" onclick="startBalanceTopUpFromWebapp()" style="width: 100%; margin-bottom: 12px;">
                    💳 Оплатить картой
                </button>
                <div id="topup-hint" style="font-size: 12px; color: var(--text-secondary); line-height: 1.35; margin-bottom: 10px;">
                  После оплаты баланс обновится автоматически.
                </div>
                <button class="btn btn-secondary" onclick="closeBalanceTopUpDialog()" style="width: 100%;">
                    Отмена
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('open'), 10);
}

function closeBalanceTopUpDialog() {
    const dialog = document.querySelector('.balance-topup-modal');
    if (dialog) {
        dialog.classList.remove('open');
        setTimeout(() => dialog.remove(), 300);
    }
}

function openBotForBalance() {
    // Открываем бота с командой пополнения баланса
    const botUsername = userData?.botUsername || 'PLAZMA_test8_bot';
    const botUrl = `https://t.me/${botUsername}?start=add_balance`;

    // Пытаемся открыть через Telegram WebApp
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(botUrl);
    } else {
        // Fallback: открываем в новом окне
        window.open(botUrl, '_blank');
    }

    closeBalanceTopUpDialog();
}

async function startBalanceTopUpFromWebapp() {
    try {
        const amountEl = document.getElementById('topup-amount');
        const raw = amountEl ? amountEl.value : '';
        const amount = Math.round(Number(raw || 0));
        if (!Number.isFinite(amount) || amount <= 0) {
            showError('Введите сумму пополнения');
            return;
        }
        if (amount < 10) {
            showError('Минимум 10 ₽');
            return;
        }

        const resp = await fetch(`${API_BASE}/balance/topup`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ amountRub: amount })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.success || !data?.paymentUrl) {
            throw new Error(data?.error || 'Не удалось создать ссылку на оплату');
        }

        const url = String(data.paymentUrl);
        if (window.Telegram?.WebApp?.openTelegramLink) {
            window.Telegram.WebApp.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
        closeBalanceTopUpDialog();
    } catch (e) {
        console.error('Topup error:', e);
        showError('Не удалось начать пополнение. Попробуйте позже.');
    }
}

// ===== Delivery cities autocomplete (RU) =====
// Lightweight list for typeahead. Can be replaced later with DB-backed city directory.
const RU_CITIES = [
    'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
    'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар', 'Саратов', 'Тюмень', 'Тольятти', 'Ижевск',
    'Барнаул', 'Ульяновск', 'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток', 'Махачкала', 'Томск', 'Оренбург', 'Кемерово',
    'Новокузнецк', 'Рязань', 'Астрахань', 'Набережные Челны', 'Пенза', 'Киров', 'Липецк', 'Чебоксары', 'Тула', 'Калининград',
    'Курск', 'Ставрополь', 'Севастополь', 'Сочи', 'Белгород', 'Улан-Удэ', 'Тверь', 'Магнитогорск', 'Иваново', 'Брянск',
    'Сургут', 'Владимир', 'Нижний Тагил', 'Архангельск', 'Чита', 'Калуга', 'Смоленск', 'Волжский', 'Череповец', 'Орёл',
    'Вологда', 'Саранск', 'Мурманск', 'Якутск', 'Тамбов', 'Стерлитамак', 'Грозный', 'Кострома', 'Новороссийск', 'Петрозаводск',
    'Таганрог', 'Нальчик', 'Бийск', 'Комсомольск-на-Амуре', 'Нижневартовск', 'Сыктывкар', 'Шахты', 'Дзержинск', 'Орск', 'Ангарск'
];

function normalizeCityQuery(q) {
    return String(q || '').trim().toLowerCase();
}

function pickCitySuggestions(q, limit = 8) {
    const query = normalizeCityQuery(q);
    if (!query) return [];
    const starts = [];
    const contains = [];
    for (const c of RU_CITIES) {
        const lc = c.toLowerCase();
        if (lc.startsWith(query)) starts.push(c);
        else if (lc.includes(query)) contains.push(c);
        if (starts.length >= limit) break;
    }
    const out = starts.concat(contains).slice(0, limit);
    return out;
}

function renderCitySuggestions(inputEl) {
    const wrap = document.getElementById('delivery-city-suggest');
    if (!wrap || !inputEl) return;
    const q = inputEl.value || '';
    const items = pickCitySuggestions(q, 8);
    if (!items.length) {
        wrap.style.display = 'none';
        wrap.innerHTML = '';
        return;
    }
    wrap.innerHTML = items.map(c => `<button type="button" class="city-suggest-item" data-city="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join('');
    wrap.style.display = 'block';
    wrap.querySelectorAll('button.city-suggest-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const city = btn.getAttribute('data-city') || '';
            inputEl.value = city;
            wrap.style.display = 'none';
            wrap.innerHTML = '';
        });
    });
}

function hideCitySuggestions() {
    const wrap = document.getElementById('delivery-city-suggest');
    if (!wrap) return;
    wrap.style.display = 'none';
    wrap.innerHTML = '';
}

function updateBalanceAffordability() {
    const root = document.getElementById('delivery-form-root');
    const cb = document.getElementById('pay-from-balance');
    const note = document.getElementById('balance-topup-note');
    const topupBtn = document.getElementById('topup-btn');
    if (!root || !cb || !note) return;

    const balanceRub = Number(root.getAttribute('data-balance-rub') || '0');
    const grandText = document.getElementById('checkout-grand-total')?.textContent || '0';
    const grandRub = Number(String(grandText).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;

    const shortfall = grandRub - balanceRub;
    if (shortfall > 0.5) {
        cb.checked = false;
        cb.disabled = true;
        note.style.display = 'block';
        note.innerHTML = `
          <div style="margin-top:6px; font-size: 13px; color: var(--text-secondary);">
            Недостаточно средств: не хватает <strong>${Math.ceil(shortfall)} ₽</strong>. Нужно пополнить счёт.
          </div>
        `;
        if (topupBtn) topupBtn.style.display = 'block';
    } else {
        cb.disabled = false;
        note.style.display = 'none';
        note.innerHTML = '';
        if (topupBtn) topupBtn.style.display = 'none';
    }
}

let _checkoutCerts = [];
let _checkoutActiveCertRub = 0;
let _checkoutActiveCertCode = null;

async function checkCheckoutCert() {
    const sel = document.getElementById('checkout-cert-select');
    const inp = document.getElementById('checkout-cert-input');
    const msg = document.getElementById('checkout-cert-msg');
    let code = (sel && sel.value) ? sel.value : (inp ? inp.value.trim() : '');

    if (!code) {
        _checkoutActiveCertRub = 0;
        _checkoutActiveCertCode = null;
        if (msg) msg.textContent = '';
        updateCheckoutTotals();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/certificates/validate`, {
            method: 'POST',
            headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.success) {
            _checkoutActiveCertRub = data.amountRub;
            _checkoutActiveCertCode = code;
            if (msg) {
                msg.textContent = `Сертификат на ${data.amountRub.toLocaleString('ru-RU')} ₽ применён!`;
                msg.style.color = 'var(--success-color)';
            }
        } else {
            _checkoutActiveCertRub = 0;
            _checkoutActiveCertCode = null;
            if (msg) {
                msg.textContent = data.error || 'Ошибка проверки';
                msg.style.color = '#ef4444';
            }
        }
    } catch (e) {
        _checkoutActiveCertRub = 0;
        _checkoutActiveCertCode = null;
    }
    updateCheckoutTotals();
}


window.selectCheckoutCert = function (el, code) {
    const cards = document.querySelectorAll('.checkout-cert-card');
    const hiddenSel = document.getElementById('checkout-cert-select');
    const inp = document.getElementById('checkout-cert-input');

    // Toggle: if already selected, deselect
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        if (hiddenSel) hiddenSel.value = '';
        checkCheckoutCert();
        return;
    }

    cards.forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    if (hiddenSel) hiddenSel.value = code;
    if (inp) inp.value = '';
    checkCheckoutCert();
};

const debounceCheckoutCert = debounce(checkCheckoutCert, 500);

function updateCheckoutTotals() {
    const root = document.getElementById('delivery-form-root');
    if (!root) return;
    const baseTotalRub = Number(root.dataset.itemsRub) || 0;
    const userBalanceRub = Number(root.dataset.balanceRub) || 0;

    const certVal = _checkoutActiveCertRub || 0;
    let remainder = Math.max(0, baseTotalRub - certVal);

    const cb = document.getElementById('pay-from-balance');
    const details = document.getElementById('balance-payment-details');

    if (cb && cb.checked) {
        const canPay = Math.min(userBalanceRub, remainder);
        remainder = remainder - canPay;
        if (details) {
            details.style.display = 'block';
            if (remainder > 0) {
                details.innerHTML = `С баланса: <strong>${canPay.toFixed(0)} ₽</strong>.<br>Доплатить: <strong>${remainder.toFixed(0)} ₽</strong>.`;
            } else {
                details.innerHTML = `Оплачено с баланса.`;
            }
        }
    } else if (details) {
        details.style.display = 'none';
    }

    const totalLabel = document.getElementById('checkout-grand-total');
    if (totalLabel) totalLabel.textContent = `${remainder.toFixed(0)} ₽`;
}

// Показать форму доставки
function showDeliveryForm(items, totalRub, userBalance) {
    Promise.all([
        fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() }).then(res => res.ok ? res.json() : {}),
        fetch(`${API_BASE}/certificates/my`, { headers: getApiHeaders() }).then(res => res.ok ? res.json() : { certificates: [] })
    ])
        .then(([userData, certData]) => {
            const userBalanceRub = Number(userBalance || 0) * 100;
            const isPartner = !!userData.isPartner;

            _checkoutCerts = Array.isArray(certData?.certificates) ? certData.certificates : [];
            _checkoutActiveCertRub = 0;
            _checkoutActiveCertCode = null;

            // Расчет скидки
            let discountRub = 0;
            if (isPartner) {
                discountRub = totalRub * 0.1;
            }
            const finalTotalRub = totalRub - discountRub;

            const dialog = document.createElement('div');
            dialog.className = 'delivery-form-modal';
            dialog.innerHTML = `
                <div class="delivery-form-overlay" onclick="closeDeliveryForm()"></div>
                <div class="delivery-form-content" id="delivery-form-root" data-balance-rub="${userBalanceRub}" data-items-rub="${Number(finalTotalRub || 0)}">
                    <div class="delivery-form-header">
                        <h3>📦 Оформление заказа</h3>
                        <button class="delivery-form-close" onclick="closeDeliveryForm()">×</button>
                    </div>
                    <div class="delivery-form-body">
                        <div style="margin-bottom: 20px; padding: 16px; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>💰 Ваш баланс:</span>
                                <strong>${Number(userBalance || 0).toFixed(2)} PZ (${userBalanceRub.toFixed(0)} ₽)</strong>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between;">
                                <span>📦 Сумма заказа:</span>
                                <strong>${Number(totalRub || 0).toFixed(0)} ₽</strong>
                            </div>
                            
                            ${isPartner ? `
                            <div style="display: flex; justify-content: space-between; color: var(--success-color);">
                                <span>🌟 Скидка партнера (-10%):</span>
                                <strong>-${discountRub.toFixed(0)} ₽</strong>
                            </div>` : ''}

                            <div style="border-top: 1px solid var(--border-color); margin: 8px 0;"></div>

                            <div style="display: flex; justify-content: space-between; font-size: 16px;">
                                <span>Итого к оплате:</span>
                                <strong id="checkout-grand-total">${finalTotalRub.toFixed(0)} ₽</strong>
                            </div>
                        </div>

                        <div style="margin-bottom: 20px; padding: 12px; background: rgba(52, 199, 89, 0.1); border: 1px solid var(--success-color); border-radius: 8px; color: var(--success-color); font-size: 14px; line-height: 1.4; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">🚚</span>
                            <b>Бесплатная доставка по России при заказе от 15 000 ₽</b>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">🎁 Подарочный сертификат</label>
                            ${_checkoutCerts.length > 0 ? `
                            <div id="checkout-cert-cards" class="checkout-cert-cards">
                                ` + _checkoutCerts.map(c => {
                const amt = Math.round(Number(c.amountRub || c.remainingRub || 0));
                return `<div class="checkout-cert-card" data-code="${escapeAttr(c.code)}" onclick="selectCheckoutCert(this, '${escapeAttr(c.code)}')">
                    <div class="checkout-cert-card-check">✓</div>
                    <div class="checkout-cert-card-amount">${amt.toLocaleString('ru-RU')} ₽</div>
                    <div class="checkout-cert-card-code">${escapeHtml(c.code)}</div>
                </div>`;
            }).join('') + `
                            </div>
                            ` : ''}
                            <input type="text" id="checkout-cert-input" class="delivery-input" placeholder="Или введите код сертификата" autocomplete="off" oninput="debounceCheckoutCert()">
                            <div id="checkout-cert-msg" style="font-size:13px; margin-top:6px; font-weight:600;"></div>
                            <input type="hidden" id="checkout-cert-select" value="">
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Город *</label>
                            <div style="position: relative;">
                              <input type="text" id="delivery-city" class="delivery-input" placeholder="Например: Санкт-Петербург" value="${userData.city || ''}" autocomplete="off" required>
                              <div id="delivery-city-suggest" class="city-suggest" style="display:none;"></div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Телефон *</label>
                            <input type="tel" id="delivery-phone" class="delivery-input" placeholder="+7 (999) 123-45-67" value="${userData.phone || ''}" required>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Адрес доставки *</label>
                            <textarea id="delivery-address" class="delivery-textarea" placeholder="Город, улица, дом, квартира" rows="3" required>${userData.deliveryAddress || ''}</textarea>
                        </div>

                        <div style="margin-bottom: 16px;">
                          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                              <input type="checkbox" id="pay-from-balance" onchange="updateCheckoutTotals()">
                              <span>Оплатить с баланса</span>
                          </label>
                          <div id="balance-payment-details" style="display:none; margin-top: 8px; font-size: 13px; color: var(--text-secondary); padding-left: 24px;"></div>
                        </div>

                        <div style="margin-bottom: 20px;">
                          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size: 13px; line-height: 1.4; color: var(--text-secondary);">
                              <input type="checkbox" id="privacy-policy-agree" style="margin-top: 3px;" checked required>
                              <span>
                                  Я согласен с <a href="http://iplazma.com/privacy" target="_blank" onclick="event.stopPropagation()" style="text-decoration: underline; color: var(--text-primary);">Политикой конфиденциальности</a> и <a href="http://iplazma.com/oferta" target="_blank" onclick="event.stopPropagation()" style="text-decoration: underline; color: var(--text-primary);">Офертой</a>
                              </span>
                          </label>
                        </div>
                        
                        <button class="btn" onclick="submitDeliveryForm(${JSON.stringify(items).replace(/"/g, '&quot;')}, ${Number(finalTotalRub || 0)}, ${Number(userBalance || 0)})" style="width: 100%;">
                            Оформить заказ
                        </button>
                        <button class="btn btn-secondary" onclick="closeDeliveryForm()" style="width: 100%; margin-top: 12px;">
                            Отмена
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            setTimeout(() => dialog.classList.add('open'), 10);

            // Город: подсказки по вводу
            const cityInput = document.getElementById('delivery-city');
            if (cityInput) {
                cityInput.addEventListener('input', () => renderCitySuggestions(cityInput));
                cityInput.addEventListener('blur', () => setTimeout(hideCitySuggestions, 150));
                cityInput.addEventListener('focus', () => renderCitySuggestions(cityInput));
            }
            // Инициализируем UI баланса
            const cb = document.getElementById('pay-from-balance');
            if (cb && userBalanceRub <= 0) {
                cb.disabled = true;
                const details = document.getElementById('balance-payment-details');
                if (details) {
                    details.style.display = 'block';
                    details.innerHTML = 'На балансе нет средств для списания.';
                    details.style.color = 'var(--text-secondary)';
                }
            }
        })
        .catch(error => {
            console.error('Error loading user data:', error);
            showError('Ошибка загрузки данных пользователя');
        });
}

// Replaced by updateCheckoutTotals

function debounce(fn, wait) {
    let t = null;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// delivery totals removed (checkout is "fill address and order"; delivery method selection is not used in client)

function closeDeliveryForm() {
    const dialog = document.querySelector('.delivery-form-modal');
    if (dialog) {
        dialog.classList.remove('open');
        setTimeout(() => dialog.remove(), 300);
    }
}

function openBalanceFromCheckout() {
    closeDeliveryForm();
    setTimeout(() => openSection('balance'), 220);
}

async function submitDeliveryForm(items, finalTotalRub, userBalance) {
    const phone = document.getElementById('delivery-phone')?.value?.trim();
    const city = document.getElementById('delivery-city')?.value?.trim();
    const address = document.getElementById('delivery-address')?.value?.trim();
    const payFromBalanceCb = document.getElementById('pay-from-balance');
    const payFromBalance = payFromBalanceCb?.checked || false;
    const certificateCode = _checkoutActiveCertCode;
    const privacyAgreed = document.getElementById('privacy-policy-agree')?.checked;

    if (!privacyAgreed) {
        showError('Пожалуйста, подтвердите согласие с Политикой конфиденциальности и Офертой');
        return;
    }

    if (!phone) {
        showError('Укажите номер телефона');
        return;
    }

    if (!city) {
        showError('Укажите город');
        return;
    }

    if (!address) {
        showError('Укажите адрес доставки');
        return;
    }

    // Сохраняем телефон и адрес
    try {
        await fetch(`${API_BASE}/user/profile`, {
            method: 'PUT',
            headers: getApiHeaders(),
            body: JSON.stringify({ phone, city, deliveryAddress: address })
        });
    } catch (error) {
        console.error('Error saving user data:', error);
    }

    const finalTotalPz = finalTotalRub / 100; // ₽→PZ
    const userBalanceRub = Number(userBalance || 0) * 100;

    // Оплата с баланса (если выбрана)
    if (payFromBalance) {
        const canPayRub = Math.min(userBalanceRub, finalTotalRub);
        const canPayPz = canPayRub / 100;

        if (canPayRub <= 0) {
            showError('Нет средств на балансе для списания');
            return;
        }

        const deliveryLine = `Город: ${city}\nАдрес: ${address}`;
        // Передаем частичную сумму, если не хватает на полную
        // Если хватает - partialAmount будет равен total (или чуть больше, но min обрежет)
        // Логика processOrderWithBalance должна корректно обработать
        const isPartial = canPayRub < finalTotalRub;

        await processOrderWithBalance(items, finalTotalPz, canPayPz, phone, deliveryLine, certificateCode);
        closeDeliveryForm();
        return;
    }

    // Без онлайн-оплаты: просто создаем заказ администратору
    const deliveryLine = `Город: ${city}\nАдрес: ${address}`;
    await processOrderNormal(items, phone, deliveryLine, certificateCode);

    closeDeliveryForm();
}

// Utility functions
async function loadUserData() {
    try {
        const response = await fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() });
        if (response.ok) {
            userData = await response.json();
        } else if (response.status === 401) {
            console.log('User not authenticated - this is normal for web preview');
            userData = null;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        userData = null;
    }
}

async function loadCartItems() {
    try {
        console.log('🛒 Loading cart items...');
        const response = await fetch(`${API_BASE}/cart/items`, { headers: getApiHeaders() });
        if (response.ok) {
            cartItems = await response.json();
            console.log('✅ Cart items loaded:', Array.isArray(cartItems) ? cartItems.length : 'not an array');

            if (!Array.isArray(cartItems)) {
                console.warn('⚠️ valid cart items response is not an array:', cartItems);
                cartItems = [];
            }

            // Фильтруем валидные товары
            cartItems = cartItems.filter(item => item && item.product && item.product.isActive);
        } else if (response.status === 401) {
            console.log('User not authenticated - this is normal for web preview');
            cartItems = [];
        } else {
            console.error('Failed to load cart items:', response.status);
            cartItems = [];
        }

        // Обновляем счетчик корзины после загрузки
        updateCartBadge();
        console.log(`🛒 Cart items: ${cartItems.length} items`);
    } catch (error) {
        console.error('Error loading cart items:', error);
        if (error && error.message) {
            console.error('Cart load error details:', error.message);
        }
        cartItems = [];
        updateCartBadge();
        console.log('🛒 Cart items: 0 items (error)');
    }
}

// Load product count for shop badge
async function loadProductCount() {
    try {
        console.log('📦 Loading product count...');
        const response = await fetch(`${API_BASE}/products/count`, { headers: getApiHeaders() });
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Product count data:', data);
            const shopBadge = document.getElementById('shop-badge');
            if (shopBadge) {
                shopBadge.textContent = data.totalProducts || '0';
                console.log(`📦 Shop badge updated: ${data.totalProducts || '0'} products`);
            } else {
                console.log('❌ Shop badge element not found');
            }
        } else {
            console.error('❌ Failed to load product count:', response.status);
        }
    } catch (error) {
        console.error('❌ Error loading product count:', error);
    }
}

// Load reviews count for reviews badge
async function loadReviewsCount() {
    try {
        const response = await fetch(`${API_BASE}/reviews/count`, { headers: getApiHeaders() });
        if (response.ok) {
            const data = await response.json();
            const reviewsBadge = document.getElementById('reviews-badge');
            if (reviewsBadge) {
                reviewsBadge.textContent = data.totalReviews || '0';
            }
        }
    } catch (error) {
        console.error('Error loading reviews count:', error);
    }
}

function updateCartBadge() {
    try {
        // Calculate total quantity of items in cart
        let totalQuantity = 0;
        if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
            totalQuantity = cartItems.reduce((sum, item) => {
                // Пропускаем товары без продукта
                if (!item.product || !item.product.isActive) {
                    return sum;
                }
                return sum + (item.quantity || 1);
            }, 0);
        }

        // Update cart badge with item count
        const cartBadge = document.querySelector('.cart-badge');
        if (cartBadge) {
            if (totalQuantity > 0) {
                cartBadge.textContent = totalQuantity.toString();
                cartBadge.style.display = 'grid';
                cartBadge.classList.add('animate');
                setTimeout(() => cartBadge.classList.remove('animate'), 300);
            } else {
                cartBadge.textContent = '0';
                cartBadge.style.display = 'none';
            }
        } else {
            console.warn('⚠️ Cart badge element not found');
        }

        console.log(`🛒 Cart badge updated: ${totalQuantity} items`);
    } catch (error) {
        console.error('Error updating cart badge:', error);
    }
}

// Принудительное обновление счетчика корзины
async function refreshCartBadge() {
    try {
        await loadCartItems();
        updateCartBadge();
    } catch (error) {
        console.error('Error refreshing cart badge:', error);
    }
}

// Оптимистичное увеличение счетчика корзины (до загрузки данных)
function incrementCartBadge(delta = 1) {
    try {
        const cartBadge = document.querySelector('.cart-badge');
        if (cartBadge) {
            const currentCount = parseInt(cartBadge.textContent) || 0;
            const newCount = currentCount + (Number(delta) || 1);
            cartBadge.textContent = newCount.toString();
            cartBadge.style.display = 'grid';
            cartBadge.classList.add('animate');
            setTimeout(() => cartBadge.classList.remove('animate'), 300);
            console.log(`🛒 Cart badge incremented: ${newCount}`);
        }
    } catch (error) {
        console.error('Error incrementing cart badge:', error);
    }
}

function updateBadges() {
    // Update shop badge with total products count (not cart sum)
    loadProductCount();

    // Update reviews badge with total reviews count
    loadReviewsCount();

    // Update other badges based on data
    // This would be populated from actual data
}

function showSuccess(message) {
    // Show success message (could be a toast notification)
    console.log('Success:', message);
    if (tg) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

function showError(message) {
    // Show error message (could be a toast notification)
    console.log('Error:', message);
    if (tg) {
        tg.showAlert(message);
    } else {
        alert(message);
    }

    // Close any open sections on error
    if (currentSection) {
        closeSection();
    }
}

// Search functionality
const searchInput = document.querySelector('.search-input');
if (searchInput) {
    searchInput.addEventListener('input', function (e) {
        const query = e.target.value.toLowerCase();
        if (query.length > 2) {
            // Implement search logic here
            console.log('Searching for:', query);
        }
    });
}

// Keyboard navigation
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && currentSection) {
        closeSection();
    }
});

// Handle back button
window.addEventListener('popstate', function (e) {
    if (currentSection) {
        closeSection();
    }
});

// Show product details function
let _productDetailQty = 1;
let _productDetailId = null;

function getProductDetailQty() {
    return Number(_productDetailQty) || 1;
}

function setProductDetailQty(nextQty) {
    const q = Math.max(1, Math.min(99, Number(nextQty) || 1));
    _productDetailQty = q;
    const el = document.getElementById('product-detail-qty');
    if (el) el.textContent = String(q);
}

function changeProductDetailQty(delta) {
    setProductDetailQty(getProductDetailQty() + (Number(delta) || 0));
}

function resetProductDetailQty(productId) {
    _productDetailId = productId;
    setProductDetailQty(1);
}

function formatDescription(text) {
    if (!text) return '';
    // 1. Escape HTML
    let safeText = escapeHtml(text);
    // 2. Linkify URLs
    safeText = safeText.replace(
        /((https?:\/\/)|(www\.))[^\s]+/gi,
        (url) => {
            let href = url;
            if (!href.startsWith('http')) href = 'http://' + href;
            return `<a href="${href}" target="_blank" style="text-decoration:underline; color:var(--text-primary);">${url}</a>`;
        }
    );
    // 3. Newlines to <br>
    return safeText.replace(/\n/g, '<br>');
}

async function showProductDetails(productId) {
    try {
        console.log('📖 Showing product details for:', productId);

        let product = null;

        // Fetch fresh data from API to ensure accuracy (price, description)
        const response = await fetch(`${API_BASE}/products/${productId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch product details');
        }
        product = await response.json();

        if (!product) {
            throw new Error('Product not found');
        }
        resetProductDetailQty(product.id);

        // Calculate prices
        const priceRub = pzToRub(product.price);
        const pricePz = Math.round(product.price);

        // Create detailed product view
        let content = `
            <div class="product-details">
                <div class="product-details-header">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                        <h2 style="margin:0;">${cleanProductTitle(product.title)}</h2>
                        ${renderFavoriteButton(product.id)}
                    </div>
                </div>
                
                <div class="product-details-content">
                    ${product.imageUrl ? `<div class="product-details-image"><img src="${product.imageUrl}" alt="${product.title}" onerror="this.style.display='none'"></div>` : ''}
                    
                    <div class="product-details-info">
                        
                        <!-- Price and Buy Row -->
                        <div class="product-price-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding: 12px; background: var(--bg-secondary); border-radius: 12px;">
                            <div class="price-block" style="display: flex; flex-direction: column;">
                                <div class="price-rub" style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">
                                    💰 Цена: ${priceRub} ₽
                                </div>
                                <div class="price-pz" style="font-size: 14px; color: var(--text-secondary); font-weight: 500;">
                                    ${pricePz} PZ
                                </div>
                            </div>

                            <button class="btn-buy-inline" onclick="addToCart('${product.id}', getProductDetailQty())" 
                                style="background: var(--button-bg); color: var(--button-text); border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer;">
                                🛒 В корзину
                            </button>
                        </div>

                        <!-- Quantity Selector (Optional - keeping it clean, or could move above) -->
                        <div class="qty-control-wrapper" style="margin-bottom: 20px;">
                             <div class="qty-control" aria-label="Количество" style="width: 100%; justify-content: center;">
                                <button class="qty-btn" type="button" aria-label="Уменьшить" onclick="changeProductDetailQty(-1)">−</button>
                                <div class="qty-value" id="product-detail-qty">1</div>
                                <button class="qty-btn" type="button" aria-label="Увеличить" onclick="changeProductDetailQty(1)">+</button>
                            </div>
                        </div>

                        ${extractProductWeight(product.summary).weight ? `<div class="product-weight-badge-large" style="margin-bottom: 16px;">${extractProductWeight(product.summary).weight}</div>` : ''}
                        
                        ${product.summary ? `<div class="product-summary"><h4>Краткое описание:</h4><p>${formatDescription(product.summary)}</p></div>` : ''}
                        
                        ${product.description ? `<div class="product-description-full"><h4>Подробное описание:</h4><div class="rich-text-content">${window.DOMPurify ? DOMPurify.sanitize(product.description, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span'], ALLOWED_ATTR: ['href', 'style', 'class'] }) : escapeHtml(product.description)}</div></div>` : ''}
                        
                        ${product.instruction ? `<div class="product-instruction"><h4>📋 Инструкция по применению:</h4><div class="rich-text-content">${window.DOMPurify ? DOMPurify.sanitize(product.instruction, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span'], ALLOWED_ATTR: ['href', 'style', 'class'] }) : escapeHtml(product.instruction)}</div></div>` : ''}
                    </div>
                </div>
            </div>
        `;

        // Show the product details section
        showProductsSection(content);

    } catch (error) {
        console.error('Error loading product details:', error);
        showError('Ошибка загрузки подробной информации о товаре');
    }
}



function showQrCode(url) {
    if (!url || url === 'undefined' || url === 'null') {
        showError('QR-код еще не сгенерирован. Пожалуйста, запросите ссылку в боте (/partner).');
        return;
    }

    // Create modal to show QR
    const modal = document.createElement('div');
    modal.className = 'instruction-modal';
    modal.innerHTML = `
        <div class="instruction-overlay" onclick="this.parentElement.remove()">
            <div class="instruction-content" onclick="event.stopPropagation()" style="text-align: center;">
                <div class="instruction-header">
                    <h3>📱 Ваш QR-код</h3>
                    <button class="btn-close" onclick="this.closest('.instruction-modal').remove()">×</button>
                </div>
                <div class="instruction-body">
                    <img src="${escapeAttr(url)}" alt="QR Code" style="max-width: 100%; border-radius: 12px; margin-bottom: 12px;">
                    <p style="color: var(--text-secondary);">Покажите этот код для сканирования</p>
                </div>
                <div class="instruction-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.instruction-modal').remove()">Закрыть</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Animation
    setTimeout(() => {
        const content = modal.querySelector('.instruction-content');
        if (content) content.style.transform = 'scale(1)';
    }, 10);
}

// Safe wrapper for getting telegram user data
function getTelegramUserDataSafe() {
    try {
        if (typeof getTelegramUserData === 'function') {
            return getTelegramUserData();
        }
        return null;
    } catch (e) {
        console.warn('Failed to get telegram user data:', e);
        return null;
    }
}

// ------------------------------------------------------------------
// Dynamic Regions
// ------------------------------------------------------------------

let REGIONS_CACHE = null;
let SELECTED_REGION = null;

async function loadRegions() {
    try {
        const response = await fetch(`${API_BASE}/regions`, { headers: getApiHeaders() });
        if (!response.ok) {
            console.warn('Failed to load regions:', response.status);
            return;
        }
        const regions = await response.json();
        REGIONS_CACHE = Array.isArray(regions) ? regions.filter(r => r.isActive) : [];
        console.log(`✅ Loaded ${REGIONS_CACHE.length} regions`);

        // Get user's current región
        const userRes = await fetch(`${API_BASE}/user/profile`, { headers: getApiHeaders() }).catch(() => ({ ok: false }));
        if (userRes.ok) {
            const user = await userRes.json();
            SELECTED_REGION = user.selectedRegion || 'RUSSIA';
        }

        renderRegionButtons();

        // Ensure RUSSIA is default if nothing selected
        let currentRegion = localStorage.getItem('selectedRegion');
        if (!currentRegion) {
            currentRegion = 'RUSSIA';
            localStorage.setItem('selectedRegion', 'RUSSIA');
        }

        // Render as Select Dropdown
        container.innerHTML = `
            <div style="padding: 0 16px;">
                <label style="display:block; margin-bottom:8px; font-weight:600; color:var(--text-primary); font-size:14px;">
                    Ваш регион
                </label>
                <div class="select-wrapper" style="position:relative;">
                    <select id="region-select" onchange="selectRegion(this.value)" 
                        style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 16px; appearance: none; -webkit-appearance: none;">
                        <option value="" disabled>Выберите регион</option>
                        ${regions.map(r => `
                            <option value="${r.code}" ${r.code === currentRegion ? 'selected' : ''}>
                                ${r.name}
                            </option>
                        `).join('')}
                    </select>
                    <div style="position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--text-secondary);">
                        ▼
                    </div>
                </div>
            </div>
        `;

        // Update global state
        selectedRegion = currentRegion;
        updateRegionUI(selectedRegion);

    } catch (error) {
        console.error('Error loading regions:', error);
    }

    innerDiv.innerHTML = html;
}

function openRegionModal() {
    if (!REGIONS_CACHE) return;

    const modal = document.getElementById('region-modal');
    const modalBody = document.getElementById('region-modal-body');
    if (!modal || !modalBody) return;

    const otherRegions = REGIONS_CACHE.filter(r => r.code !== 'BALI');

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    otherRegions.forEach(region => {
        const isSelected = SELECTED_REGION === region.code;
        html += `
            <button class="btn ${isSelected ? '' : 'btn-secondary'}" onclick="selectRegion('${region.code}')" style="width: 100%;">
                ${isSelected ? '✓ ' : ''}${region.name}
            </button>
        `;
    });
    html += '</div>';

    modalBody.innerHTML = html;
    modal.style.display = 'flex';
}

function closeRegionModal() {
    const modal = document.getElementById('region-modal');
    if (modal) modal.style.display = 'none';
}

async function selectRegion(regionCode) {
    try {
        console.log('Selecting region:', regionCode);

        const response = await fetch(`${API_BASE}/user/profile`, {
            method: 'PUT',
            headers: {
                ...getApiHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ selectedRegion: regionCode })
        });

        if (!response.ok) {
            throw new Error('Failed to update region');
        }

        SELECTED_REGION = regionCode;
        renderRegionButtons();
        closeRegionModal();

        // Show success message
        if (tg && tg.showPopup) {
            const regionName = REGIONS_CACHE?.find(r => r.code === regionCode)?.name || regionCode;
            tg.showPopup({ message: `Регион изменён на: ${regionName}` });
        }
    } catch (error) {
        console.error('Error selecting region:', error);
        showError('Ошибка при изменении региона');
    }
}

