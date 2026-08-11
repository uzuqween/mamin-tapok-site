/* Мини-рендерер воксельных моделей на 2D-канвасе. Без библиотек.
   Грани сортируются по глубине, заливка — оттенок между цветом бумаги и цветом чернил,
   поэтому модель автоматически переворачивается вместе с темой сайта. */
(function () {
  'use strict';

  var LIGHT = norm([0.45, 0.78, 0.44]);

  function norm(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function rgb(str) {
    var m = str.trim().match(/^#([0-9a-f]{6})$/i);
    if (m) {
      var n = parseInt(m[1], 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    var p = str.match(/-?\d+(\.\d+)?/g) || [0, 0, 0];
    return [+p[0], +p[1], +p[2]];
  }

  function mix(a, b, t) {
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  function mixA(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  /* ---- софтверный растеризатор с буфером глубины ----
     Сортировка граней (painter) при пересекающихся кубах всегда врёт:
     деталь то перекрывает крупную грань, то исчезает под ней.
     Поэтому глубина решается попиксельно: больше z — ближе к камере. */
  function edge(ax, ay, bx, by, px, py) {
    return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  }

  function tri(fr, zb, bw, bh, a, b, c, col) {
    var ar = edge(a[0], a[1], b[0], b[1], c[0], c[1]);
    if (ar === 0) return;
    if (ar < 0) { var t = b; b = c; c = t; ar = -ar; }
    var x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    var x1 = Math.min(bw - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    var y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    var y1 = Math.min(bh - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (var y = y0; y <= y1; y++) {
      var py = y + 0.5;
      for (var x = x0; x <= x1; x++) {
        var px = x + 0.5;
        var w0 = edge(b[0], b[1], c[0], c[1], px, py);
        if (w0 < 0) continue;
        var w1 = edge(c[0], c[1], a[0], a[1], px, py);
        if (w1 < 0) continue;
        var w2 = edge(a[0], a[1], b[0], b[1], px, py);
        if (w2 < 0) continue;
        var d = (w0 * a[2] + w1 * b[2] + w2 * c[2]) / ar;
        var i = y * bw + x;
        if (d <= zb[i]) continue;
        zb[i] = d;
        var o = i * 4;
        fr[o] = col[0]; fr[o + 1] = col[1]; fr[o + 2] = col[2]; fr[o + 3] = 255;
      }
    }
  }

  function line(fr, zb, bw, bh, a, b, col, bias, fat) {
    var x0 = Math.round(a[0]), y0 = Math.round(a[1]);
    var x1 = Math.round(b[0]), y1 = Math.round(b[1]);
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    var steps = Math.max(dx, dy) || 1;
    var n = 0;
    for (;;) {
      var t = n / steps;
      var d = a[2] + (b[2] - a[2]) * t + bias;
      plot(fr, zb, bw, bh, x0, y0, d, col);
      if (fat) {
        plot(fr, zb, bw, bh, x0 + 1, y0, d, col);
        plot(fr, zb, bw, bh, x0, y0 + 1, d, col);
      }
      if (x0 === x1 && y0 === y1) break;
      var e2 = err * 2;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
      n++;
      if (n > steps + 2) break;
    }
  }

  function plot(fr, zb, bw, bh, x, y, d, col) {
    if (x < 0 || y < 0 || x >= bw || y >= bh) return;
    var i = y * bw + x;
    if (d <= zb[i]) return;
    zb[i] = d;
    var o = i * 4;
    fr[o] = col[0]; fr[o + 1] = col[1]; fr[o + 2] = col[2]; fr[o + 3] = 255;
  }

  /* 6 граней куба: индексы вершин + нормаль */
  var FACES = [
    [[4, 5, 6, 7], [0, 0, 1]],   // front
    [[1, 0, 3, 2], [0, 0, -1]],  // back
    [[5, 1, 2, 6], [1, 0, 0]],   // right
    [[0, 4, 7, 3], [-1, 0, 0]],  // left
    [[3, 7, 6, 2], [0, 1, 0]],   // top
    [[0, 1, 5, 4], [0, -1, 0]]   // bottom
  ];

  function buildFaces(model) {
    var out = [];
    model.cubes.forEach(function (c, ci) {
      var x = c[0], y = c[1], z = c[2], w = c[3], h = c[4], d = c[5];
      var tone = c[6] === undefined ? 0.6 : c[6];
      var v = [
        [x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z],
        [x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]
      ];
      FACES.forEach(function (f) {
        out.push({
          p: f[0].map(function (i) { return v[i]; }),
          n: f[1], t: tone, ci: ci
        });
      });
    });
    return out;
  }

  function bounds(model) {
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    model.cubes.forEach(function (c) {
      for (var a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a], c[a]);
        hi[a] = Math.max(hi[a], c[a] + c[a + 3]);
      }
    });
    return { lo: lo, hi: hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
  }
  function Viewer(stage) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hud = {};
    stage.querySelectorAll('[data-hud]').forEach(function (el) {
      this.hud[el.dataset.hud] = el;
    }, this);

    this.yaw = -0.6;
    this.pitch = -0.35;
    this.vy = 0;
    this.vp = 0;
    this.spin = parseFloat(stage.dataset.spin || '0.2');
    this.spinOn = true;
    this.wire = false;
    this.dragging = false;
    this.visible = true;
    this.hover = false;
    this.build = 0;
    this.started = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.w = 0;
    this.h = 0;

    this.px = parseFloat(stage.dataset.px || '3');   // размер «пикселя» стилизации
    /* на телефоне окно вдвое меньше, поэтому пиксель наоборот мельче —
       иначе модель рассыпается в кашу и деталей не разобрать */
    if (window.matchMedia('(max-width:900px)').matches) this.px = this.px * 0.75;
    this.buf = document.createElement('canvas');
    this.bctx = this.buf.getContext('2d');
    this.blur = 0;                                    // текущая смазанность
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;

    this.readColors();
    this.load(stage.dataset.model);
    this.bind();
    this.resize();
  }

  Viewer.prototype.readColors = function () {
    /* цвета берём с самой сцены, а не с корня: блок на чёрном фоне
       меняет чернила и бумагу местами, и модель должна повернуться вместе с ним */
    var cs = getComputedStyle(this.stage);
    this.ink = rgb(cs.getPropertyValue('--ink'));
    this.paper = rgb(cs.getPropertyValue('--paper'));
  };

  /* ---- выгрузка в .obj ----
     геометрия та же, что на экране: 8 вершин и 6 четырёхугольников на куб,
     обход граней взят из FACES, поэтому нормали снаружи. единицы — воксели,
     как в редакторе; делить на 16 под блок Minecraft здесь незачем. */
  Viewer.prototype.toOBJ = function () {
    var m = this.model;
    var out = ['# ' + m.name, '# ' + m.cubes.length + ' cubes', 'o ' + (this.stage.dataset.model || 'model')];
    var base = 0;
    m.cubes.forEach(function (c) {
      var x = c[0], y = c[1], z = c[2], w = c[3], h = c[4], d = c[5];
      var v = [
        [x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z],
        [x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]
      ];
      v.forEach(function (p) {
        out.push('v ' + p[0] + ' ' + p[1] + ' ' + p[2]);
      });
      FACES.forEach(function (f) {
        out.push('f ' + f[0].map(function (i) { return base + i + 1; }).join(' '));
      });
      base += 8;
    });
    return out.join('\n') + '\n';
  };

  Viewer.prototype.download = function () {
    var name = (this.stage.dataset.model || 'model') + '.obj';
    var url = URL.createObjectURL(new Blob([this.toOBJ()], { type: 'text/plain' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return name;
  };

  Viewer.prototype.load = function (key) {
    var model = window.MODELS[key] || window.MODELS.cat;
    this.model = model;
    this.faces = buildFaces(model);
    var b = bounds(model);
    this.center = [
      (b.lo[0] + b.hi[0]) / 2,
      (b.lo[1] + b.hi[1]) / 2,
      (b.lo[2] + b.hi[2]) / 2
    ];
    this.radius = Math.hypot(b.size[0], b.size[1], b.size[2]) / 2 || 1;

    var c = this.center, self = this;
    this.cubes = model.cubes.map(function (q) {
      var cc = [q[0] + q[3] / 2, q[1] + q[4] / 2, q[2] + q[5] / 2];
      var dir = norm([cc[0] - c[0], cc[1] - c[1] + self.radius * .35, cc[2] - c[2]]);
      return { c: cc, dir: dir };
    });

    if (this.hud.name) this.hud.name.textContent = model.name;
    if (this.hud.dim) {
      this.hud.dim.textContent = b.size.map(function (n) {
        return Math.round(n);
      }).join('×');
    }
    if (this.hud.faces) this.hud.faces.textContent = this.faces.length + ' граней';
    this.build = 0;
    this.draw();
  };

  Viewer.prototype.resize = function () {
    var r = this.stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width);
    this.canvas.height = Math.round(r.height);
    /* внутренний буфер низкого разрешения — отсюда пиксельная стилизация */
    this.bw = Math.max(24, Math.round(r.width / this.px));
    this.bh = Math.max(24, Math.round(r.height / this.px));
    this.buf.width = this.bw;
    this.buf.height = this.bh;
    var n = this.bw * this.bh;
    this.fr = new Uint8ClampedArray(n * 4);       // кадр
    this.zb = new Float32Array(n);               // буфер глубины
    this.imgData = this.bctx.createImageData(this.bw, this.bh);
    this.acc = this.imgData.data;                // накопитель для смаза
    this.ctx.imageSmoothingEnabled = false;
    this.draw();
  };

  Viewer.prototype.bind = function () {
    var self = this;
    var last = null;

    this.stage.addEventListener('pointerdown', function (e) {
      self.dragging = true;
      last = [e.clientX, e.clientY];
      self.stage.classList.add('is-touched');
      self.stage.setPointerCapture(e.pointerId);
    });
    this.stage.addEventListener('pointermove', function (e) {
      if (!self.dragging || !last) return;
      var dx = (e.clientX - last[0]) / 140;
      var dy = (e.clientY - last[1]) / 140;
      last = [e.clientX, e.clientY];
      self.yaw += dx;
      self.pitch = Math.max(-1.35, Math.min(1.35, self.pitch + dy));
      self.vy = dx;
      self.vp = dy;
      self.draw();
    });
    function up() { self.dragging = false; last = null; }
    this.stage.addEventListener('pointerup', up);
    this.stage.addEventListener('pointercancel', up);
    this.stage.addEventListener('keydown', function (e) {
      var step = 0.18;
      if (e.key === 'ArrowLeft') self.yaw -= step;
      else if (e.key === 'ArrowRight') self.yaw += step;
      else if (e.key === 'ArrowUp') self.pitch = Math.max(-1.35, self.pitch - step);
      else if (e.key === 'ArrowDown') self.pitch = Math.min(1.35, self.pitch + step);
      else return;
      e.preventDefault();
      self.stage.classList.add('is-touched');
      self.draw();
    });
    this.stage.tabIndex = 0;

    var card = this.stage.closest('.card') || this.stage;
    card.addEventListener('pointerenter', function () { self.hover = true; self.draw(); });
    card.addEventListener('pointerleave', function () { self.hover = false; self.draw(); });
    this.stage.addEventListener('focus', function () { self.hover = true; self.draw(); });
    this.stage.addEventListener('blur', function () { self.hover = false; self.draw(); });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { self.resize(); }).observe(this.stage);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        self.visible = es[0].isIntersecting;
        if (self.visible) self.started = true;
      }, { rootMargin: '80px' }).observe(this.stage);
    } else {
      this.started = true;
    }
  };

  Viewer.prototype.tick = function (dt) {
    var moved = false;
    if (this.build < 1) {
      if (this.reduced) this.build = 1;
      else if (this.started) this.build = Math.min(1, this.build + dt / 1.1);
      moved = true;
    }
    if (this.spinOn && !this.dragging && this.visible) {
      this.yaw += this.spin * dt;
      moved = true;
    }
    if (!this.dragging && (Math.abs(this.vy) > 0.0004 || Math.abs(this.vp) > 0.0004)) {
      this.yaw += this.vy;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch + this.vp));
      this.vy *= 0.92;
      this.vp *= 0.92;
      moved = true;
    }
    if (this.blur > 0.02) moved = true;      // догашиваем шлейф
    if (moved && this.visible) this.draw();
  };

  Viewer.prototype.draw = function () {
    if (!this.w || !this.h || !this.bw) return;

    var spd = Math.abs(this.yaw - this.lastYaw) + Math.abs(this.pitch - this.lastPitch);
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;
    this.blur = this.reduced ? 0 : Math.max(this.blur * 0.84, Math.min(1, spd * 40));

    var bw = this.bw, bh = this.bh;
    var fr = this.fr, zb = this.zb, acc = this.acc;
    var n2 = bw * bh;
    for (var i = 0; i < n2; i++) { zb[i] = -1e9; fr[i * 4 + 3] = 0; }

    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var scale = Math.min(this.bw, this.bh) / (this.radius * 2.5);
    var dist = this.radius * 4.2;
    var ox = this.bw / 2, oy = this.bh / 2;
    var c = this.center;
    var self = this;

    function project(p) {
      var x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
      var x1 = x * cy + z * sy;
      var z1 = -x * sy + z * cy;
      var y1 = y * cp - z1 * sp;
      var z2 = y * sp + z1 * cp;
      var f = dist / (dist - z2 * 0.55);
      return [ox + x1 * scale * f, oy - y1 * scale * f, z2];
    }
    function rotN(n) {
      var x1 = n[0] * cy + n[2] * sy;
      var z1 = -n[0] * sy + n[2] * cy;
      return [x1, n[1] * cp - z1 * sp, n[1] * sp + z1 * cp];
    }

    var list = [];
    var nCubes = this.cubes.length;
    var build = this.build;
    var cubes = this.cubes;
    var radius = this.radius;
    var flat = this.hover && !this.wire;
    var wire = this.wire;
    var inkA = this.ink, paperA = this.paper;
    var edgeCol = mixA(paperA, inkA, this.hover ? 1 : 0.9);
    var bias = radius * 0.02;

    this.faces.forEach(function (f) {
      var s = 1, off = null;
      if (build < 1) {
        var stag = 0.55 / Math.max(nCubes, 1);
        var local = (build - f.ci * stag) / 0.45;
        if (local <= 0) return;                      // деталь ещё не прилетела
        local = Math.min(1, local);
        var e = 1 - Math.pow(1 - local, 3);
        s = 0.35 + 0.65 * e;
        var d = cubes[f.ci].dir, k = (1 - e) * radius * 1.7;
        off = [d[0] * k, d[1] * k, d[2] * k];
      }
      var n = rotN(f.n);
      if (n[2] <= 0.001) return;                     // отсечение задних граней
      var cc = cubes[f.ci].c;
      var pts = f.p.map(function (p) {
        var q = [
          cc[0] + (p[0] - cc[0]) * s,
          cc[1] + (p[1] - cc[1]) * s,
          cc[2] + (p[2] - cc[2]) * s
        ];
        if (off) { q[0] += off[0]; q[1] += off[1]; q[2] += off[2]; }
        return project(q);
      });
      var lam = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      var shade = 0.16 + 0.72 * lam * (0.45 + 0.55 * f.t);
      list.push({ pts: pts, shade: shade });
    });

    /* заливка по буферу глубины — порядок обхода больше ничего не решает */
    if (!wire) {
      list.forEach(function (f) {
        var col = mixA(inkA, paperA, flat ? 0.72 + f.shade * 0.28 : f.shade);
        tri(fr, zb, bw, bh, f.pts[0], f.pts[1], f.pts[2], col);
        tri(fr, zb, bw, bh, f.pts[0], f.pts[2], f.pts[3], col);
      });
    }
    /* рёбра — с тем же тестом глубины плюс маленький сдвиг к камере */
    var fat = this.hover;
    list.forEach(function (f) {
      for (var i = 0; i < 4; i++) {
        line(fr, zb, bw, bh, f.pts[i], f.pts[(i + 1) % 4], edgeCol, bias, fat);
      }
    });

    /* смаз: гасим прошлый кадр и накладываем новый сверху */
    if (this.blur > 0.02) {
      var keep = 0.88 - 0.34 * (1 - this.blur);
      for (var p = 0; p < n2; p++) {
        var o = p * 4;
        if (fr[o + 3]) {
          acc[o] = fr[o]; acc[o + 1] = fr[o + 1]; acc[o + 2] = fr[o + 2]; acc[o + 3] = 255;
        } else {
          acc[o + 3] = acc[o + 3] * keep;
        }
      }
    } else {
      acc.set(fr);
    }
    this.bctx.putImageData(this.imgData, 0, 0);

    /* растягиваем буфер на канвас без сглаживания — крупный пиксель */
    var out = this.ctx;
    out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, this.canvas.width, this.canvas.height);
    out.drawImage(this.buf, 0, 0, this.canvas.width, this.canvas.height);

    if (this.hud.rot) {
      this.hud.rot.textContent =
        'y ' + Math.round((this.yaw * 180 / Math.PI) % 360) + '° / ' +
        'x ' + Math.round(this.pitch * 180 / Math.PI) + '°';
    }
  };

  /* ---- общий цикл на все вьюпорты ---- */
  var viewers = [];
  var prev = 0;
  function loop(ts) {
    var dt = prev ? Math.min((ts - prev) / 1000, 0.05) : 0;
    prev = ts;
    for (var i = 0; i < viewers.length; i++) viewers[i].tick(dt);
    requestAnimationFrame(loop);
  }

  window.Voxel = {
    init: function (root) {
      (root || document).querySelectorAll('.stage').forEach(function (s) {
        if (s.__voxel) return;
        var v = new Viewer(s);
        s.__voxel = v;
        viewers.push(v);
      });
      if (viewers.length && !prev) requestAnimationFrame(loop);
      return viewers;
    },
    refreshColors: function () {
      viewers.forEach(function (v) { v.readColors(); v.draw(); });
    },
    all: viewers
  };
})();
