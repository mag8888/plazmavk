// УЛЬТРА АГРЕССИВНЫЙ блокировщик редиректа AdminJS
console.log('🚫 ULTRA AGGRESSIVE AdminJS Blocker Loading...');

// Переопределяем все методы навигации
(function() {
  'use strict';
  
  // Блокируем все переходы через window.location
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    get: function() {
      return originalLocation;
    },
    set: function(value) {
      console.log('🚫 BLOCKED location change:', value);
      return false;
    }
  });

  // Блокируем все переходы через history API
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  const originalGo = history.go;
  const originalBack = history.back;
  const originalForward = history.forward;

  history.pushState = function() {
    console.log('🚫 BLOCKED pushState:', arguments);
    return false;
  };

  history.replaceState = function() {
    console.log('🚫 BLOCKED replaceState:', arguments);
    return false;
  };

  history.go = function() {
    console.log('🚫 BLOCKED go:', arguments);
    return false;
  };

  history.back = function() {
    console.log('🚫 BLOCKED back');
    return false;
  };

  history.forward = function() {
    console.log('🚫 BLOCKED forward');
    return false;
  };

  // Блокируем все события навигации
  window.addEventListener('beforeunload', function(e) {
    console.log('🚫 BLOCKED beforeunload');
    e.preventDefault();
    e.returnValue = '';
    return '';
  });

  window.addEventListener('popstate', function(e) {
    console.log('🚫 BLOCKED popstate');
    e.preventDefault();
    e.stopPropagation();
    return false;
  });

  // Блокируем все клики
  document.addEventListener('click', function(e) {
    const target = e.target;
    
    // Разрешаем только кнопки действий
    if (target.classList.contains('adminjs-button') || 
        target.closest('.adminjs-button')) {
      return true;
    }
    
    // Блокируем все остальное
    console.log('🚫 BLOCKED CLICK:', target);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }, true);

  // Блокируем все submit формы
  document.addEventListener('submit', function(e) {
    console.log('🚫 BLOCKED FORM SUBMIT');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }, true);

  // Блокируем все изменения URL
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;
  const originalReload = window.location.reload;

  window.location.assign = function() {
    console.log('🚫 BLOCKED location.assign');
    return false;
  };

  window.location.replace = function() {
    console.log('🚫 BLOCKED location.replace');
    return false;
  };

  window.location.reload = function() {
    console.log('🚫 BLOCKED location.reload');
    return false;
  };

  console.log('🚫 ULTRA AGGRESSIVE AdminJS Blocker Loaded!');
})();
