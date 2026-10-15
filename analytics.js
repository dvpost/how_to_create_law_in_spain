(() => {
  'use strict';

  // Keep offline copies and local previews out of the public site's statistics.
  if (!['http:', 'https:'].includes(location.protocol) ||
      ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-ZBZX7NP7HV');

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=G-ZBZX7NP7HV';
  document.head.append(tag);
})();
