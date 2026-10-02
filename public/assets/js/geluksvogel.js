(function () {
  'use strict';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var formMessages = JSON.parse(document.getElementById('form-messages').textContent);

  /* Header: a shadow once the page scrolls ---------------------------------- */
  var header = document.querySelector('[data-header]');
  var onScroll = function () { if (header) header.classList.toggle('is-scrolled', window.scrollY > 24); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu ---------------------------------------------------------------- */
  var menu = document.getElementById('mobile-menu');
  var toggle = document.querySelector('.menu-toggle');
  if (menu && toggle) {
    var closeButton = menu.querySelector('.close');
    var openMenu = function () {
      menu.hidden = false;
      void menu.offsetWidth;
      menu.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      setTimeout(function () { closeButton.focus(); }, 60);
    };
    var closeMenu = function () {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(function () { if (!menu.classList.contains('open')) menu.hidden = true; }, 300);
      toggle.focus();
    };
    toggle.addEventListener('click', openMenu);
    closeButton.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu(); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
  }

  /* Hero slideshow --------------------------------------------------------------- */
  var hero = document.querySelector('[data-hero]');
  if (hero) {
    var slides = hero.querySelectorAll('.slide');
    var captions = hero.querySelectorAll('.hero-caption p');
    var current = hero.querySelector('[data-current]');
    var progress = hero.querySelector('.hero-progress');
    var delay = 6000;
    var index = 0;
    var timer = null;
    hero.style.setProperty('--hero-delay', delay + 'ms');
    var show = function (next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === index); s.setAttribute('aria-hidden', i === index ? 'false' : 'true'); });
      captions.forEach(function (c, i) { c.classList.toggle('is-active', i === index); });
      if (current) current.textContent = index + 1;
      if (progress) { hero.classList.remove('is-playing'); void progress.offsetWidth; }
      if (timer) hero.classList.add('is-playing');
    };
    var play = function () {
      if (reduceMotion || timer) return;
      timer = setInterval(function () { show(index + 1); }, delay);
      hero.classList.add('is-playing');
    };
    var pause = function () { clearInterval(timer); timer = null; hero.classList.remove('is-playing'); };
    hero.querySelector('.prev').addEventListener('click', function () { pause(); show(index - 1); play(); });
    hero.querySelector('.next').addEventListener('click', function () { pause(); show(index + 1); play(); });
    hero.addEventListener('mouseenter', pause);
    hero.addEventListener('mouseleave', play);
    hero.addEventListener('focusin', pause);
    hero.addEventListener('focusout', play);
    var startX = null;
    hero.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { pause(); show(index + (dx < 0 ? 1 : -1)); play(); }
      startX = null;
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else play(); });
    show(0);
    play();
  }

  /* Timeline slider ---------------------------------------------------------------- */
  document.querySelectorAll('[data-slider]').forEach(function (slider) {
    var track = slider.querySelector('[data-track]');
    var prev = slider.querySelector('[data-prev]');
    var next = slider.querySelector('[data-next]');
    if (!track) return;
    var step = function () { var item = track.querySelector('li'); return item ? item.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : 300; };
    var update = function () {
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* Reveal on scroll and counting key figures -------------------------------------- */
  var countUp = function (el) {
    var text = el.textContent.trim();
    var target = parseInt(text.replace(/\./g, ''), 10);
    if (!target || reduceMotion) return;
    var start = null;
    var format = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var tick = function (t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / 1400, 1);
      el.textContent = format(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = text;
    };
    requestAnimationFrame(tick);
  };
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        entry.target.querySelectorAll('[data-count]').forEach(countUp);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Back to top --------------------------------------------------------------------- */
  document.querySelectorAll('[data-top]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var main = document.getElementById('main');
      if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
    });
  });

  /* Forms: compose an e-mail the visitor sends from their own client --------------- */
  document.querySelectorAll('form[data-mail]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var to = form.getAttribute('data-mail');
      var subject = formMessages.defaultSubject;
      var lines = [];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.type === 'submit' || el.type === 'button') return;
        var val = el.value.trim();
        if (!val) return;
        if (el.name === 'topic') subject = val;
        lines.push((el.getAttribute('data-label') || el.name) + ': ' + val);
      });
      var body = lines.join('\n');
      var mailto = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var result = form.parentElement.querySelector('.form-result');
      if (result) {
        result.querySelector('pre').textContent = 'Aan: ' + to + '\nOnderwerp: ' + subject + '\n\n' + body;
        var mailLink = result.querySelector('a.mail');
        if (mailLink) mailLink.href = mailto;
        var copyBtn = result.querySelector('button.copy');
        if (copyBtn) copyBtn.onclick = function () {
          var label = copyBtn.textContent;
          if (navigator.clipboard) navigator.clipboard.writeText(body).then(function () {
            copyBtn.textContent = formMessages.copied;
            setTimeout(function () { copyBtn.textContent = label; }, 2000);
          });
        };
        result.classList.add('show');
        result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
      window.location.href = mailto;
    });
  });

  /* Year in footer ------------------------------------------------------------------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
