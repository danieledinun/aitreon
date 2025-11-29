/**
 * Tandym.ai Chat Widget
 * Embeddable chat widget for creator AI twins
 */

(function() {
  'use strict';

  // Widget configuration
  let config = {
    username: '',
    position: 'bottom-right',
    theme: 'light',
    primaryColor: '#6366f1',
    showAvatar: true,
    buttonText: 'Chat with me',
    width: '400',
    height: '600'
  };

  // Widget state
  let isOpen = false;
  let widgetContainer = null;
  let widgetButton = null;
  let widgetIframe = null;

  /**
   * Initialize the widget
   */
  function init(options) {
    config = { ...config, ...options };

    if (!config.username) {
      console.error('Tandym Widget: username is required');
      return;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createWidget);
    } else {
      createWidget();
    }
  }

  /**
   * Create the widget UI
   */
  function createWidget() {
    // Create container
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'tandym-widget-container';
    widgetContainer.style.cssText = `
      position: fixed;
      ${getPositionStyles()}
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;

    // Create button
    widgetButton = document.createElement('button');
    widgetButton.id = 'tandym-widget-button';
    widgetButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>${config.buttonText}</span>
    `;
    widgetButton.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: ${config.primaryColor};
      color: white;
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.2s ease;
    `;
    widgetButton.onmouseover = function() {
      this.style.transform = 'scale(1.05)';
      this.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    };
    widgetButton.onmouseout = function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    };
    widgetButton.onclick = toggleWidget;

    // Create iframe (hidden initially)
    widgetIframe = document.createElement('iframe');
    widgetIframe.id = 'tandym-widget-iframe';
    widgetIframe.src = getIframeUrl();
    widgetIframe.style.cssText = `
      display: none;
      width: ${config.width}px;
      height: ${config.height}px;
      border: none;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      background: white;
    `;
    widgetIframe.allow = 'microphone';

    // Add elements to container
    widgetContainer.appendChild(widgetButton);
    widgetContainer.appendChild(widgetIframe);

    // Add container to page
    document.body.appendChild(widgetContainer);
  }

  /**
   * Get position styles based on config
   */
  function getPositionStyles() {
    const margin = '20px';
    switch (config.position) {
      case 'bottom-left':
        return `bottom: ${margin}; left: ${margin};`;
      case 'top-right':
        return `top: ${margin}; right: ${margin};`;
      case 'top-left':
        return `top: ${margin}; left: ${margin};`;
      case 'bottom-right':
      default:
        return `bottom: ${margin}; right: ${margin};`;
    }
  }

  /**
   * Get iframe URL with parameters
   */
  function getIframeUrl() {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      theme: config.theme,
      color: config.primaryColor.replace('#', '')
    });
    return `${baseUrl}/embed/${config.username}?${params.toString()}`;
  }

  /**
   * Toggle widget open/close
   */
  function toggleWidget() {
    isOpen = !isOpen;

    if (isOpen) {
      // Show iframe, hide button text
      widgetButton.style.padding = '12px';
      widgetButton.querySelector('span').style.display = 'none';
      widgetButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      widgetIframe.style.display = 'block';
      widgetButton.style.borderRadius = '50%';
    } else {
      // Hide iframe, show button text
      widgetButton.style.padding = '12px 20px';
      widgetButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${config.buttonText}</span>
      `;
      widgetIframe.style.display = 'none';
      widgetButton.style.borderRadius = '9999px';
    }
  }

  /**
   * Public API
   */
  window.TandymWidget = window.TandymWidget || function() {
    const args = Array.prototype.slice.call(arguments);
    const command = args[0];
    const options = args[1];

    switch (command) {
      case 'init':
        init(options);
        break;
      case 'open':
        if (!isOpen) toggleWidget();
        break;
      case 'close':
        if (isOpen) toggleWidget();
        break;
      case 'destroy':
        if (widgetContainer) {
          widgetContainer.remove();
          widgetContainer = null;
          widgetButton = null;
          widgetIframe = null;
          isOpen = false;
        }
        break;
      default:
        console.warn('Tandym Widget: Unknown command', command);
    }
  };

  // Process queued commands
  if (window.tw && window.tw.q) {
    window.tw.q.forEach(function(args) {
      window.TandymWidget.apply(null, args);
    });
  }
})();
