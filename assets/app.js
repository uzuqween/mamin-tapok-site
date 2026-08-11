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

  /* --- кнопки большого окна --- */
  document.querySelectorAll('.stage__tools button').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.closest('.stage').__voxel;
      var act = b.dataset.act;
      if (act === 'spin') {
        v.spinOn = !v.spinOn;
        b.setAttribute('aria-pressed', String(v.spinOn));
      } else if (act === 'wire') {
        v.wire = !v.wire;
        b.setAttribute('aria-pressed', String(v.wire));
        v.draw();
      } else if (act === 'obj') {
        var was = b.textContent;
        b.textContent = v.download();
        setTimeout(function () { b.textContent = was; }, 1600);
      } else {
        v.yaw = -0.6; v.pitch = -0.35; v.vy = 0; v.vp = 0;
        v.draw();
      }
    });
  });

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

  /* --- окно с видео у курсора --- */
  var peek = document.querySelector('.peek');
  if (peek) {
    var pv = peek.querySelector('video');
    pv.muted = true;
    var pc = peek.querySelector('.peek__cap');
    var hoverable = window.matchMedia('(hover:hover)').matches;
    var tx = 0, ty = 0, cx = 0, cy = 0, on = false, raf = 0, hideT = 0, showT = 0;
    /* видео ещё не залито — рамку просто не показываем */
    pv.addEventListener('error', function () { peek.classList.remove('is-on'); });

    function place() {
      /* мягче, чем было: рамка отстаёт от курсора и не дёргается */
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      peek.style.transform = 'translate3d(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px,0)';
      if (on || Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        raf = requestAnimationFrame(place);
      } else { raf = 0; }
    }
    function follow(e) {
      var r = peek.getBoundingClientRect();
      var w = Math.max(r.width, 240), h = Math.max(r.height, 200);
      tx = Math.min(window.innerWidth - w - 14, e.clientX + 22);
      ty = Math.min(window.innerHeight - h - 14, Math.max(14, e.clientY - h / 2));
      if (!raf) {
        cx = tx; cy = ty;
        peek.style.transform = 'translate3d(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px,0)';
        raf = requestAnimationFrame(place);
      }
    }

    document.querySelectorAll('.card[data-video]').forEach(function (card) {
      var src = card.dataset.video;

      if (hoverable) {
        card.addEventListener('pointerenter', function (e) {
          clearTimeout(hideT);
          if (pv.dataset.src !== src) { pv.dataset.src = src; pv.src = src; }
          pc.textContent = card.dataset.vcap || '';
          on = true;
          follow(e);
          /* пауза перед показом: курсор, который просто проехал по карточке,
             рамку не вызывает — она всплывает только на осознанном наведении */
          clearTimeout(showT);
          showT = setTimeout(function () {
            if (!on) return;
            peek.classList.add('is-on');
            var p = pv.play();
            if (p && p.catch) p.catch(function () {});
          }, 380);
        });
        card.addEventListener('pointermove', follow);
        card.addEventListener('pointerleave', function () {
          on = false;
          clearTimeout(showT);
          peek.classList.remove('is-on');
          /* пауза только когда затухание доиграло */
          clearTimeout(hideT);
          hideT = setTimeout(function () { pv.pause(); }, 600);
        });
        return;
      }

      /* телефон: подпись-подсказка, что под карточкой лежит запись работы */
      var hint = document.createElement('span');
      hint.className = 'card__play';
      hint.textContent = 'смотреть работу';
      var body = card.querySelector('.card__body');
      if (body) body.appendChild(hint);

      /* телефон: тап по карточке разворачивает видео вместо модели */
      card.addEventListener('click', function (e) {
        /* по самой модели пальцем крутят — видео тут не открываем */
        if (e.target.closest('.stage') && !card.classList.contains('is-play')) return;
        var v = card.querySelector('.card__vid');
        if (!v) {
          v = document.createElement('video');
          v.className = 'card__vid';
          v.muted = true; v.loop = true; v.playsInline = true; v.controls = true;
          v.src = src;
          card.insertBefore(v, card.firstChild);
        }
        card.classList.toggle('is-play');
        hint.textContent = card.classList.contains('is-play') ? 'вернуть модель' : 'смотреть работу';
        if (card.classList.contains('is-play')) v.play(); else v.pause();
      });
    });
  }

  /* --- светлячки: у каждого свой путь, размер и ритм мерцания --- */
  (function () {
    var box = document.createElement('div');
    box.className = 'flies';
    box.setAttribute('aria-hidden', 'true');
    var narrow = window.matchMedia('(max-width:900px)').matches;
    var r = function (a, b) { return a + Math.random() * (b - a); };
    /* высота тёмной полосы фона — та же формула, что в CSS у html */
    var band = Math.min(940, Math.max(560, window.innerHeight * 0.92));
    var docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    /* плотность на экран, а не фиксированное число: длинная страница
       не остаётся с пустым низом */
    var n = Math.round((narrow ? 20 : 34) * docH / window.innerHeight);
    for (var i = 0; i < n; i++) {
      var f = document.createElement('span');
      f.className = 'fly';
      var s = r(1.6, 4.6);
      var dx = r(-130, 130), dy = r(-110, 110);
      var y = r(-20, docH);
      /* доля белого: над полосой — целиком белая точка, ниже — целиком чёрная */
      var wht = Math.round(100 * (1 - Math.min(1, Math.max(0, y / band))));
      f.style.setProperty('--x', r(-2, 100) + 'vw');
      f.style.setProperty('--y', y.toFixed(0) + 'px');
      f.style.setProperty('--c',
        'color-mix(in srgb,var(--paper-base) ' + wht + '%,var(--ink-base))');
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
