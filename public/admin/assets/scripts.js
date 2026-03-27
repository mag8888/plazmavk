// АГРЕССИВНОЕ отключение автоматического перехода на детальную страницу
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚫 AdminJS ULTRA AGGRESSIVE redirect blocker loaded');

  // Полностью блокируем все переходы
  function blockAllNavigation() {
    // Блокируем все ссылки
    const allLinks = document.querySelectorAll('a');
    allLinks.forEach(link => {
      link.onclick = function(e) {
        console.log('🚫 BLOCKED LINK CLICK:', link.href);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      };
      link.style.pointerEvents = 'none';
      link.style.cursor = 'default';
    });

    // Блокируем все формы
    const allForms = document.querySelectorAll('form');
    allForms.forEach(form => {
      form.onsubmit = function(e) {
        console.log('🚫 BLOCKED FORM SUBMIT');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      };
    });

    // Блокируем все кнопки кроме action buttons
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(button => {
      if (!button.classList.contains('adminjs-button')) {
        button.onclick = function(e) {
          console.log('🚫 BLOCKED BUTTON CLICK');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        };
      }
    });
  }

  // Функция для отключения клика по строкам
  function disableRowClicks() {
    const tableRows = document.querySelectorAll('.adminjs-table tbody tr');
    tableRows.forEach(row => {
      // Убираем все обработчики событий
      row.onclick = null;
      row.style.cursor = 'default';
      row.style.pointerEvents = 'none';

      // Убираем обработчики с ячеек
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
        cell.onclick = null;
        cell.style.cursor = 'default';
        cell.style.pointerEvents = 'none';

        // Убираем все ссылки в ячейках
        const links = cell.querySelectorAll('a');
        links.forEach(link => {
          link.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          };
          link.style.pointerEvents = 'none';
          link.style.cursor = 'default';
        });
      });
    });
  }
  
  // Отключаем клики сразу
  disableRowClicks();
  
  // Блокируем всю навигацию
  blockAllNavigation();
  
  // Более агрессивное отключение
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        const newRows = document.querySelectorAll('.adminjs-table tbody tr');
        newRows.forEach(row => {
          row.onclick = null;
          row.style.cursor = 'default';
          row.style.pointerEvents = 'none';
          
          const cells = row.querySelectorAll('td');
          cells.forEach(cell => {
            cell.onclick = null;
            cell.style.cursor = 'default';
            cell.style.pointerEvents = 'none';
          });
        });
      }
    });
  });
  
  // Наблюдаем за изменениями в DOM
  const tableContainer = document.querySelector('.adminjs-table');
  if (tableContainer) {
    observer.observe(tableContainer, { childList: true, subtree: true });
  }
  
  // Добавляем обработчики только для кнопок действий
  const actionButtons = document.querySelectorAll('.adminjs-button');
  actionButtons.forEach(button => {
    button.style.cursor = 'pointer';
  });
  
  // Агрессивное отключение всех переходов
  document.addEventListener('click', function(e) {
    const target = e.target;
    const row = target.closest('.adminjs-table tbody tr');
    
    if (row && !target.closest('.adminjs-button')) {
      console.log('🚫 Blocked click on table row');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  });
  
  // Отключаем все переходы по ссылкам в таблицах
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.closest('.adminjs-table')) {
      console.log('🚫 Blocked link click in table');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  });
  
  // Перехватываем все попытки навигации
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    console.log('🚫 Blocked pushState:', args);
    return;
  };
  
  history.replaceState = function(...args) {
    console.log('🚫 Blocked replaceState:', args);
    return;
  };
  
  // Улучшаем навигацию
  const navigationItems = document.querySelectorAll('.adminjs-navigation-item');
  navigationItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // Добавляем анимацию перехода
      this.style.transform = 'translateX(5px)';
      setTimeout(() => {
        this.style.transform = 'translateX(0)';
      }, 200);
    });
  });
  
  // Добавляем индикаторы загрузки
  const forms = document.querySelectorAll('.adminjs-form');
  forms.forEach(form => {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.addEventListener('click', function() {
        this.innerHTML = '<span class="spinner"></span> Сохранение...';
        this.disabled = true;
      });
    }
  });
  
  // Улучшаем UX для фильтров
  const filterInputs = document.querySelectorAll('.adminjs-filter input, .adminjs-filter select');
  filterInputs.forEach(input => {
    input.addEventListener('focus', function() {
      this.parentElement.style.borderColor = '#007bff';
      this.parentElement.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
    });
    
    input.addEventListener('blur', function() {
      this.parentElement.style.borderColor = '#dee2e6';
      this.parentElement.style.boxShadow = 'none';
    });
  });
  
  // Добавляем анимации для карточек
  const cards = document.querySelectorAll('.adminjs-card');
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    });
  });
  
  // Улучшаем отображение таблиц
  const tables = document.querySelectorAll('.adminjs-table');
  tables.forEach(table => {
    // Добавляем полосы зебры
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
      if (index % 2 === 0) {
        row.style.backgroundColor = '#f8f9fa';
      }
    });
  });
  
  // Добавляем уведомления об успешных действиях
  const successMessages = document.querySelectorAll('.adminjs-alert--success');
  successMessages.forEach(message => {
    message.style.animation = 'fadeIn 0.5s ease';
  });
  
  // Улучшаем мобильную навигацию
  if (window.innerWidth <= 768) {
    const navigation = document.querySelector('.adminjs-navigation');
    if (navigation) {
      navigation.style.flexDirection = 'column';
      navigation.style.padding = '10px';
    }
  }
});

// Функция для обновления таблицы без перезагрузки
function refreshTable() {
  const table = document.querySelector('.adminjs-table');
  if (table) {
    table.style.opacity = '0.5';
    setTimeout(() => {
      location.reload();
    }, 300);
  }
}

// Функция для показа уведомлений
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `adminjs-notification adminjs-notification--${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// CSS анимации
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
  }
  
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
