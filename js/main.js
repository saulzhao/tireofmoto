/* ============================================================
   Tire of Moto — Main JS
   Lightweight, no dependencies
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.navbar-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('open');
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Lazy-load images (native loading="lazy" is preferred,
  // this is a fallback for older browsers)
  if ('loading' in HTMLImageElement.prototype) {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
    });
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          observer.unobserve(img);
        }
      });
    });
    document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
  }

  // Search form validation
  const searchForm = document.querySelector('.navbar-search form');
  if (searchForm) {
    searchForm.addEventListener('submit', e => {
      const q = searchForm.querySelector('input[name="q"]').value.trim();
      if (!q) {
        e.preventDefault();
        alert('Please enter a search term.');
      }
    });
  }

  // Contact form enhancement
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      const name = fd.get('name') || 'Customer';
      const email = fd.get('email') || '';
      const whatsapp = fd.get('whatsapp') || '';
      const subject = 'Contact Inquiry from ' + name;
      const body = [
        'Name:', fd.get('name') || '',
        'Email:', email,
        'WhatsApp:', whatsapp,
        'Subject:', fd.get('subject') || '',
        '',
        fd.get('message') || ''
      ].join('\n');
      window.location.href = 'mailto:zenyaretyre@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }

  // Copy code blocks on click
  document.querySelectorAll('pre').forEach(pre => {
    pre.style.position = 'relative';
    pre.style.cursor = 'pointer';
    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;padding:4px 10px;background:#374151;color:#e5e7eb;border:none;border-radius:4px;font-size:12px;opacity:0;transition:opacity .2s;';
    pre.appendChild(btn);
    pre.addEventListener('mouseenter', () => btn.style.opacity = '1');
    pre.addEventListener('mouseleave', () => btn.style.opacity = '0');
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent.replace('Copy', '').trim());
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  });
});
