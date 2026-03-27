import express from 'express';

// Shared UI styles for the web admin
export const ADMIN_UI_CSS = `
  :root{
    --admin-bg: #f5f6fb;
    --admin-surface: #ffffff;
    --admin-text: #111827;
    --admin-muted: #6b7280;
    --admin-border: rgba(17,24,39,0.12);
    --admin-border-strong: rgba(17,24,39,0.18);
    --admin-primary: #111827;
    --admin-danger: #dc2626;
    --admin-radius: 12px;
    --admin-shadow: 0 2px 10px rgba(0,0,0,0.10);
  }

  /* Base */
  body{
    color: var(--admin-text);
    background: var(--admin-bg);
  }
  a{ color: inherit; }
  *:focus{ outline: none; }
  :focus-visible{
    outline: 3px solid rgba(102,126,234,0.35);
    outline-offset: 2px;
  }

  /* Layout */
  .admin-shell{
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px 1fr;
  }
  .admin-sidebar{
    position: sticky;
    top: 0;
    height: 100vh;
    background: var(--admin-surface);
    border-right: 1px solid var(--admin-border);
    padding: 18px 14px;
    overflow: auto;
  }
  .admin-brand{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 18px 10px;
    font-weight: 800;
    letter-spacing: -0.02em;
    font-size: 18px;
  }
  .admin-brand-mark{
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border: 1px solid var(--admin-border-strong);
    background: #fff;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .admin-nav-group{
    margin-top: 14px;
    padding: 10px 10px 6px 10px;
    font-size: 11px;
    color: var(--admin-muted);
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .admin-nav{
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 6px 10px 6px;
  }
  .admin-nav-item{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px;
    border-radius: 12px;
    text-decoration: none;
    border: 1px solid transparent;
    color: var(--admin-text);
  }
  .admin-nav-item:hover{
    background: rgba(17,24,39,0.04);
    border-color: var(--admin-border);
  }
  .admin-nav-item.active{
    background: rgba(17,24,39,0.06);
    border-color: var(--admin-border-strong);
  }
  .admin-ico{
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 18px;
    color: rgba(17,24,39,0.85);
  }
  .admin-ico svg{
    width: 18px;
    height: 18px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .admin-main{
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .admin-topbar{
    display:flex;
    align-items:center;
    justify-content: space-between;
    padding: 18px 22px;
    border-bottom: 1px solid var(--admin-border);
    background: rgba(245,246,251,0.75);
    backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .admin-topbar h1{
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.02em;
  }
  .admin-build{
    color: var(--admin-muted);
    font-size: 12px;
  }
  .admin-content{
    padding: 22px;
    max-width: 1400px;
    width: 100%;
    box-sizing: border-box;
  }
  @media (max-width: 980px){
    .admin-shell{ grid-template-columns: 1fr; }
    .admin-sidebar{ position: relative; height: auto; }
  }

  /* Buttons */
  a.btn, button.btn, .btn{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid var(--admin-border-strong);
    text-decoration: none;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease;
    box-shadow: none;
    background: transparent;
    color: var(--admin-text);
  }
  a.btn:hover, button.btn:hover, .btn:hover{
    transform: none;
    box-shadow: none;
    background: var(--admin-text);
    color: #fff;
  }
  a.btn:active, button.btn:active, .btn:active{
    transform: none;
  }
  .btn-secondary{
    background: transparent;
    color: var(--admin-text);
  }
  .btn-danger{
    background: var(--admin-danger);
    border-color: var(--admin-danger);
    color: #fff;
  }
  .btn-success{
    background: var(--admin-text);
    color: #fff;
  }
  button:disabled, .btn[aria-disabled="true"]{
    opacity: .6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Compact action buttons (tables, toolbars) */
  .action-btn{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 8px;
    border: 0;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
    line-height: 1;
    background: transparent;
    color: var(--admin-text);
    border: 1px solid var(--admin-border);
    box-shadow: none;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease;
    text-decoration: none;
  }
  .action-btn:hover{
    background: var(--admin-text);
    color: #fff;
    transform: none;
    box-shadow: none;
  }

  /* Inputs */
  input, select, textarea{
    font: inherit;
  }
  input[type="text"], input[type="password"], input[type="number"], select, textarea{
    border-radius: 10px;
    border: 1px solid var(--admin-border-strong);
    background: var(--admin-surface);
  }

  /* Modals (Dribbble-like) */
  .admin-shell .modal-overlay,
  .admin-shell .modal{
    position: fixed !important;
    inset: 0 !important;
    display: none;
    align-items: center !important;
    justify-content: center !important;
    padding: 22px !important;
    background: rgba(17,24,39,0.45) !important;
    backdrop-filter: blur(10px) !important;
    z-index: 12000 !important;
  }
  .admin-shell .modal-overlay[style*="display: flex"],
  .admin-shell .modal[style*="display: block"],
  .admin-shell .modal[style*="display:block"],
  .admin-shell .modal[style*="display: flex"]{
    display: flex !important;
  }
  .admin-shell .modal-content{
    background: #fff !important;
    border-radius: 26px !important;
    border: 1px solid rgba(255,255,255,0.75) !important;
    box-shadow: 0 35px 80px rgba(17,24,39,0.25) !important;
    width: min(920px, 96vw) !important;
    max-height: min(86vh, 980px) !important;
    overflow: hidden !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    transform: translateY(6px);
    animation: adminModalIn .18s ease-out forwards;
  }
  @keyframes adminModalIn{
    from{ opacity:0; transform: translateY(12px) scale(.98); }
    to{ opacity:1; transform: translateY(0) scale(1); }
  }
  .admin-shell .modal-header{
    background: transparent !important;
    color: var(--admin-text) !important;
    border-bottom: 1px solid var(--admin-border) !important;
    padding: 18px 20px !important;
    display:flex !important;
    align-items:center !important;
    justify-content: space-between !important;
    gap: 12px !important;
  }
  .admin-shell .modal-header h2,
  .admin-shell .modal-header h3{
    margin: 0 !important;
    font-size: 22px !important;
    font-weight: 800 !important;
    letter-spacing: -0.02em !important;
    color: var(--admin-text) !important;
    text-shadow: none !important;
  }
  .admin-shell .close-btn,
  .admin-shell .close{
    width: 44px !important;
    height: 44px !important;
    border-radius: 14px !important;
    border: 1px solid var(--admin-border) !important;
    background: rgba(255,255,255,0.72) !important;
    color: var(--admin-text) !important;
    cursor: pointer !important;
    display:flex !important;
    align-items:center !important;
    justify-content:center !important;
    font-size: 26px !important;
    line-height: 1 !important;
    box-shadow: none !important;
  }
  .admin-shell .close-btn:hover,
  .admin-shell .close:hover{
    background: rgba(17,24,39,0.06) !important;
  }
  .admin-shell .modal-form,
  .admin-shell .modal-body{
    padding: 18px 20px !important;
    overflow: auto !important;
    max-height: calc(86vh - 88px) !important;
    -webkit-overflow-scrolling: touch;
  }
  /* Some existing modals use <form class="product-form"> or plain <form> without .modal-form */
  .admin-shell .modal-content > form,
  .admin-shell .modal-content > .product-form,
  .admin-shell .modal-content > .product-modal{
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow: auto !important;
    -webkit-overflow-scrolling: touch;
  }
  .admin-shell .modal-content > form.product-form{
    padding: 18px 20px !important;
  }
  .admin-shell .form-actions,
  .admin-shell .modal-footer{
    padding: 16px 20px !important;
    border-top: 1px solid var(--admin-border) !important;
    display:flex !important;
    gap: 10px !important;
    justify-content:flex-end !important;
    background: rgba(255,255,255,0.6) !important;
    backdrop-filter: blur(6px) !important;
  }
  .admin-shell .form-actions button[type="submit"],
  .admin-shell .modal-footer button[type="submit"],
  .admin-shell .form-actions .btn-primary{
    background: var(--admin-text) !important;
    color: #fff !important;
    border-color: var(--admin-text) !important;
  }
  .admin-shell .form-actions button[type="button"],
  .admin-shell .modal-footer button[type="button"]{
    background: transparent !important;
    color: var(--admin-text) !important;
    border: 1px solid var(--admin-border-strong) !important;
  }
`;

