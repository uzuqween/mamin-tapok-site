/* Тема, список моделей, кнопки вьюпорта, копирование ника, появление блоков. */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'tapok-theme';

  function setTheme(t) {
    root.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch (e) {}
    var pressed = t === 'dark';
    document.querySelectorAll('#invert').forEach(function (b) {
      b.setAttribute('aria-pressed', String(pressed));
    });
    if (window.Voxel) window.Voxel.refreshColors();
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  setTheme(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  function toggle() { setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'); }
  document.querySelectorAll('#invert,[data-invert]').forEach(function (b) {
    b.addEventListener('click', toggle);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key.toLowerCase() === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey &&
        !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) toggle();
  });

  /* --- сборка страницы по частям --- */
  var seq = [
    ['.bar', 0],
    ['.hero__stage', .22],
    ['.lede', .5],
    ['.hero__cta', .6]
  ];
  seq.forEach(function (pair) {
    var el = document.querySelector(pair[0]);
    if (!el) return;
    el.style.animationDelay = pair[1] + 's';
    el.classList.add('asm');
  });

  /* --- вьюпорты --- */
  window.Voxel.init();

  /* на тач-экране крутят пальцем — подсказка должна говорить об этом */
  if (!window.matchMedia('(hover:hover)').matches) {
    document.querySelectorAll('.stage__hint').forEach(function (h) {
      h.textContent = 'ведите пальцем';
    });
  }

  /* --- список моделей в большом окне --- */
  var list = document.querySelector('.viewer__list');
  var big = document.getElementById('bigStage');
  if (list && big) {
    Object.keys(window.MODELS).forEach(function (key, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.key = key;
      b.innerHTML = window.MODELS[key].name + '<span>' +
        window.MODELS[key].cubes.length + ' куб.</span>';
      b.setAttribute('aria-selected', String(key === big.dataset.model));
      b.addEventListener('click', function () {
        list.querySelectorAll('button').forEach(function (o) {
          o.setAttribute('aria-selected', String(o === b));
        });
        big.dataset.model = key;
        big.__voxel.load(key);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  /* --- копирование ника --- */
  document.querySelectorAll('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var txt = b.dataset.copy;
      var done = function () {
        b.classList.add('is-done');
        setTimeout(function () { b.classList.remove('is-done'); }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done);
      else done();
    });
  });

  /* --- светлячки: у каждого свой путь, размер и ритм мерцания --- */
  (function () {
    var box = document.createElement('div');
    box.className = 'flies';
    box.setAttribute('aria-hidden', 'true');
    var narrow = window.matchMedia('(max-width:900px)').matches;
    var r = function (a, b) { return a + Math.random() * (b - a); };
    var docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    /* плотность на экран, а не фиксированное число: длинная страница
       не остаётся с пустым низом. счёт снижен — сотня анимированных точек
       заметно грела слабые машины, а роя из полусотни хватает */
    var n = Math.round((narrow ? 9 : 16) * docH / window.innerHeight);
    for (var i = 0; i < n; i++) {
      var f = document.createElement('span');
      f.className = 'fly';
      var s = r(1.6, 4.6);
      var dx = r(-130, 130), dy = r(-110, 110);
      var y = r(-20, docH);
      f.style.setProperty('--x', r(-2, 100) + 'vw');
      f.style.setProperty('--y', y.toFixed(0) + 'px');
      f.style.setProperty('--s', s.toFixed(2) + 'px');
      /* крупные светятся ярче мелких — рой получает глубину */
      f.style.setProperty('--o', (0.42 + (s - 1.6) / 3 * 0.53).toFixed(2));
      f.style.setProperty('--dx', dx.toFixed(0) + 'px');
      f.style.setProperty('--dy', dy.toFixed(0) + 'px');
      /* серединная точка пути сбита в сторону от прямой — траектория кривая */
      f.style.setProperty('--mx', (dx * r(0.1, 0.55) + r(-46, 46)).toFixed(0) + 'px');
      f.style.setProperty('--my', (dy * r(0.1, 0.55) + r(-40, 40)).toFixed(0) + 'px');
      f.style.setProperty('--d', r(11, 30).toFixed(1) + 's');    // путь
      f.style.setProperty('--p', r(2.6, 7.5).toFixed(1) + 's');  // дыхание размера
      f.style.setProperty('--g', r(2.4, 8).toFixed(1) + 's');    // вспышка
      f.style.setProperty('--dd', (-r(0, 30)).toFixed(1) + 's');
      f.style.setProperty('--pd', (-r(0, 8)).toFixed(1) + 's');
      f.style.setProperty('--gd', (-r(0, 8)).toFixed(1) + 's');
      box.appendChild(f);
    }
    document.body.appendChild(box);
  })();

  /* --- появление блоков --- */
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '-40px' });
    document.querySelectorAll('.card,.deal__list>div,.sec__head,.contact__list>li')
      .forEach(function (el) { el.classList.add('rv'); io.observe(el); });
  }
})();
