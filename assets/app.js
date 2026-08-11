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
    var tx = 0, ty = 0, cx = 0, cy = 0, on = false, raf = 0, hideT = 0;
    /* видео ещё не залито — рамку просто не показываем */
    pv.addEventListener('error', function () { peek.classList.remove('is-on'); });

    function place() {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
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
          peek.classList.add('is-on');
          var p = pv.play();
          if (p && p.catch) p.catch(function () {});
        });
        card.addEventListener('pointermove', follow);
        card.addEventListener('pointerleave', function () {
          on = false;
          peek.classList.remove('is-on');
          /* пауза только когда затухание доиграло */
          clearTimeout(hideT);
          hideT = setTimeout(function () { pv.pause(); }, 3000);
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