export function adminIcon(name: string): string {
  const icons: Record<string, string> = {
    dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3h8v6h-8z"/><path d="M3 21h8v-6H3z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    partners: '<svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 0 1-8 0"/><path d="M12 12v9"/><path d="M7 21h10"/><circle cx="12" cy="7" r="4"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M20.6 13.4 11 23H1V13l9.6-9.6a2 2 0 0 1 2.8 0l7.2 7.2a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h3l2.4 12.4a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 17.3 18.2 21l-1.6-7 5.4-4.7-7.1-.6L12 2 9.1 8.7 2 9.3l5.4 4.7L5.8 21z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 5v14"/></svg>',
    wrench: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4l-5.3 5.3a2 2 0 0 0 2.8 2.8l5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-2-2z"/></svg>',
    logout: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>',
  };
  return icons[name] || icons.dashboard;
}

export function renderAdminShellStart(opts: { title: string; activePath: string; buildMarker?: string }): string {
  const { title, activePath, buildMarker } = opts;
  const isActive = (href: string, opts?: { also?: string[]; prefixes?: string[] }) => {
    const also = opts?.also || [];
    const prefixes = opts?.prefixes || [];
    if ([href, ...also].includes(activePath)) return 'active';
    if (prefixes.some((p) => activePath.startsWith(p))) return 'active';
    return '';
  };
  return `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <span class="admin-brand-mark"></span>
        <h2>🔧 Панель Plazma</h2>
        </div>

        <div class="admin-nav-group">Главное</div>
        <nav class="admin-nav">
          <a class="admin-nav-item ${isActive('/admin')}" href="/admin"><span class="admin-ico">${adminIcon('dashboard')}</span><span>Дашборд</span></a>
          <a class="admin-nav-item ${isActive('/admin/users-detailed', { also: ['/admin/users'], prefixes: ['/admin/users/'] })}" href="/admin/users-detailed"><span class="admin-ico">${adminIcon('users')}</span><span>Пользователи</span></a>
          <a class="admin-nav-item ${isActive('/admin/broadcasts', { prefixes: ['/admin/broadcasts/'] })}" href="/admin/broadcasts"><span class="admin-ico">${adminIcon('chat')}</span><span>Рассылки</span></a>
          <a class="admin-nav-item ${isActive('/admin/partners')}" href="/admin/partners"><span class="admin-ico">${adminIcon('partners')}</span><span>Партнёры</span></a>
        </nav>

        <div class="admin-nav-group">Контент</div>
        <nav class="admin-nav">
          <a class="admin-nav-item ${isActive('/admin/products')}" href="/admin/products"><span class="admin-ico">${adminIcon('box')}</span><span>Товары</span></a>
          <a class="admin-nav-item ${isActive('/admin/promotions')}" href="/admin/promotions"><span class="admin-ico">${adminIcon('star')}</span><span>Акции</span></a>
          <a class="admin-nav-item ${isActive('/admin/categories')}" href="/admin/categories"><span class="admin-ico">${adminIcon('tag')}</span><span>Категории</span></a>
          <a class="admin-nav-item ${isActive('/admin/regions')}" href="/admin/regions"><span class="admin-ico">${adminIcon('globe')}</span><span>Регионы</span></a>
          <a class="admin-nav-item ${isActive('/admin/reviews')}" href="/admin/reviews"><span class="admin-ico">${adminIcon('star')}</span><span>Отзывы</span></a>
          <a class="admin-nav-item ${isActive('/admin/orders')}" href="/admin/orders"><span class="admin-ico">${adminIcon('cart')}</span><span>Заказы</span></a>
          <a class="admin-nav-item ${isActive('/admin/certificates')}" href="/admin/certificates"><span class="admin-ico">${adminIcon('tag')}</span><span>Сертификаты</span></a>
          <a class="admin-nav-item ${isActive('/admin/b2b-partners')}" href="/admin/b2b-partners"><span class="admin-ico">${adminIcon('partners')}</span><span>Партнёры B2B</span></a>
          <a class="admin-nav-item ${isActive('/admin/specialists')}" href="/admin/specialists"><span class="admin-ico">${adminIcon('users')}</span><span>Специалисты</span></a>
          <a class="admin-nav-item ${isActive('/admin/chats')}" href="/admin/chats"><span class="admin-ico">${adminIcon('chat')}</span><span>Чаты</span></a>
        </nav>

        <div class="admin-nav-group">Импорт и инструменты</div>
        <nav class="admin-nav">
          <a class="admin-nav-item ${isActive('/admin/invoice-import')}" href="/admin/invoice-import"><span class="admin-ico">${adminIcon('upload')}</span><span>Импорт инвойса</span></a>
          <a class="admin-nav-item ${isActive('/admin/balance-topups')}" href="/admin/balance-topups"><span class="admin-ico">${adminIcon('upload')}</span><span>Пополнения</span></a>
          <a class="admin-nav-item ${isActive('/admin/delivery-settings')}" href="/admin/delivery-settings"><span class="admin-ico">${adminIcon('wrench')}</span><span>Доставка</span></a>
          <a class="admin-nav-item ${isActive('/admin/sync-siam-pdf')}" href="/admin/sync-siam-pdf"><span class="admin-ico">${adminIcon('wrench')}</span><span>Siam из PDF</span></a>
          <a class="admin-nav-item ${isActive('/admin/sync-siam-json')}" href="/admin/sync-siam-json"><span class="admin-ico">${adminIcon('wrench')}</span><span>Siam из JSON</span></a>
          <a class="admin-nav-item ${isActive('/admin/audio')}" href="/admin/audio"><span class="admin-ico">${adminIcon('wrench')}</span><span>Аудио</span></a>
        </nav>

        <div class="admin-nav-group">Сессия</div>
        <nav class="admin-nav">
          <a class="admin-nav-item" href="/admin/logout"><span class="admin-ico">${adminIcon('logout')}</span><span>Выйти</span></a>
        </nav>
      </aside>

      <div class="admin-main">
        <header class="admin-topbar">
          <h1>${title}</h1>
          <div class="admin-build">${buildMarker ? ('сборка: ' + buildMarker) : ''}</div>
        </header>
        <main class="admin-content">
  `;
}

export function renderAdminShellEnd(): string {
  return `
        </main>
      </div>
    </div>
  `;
}

// Middleware to check admin access
export const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const session = req.session as any;
  if (!session.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
};

export function renderFullAdminPage(opts: { title: string; activePath: string; content: string; buildMarker?: string }): string {
  const { title, activePath, content, buildMarker } = opts;
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Plazma Admin</title>
      <style>${ADMIN_UI_CSS}</style>
      <script src="https://cdn.tailwindcss.com"></script>
      <!-- Quill RTE -->
      <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
      <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
    </head>
    <body>
      ${renderAdminShellStart({ title, activePath, buildMarker })}
      ${content}
      ${renderAdminShellEnd()}
    </body>
    </html>
  `;
}
