
export function renderAdminHeader(title: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | Admin Panel</title>
      <style>
        :root {
          --admin-bg: #f4f6f8;
          --admin-sidebar: #2c3e50;
          --admin-text: #2c3e50;
          --admin-border: #dfe6e9;
          --primary-color: #3498db;
          --danger-color: #e74c3c;
          --success-color: #2ecc71;
        }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--admin-bg); color: var(--admin-text); }
        .admin-header { background: white; padding: 1rem 2rem; border-bottom: 1px solid var(--admin-border); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .admin-title { font-size: 1.5rem; font-weight: 600; margin: 0; }
        .admin-nav { display: flex; gap: 20px; }
        .admin-nav a { text-decoration: none; color: #666; font-weight: 500; transition: color 0.2s; }
        .admin-nav a:hover, .admin-nav a.active { color: var(--primary-color); }
        .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.9; }
        .btn-primary { background: var(--primary-color); color: white; }
        .btn-danger { background: var(--danger-color); color: white; }
        .users-table-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .users-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .users-table th, .users-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--admin-border); }
        .users-table th { background: #f8f9fa; font-weight: 600; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .status-active { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        .status-inactive { background: rgba(149, 165, 166, 0.15); color: #95a5a6; }
        .actions-cell { display: flex; gap: 8px; }
        .action-btn { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; opacity: 0.7; transition: opacity 0.2s; }
        .action-btn:hover { opacity: 1; }
      </style>
      <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
      <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
      <script>
        // Common admin scripts
      </script>
    </head>
    <body>
      <div class="admin-header">
        <h1 class="admin-title">${title}</h1>
        <nav class="admin-nav">
          <a href="/admin">Дашборд</a>
          <a href="/admin/products">Товары</a>
          <a href="/admin/categories">Категории</a>
          <a href="/admin/promotions" class="active">Акции</a>
          <a href="/admin/users">Пользователи</a>
          <a href="/admin/orders">Заказы</a>
        </nav>
      </div>
  `;
}
