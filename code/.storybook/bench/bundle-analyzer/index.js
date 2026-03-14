/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
'use strict';
(() => {
  var m = document,
    h = Math,
    ie = requestAnimationFrame,
    he = localStorage,
    te = window;
  var Fe = 'r',
    Be = 'n',
    ze = 'p';
  var Pe = Object.prototype.hasOwnProperty,
    Vt = Array.prototype.indexOf,
    gt,
    Yl = /\.\w+\.map$/,
    Xl = /^\(disabled\):/,
    $t = navigator.platform.indexOf('Mac') >= 0,
    Re = () => (te.performance || Date).now(),
    rt = (e) => {
      try {
        return he.getItem(e);
      } catch (t) {
        return null;
      }
    },
    nt = (e, t) => {
      try {
        he.setItem(e, t);
      } catch (i) {}
    },
    Te = (e) => Yl.test(e);
  var Se = (e) => e.replace(Xl, ''),
    _e = (e) => (gt ? gt.format(e) : e + ''),
    ht = (e) => {
      let t = e.toFixed(1).split('.', 2);
      return _e(+t[0]) + '.' + t[1];
    },
    ae = (e) =>
      e === 1
        ? '1 byte'
        : e < 1024
          ? _e(e) + ' bytes'
          : e < 1024 * 1024
            ? ht(e / 1024) + ' kb'
            : e < 1024 * 1024 * 1024
              ? ht(e / (1024 * 1024)) + ' mb'
              : ht(e / (1024 * 1024 * 1024)) + ' gb',
    z = (e) => e.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    it = (e) => {
      let t = 0.6 + 0.4 * h.max(0, h.cos(e)),
        i = 0.5 + 0.2 * h.max(0, h.cos(e + (h.PI * 2) / 3));
      return (
        'hsl(' + (e * 180) / h.PI + 'deg, ' + h.round(100 * t) + '%, ' + h.round(100 * i) + '%)'
      );
    },
    Vl = /\bFirefox\//.test(navigator.userAgent),
    ot = (e, t, i, p, o, s) => {
      if (Vl) {
        let n = e.lineWidth,
          r = n / 2;
        (e.fillStyle = t),
          e.fillRect(i - r, p - r, o + n, n),
          e.fillRect(i - r, p + r, n, s - n),
          e.fillRect(i - r, p + s - r, o + n, n),
          e.fillRect(i + o - r, p + r, n, s - n);
        return;
      }
      (e.strokeStyle = t), e.strokeRect(i, p, o, s);
    },
    Tt = (e) => m.createTextNode(e),
    xt = (e) => {
      let t = m.createElement('code');
      return (t.textContent = e), t;
    },
    xe = (e, t) => {
      let i = m.createElement('span');
      return (i.className = e), (i.textContent = t), i;
    },
    We = (e) =>
      e.startsWith('data:') && e.indexOf(',') >= 0
        ? ((e = e.slice(0, 65).replace(/\n/g, '\\n')),
          '<' + (e.length > 64 ? e.slice(0, 64) + '...' : e) + '>')
        : e,
    ge = (e) => {
      if (e.startsWith('data:') && e.indexOf(',') >= 0) {
        return [e];
      }
      let t = e.split('/');
      return (
        t.length >= 3 &&
          t[1] === '' &&
          t[0].endsWith(':') &&
          t.splice(0, 3, t.slice(0, 3).join('/')),
        t
      );
    },
    Ue = (e, t) => {
      if (e === '') {
        return [];
      }
      let i = ge(e);

      if (!t) {
        return i;
      }

      for (let p = 0; p <= i.length; p++) {
        if (t[p] !== i[p]) {
          t.length = p;
          break;
        }
      }
      return t;
    },
    Jt = (e, t) => {
      let i = ge(e);

      if (!t) {
        return i.reverse();
      }

      for (let p = 0; p <= i.length; p++) {
        if (t[p] !== i[i.length - p - 1]) {
          t.length = p;
          break;
        }
      }
      return t;
    },
    qt = (e) => {
      let t = e.lastIndexOf('/');
      return t < 0 ? '.' : e.slice(0, t);
    },
    Kt = (e, t) => {
      let i = e.split('/'),
        p = t === '.' ? [] : t.split('/'),
        o = 0;

      for (; o < p.length && i[0] === p[o]; ) {
        i.shift(), o++;
      }

      if (o === p.length) {
        i.unshift('.');
      } else {
        for (; o < p.length; ) {
          i.unshift('..'), o++;
        }
      }
      return i.join('/');
    },
    Zt = (e) => {
      let t = ge(e);

      for (let i = t.length - 1; i >= 0; i--) {
        if (t[i] === 'node_modules') {
          return (
            (t = t.slice(i + 1)),
            t.length > 1 && /^index\.(?:[jt]sx?)$/.test(t[t.length - 1]) && t.pop(),
            t.join('/')
          );
        }
      }
      return null;
    },
    He = !1,
    Yt = matchMedia('(prefers-color-scheme: dark)'),
    Xt = () => Ge && Ge(),
    bt = null,
    yt = null,
    Ge = null,
    je = (e) => (bt = e),
    Ye = (e) => (yt = e),
    Xe = (e) => (Ge = e);
  m.addEventListener('keydown', () => (He = !0), { capture: !0 });
  m.addEventListener('mousedown', () => (He = !1), { capture: !0 });
  te.addEventListener('wheel', (e) => bt && bt(e), { passive: !1 });
  te.addEventListener('resize', () => yt && yt());
  try {
    Yt.addEventListener('change', Xt);
  } catch (e) {
    Yt.addListener(Xt);
  }
  try {
    gt = new Intl.NumberFormat();
  } catch (e) {}
  var Et = m.getElementById('dragTarget'),
    $l = m.getElementById('importButton'),
    Nt = 0,
    vt,
    Qt = (e, t = e.dataTransfer) => t && t.types && Vt.call(t.types, 'Files') !== -1,
    el = (e) => {
      if (e.length === 1) {
        let t = new FileReader();
        (t.onload = () => et(t.result)), t.readAsText(e[0]);
      }
    };
  m.ondragover = (e) => {
    e.preventDefault();
  };
  m.ondragenter = (e) => {
    e.preventDefault(), Qt(e) && ((Et.style.display = 'block'), Nt++);
  };
  m.ondragleave = (e) => {
    e.preventDefault(), Qt(e) && --Nt === 0 && (Et.style.display = 'none');
  };
  m.ondrop = (e) => {
    e.preventDefault(),
      (Et.style.display = 'none'),
      (Nt = 0),
      e.dataTransfer && e.dataTransfer.files && el(e.dataTransfer.files);
  };
  $l.onclick = function () {
    vt && m.body.removeChild(vt);
    let e = m.createElement('input');
    (e.type = 'file'),
      (e.style.display = 'none'),
      m.body.append(e),
      (vt = e),
      e.click(),
      (e.onchange = () => e.files && el(e.files));
  };
  m.body.addEventListener('paste', (e) => {
    e.clipboardData && (e.preventDefault(), et(e.clipboardData.getData('text/plain')));
  });
  var tl = 'l',
    St = 'o',
    wt = 'd',
    ll = 'g';
  var nl = 'x',
    st = 'c';
  var ve = (e, t) => t.t - e.t || +(e.e > t.e) - +(e.e < t.e),
    we = (e, t, i) => {
      let p = ge(t),
        o = p.length,
        s = e,
        n = '';
      e.t += i;
      for (let r = 0; r < o; r++) {
        let l = p[r],
          a = s.n,
          f = a[l],
          u = l + (r + 1 < o ? '/' : '');
        (n += u),
          Pe.call(a, l) || ((f = { r: u, e: n, t: 0, n: {} }), (a[l] = f)),
          (f.t += i),
          (s = f);
      }
      return o;
    };
  var il,
    ol,
    al,
    pt = m.createElement('canvas'),
    oe = pt.getContext('2d'),
    be = 1,
    Mt,
    Ot,
    It = 0,
    dt,
    Ve = {},
    Ct = null,
    $e = (e) => (Ct = e),
    Je = (e, t, i, p, o) => {
      let s = Ve[t] || ke;
      if (s instanceof Array) {
        let n = te.devicePixelRatio || 1;
        if (il !== e || ol !== n || al !== o) {
          let r = h.round(64 * n) / 64,
            l,
            a,
            f;
          (be = o),
            (be = h.log2(be)),
            (be -= h.floor(be)),
            (l = be),
            (a = h.min(1, 8 * l)),
            (be = h.pow(2, be)),
            (f = (8 * h.SQRT2) / be),
            (il = e),
            (ol = n),
            (al = o),
            (pt.width = pt.height = h.round(64 * r)),
            oe.scale(r, r),
            (oe.fillStyle = s[0]),
            oe.fillRect(0, 0, 64, 64),
            (oe.globalAlpha = 0.25),
            (oe.fillStyle = s[1]),
            oe.fillRect(0, 0, 64, 64),
            (oe.globalAlpha = 0.67),
            (oe.strokeStyle = s[1]),
            oe.beginPath();

          for (let u = 0; u <= 64; u += 16) {
            oe.moveTo(u - 32, u + 32), oe.lineTo(u + 32, u - 32);
          }
          if (((oe.lineWidth = f * (1 - (a - l) / 2)), oe.stroke(), a + l > 0)) {
            oe.beginPath();

            for (let u = 8; u < 64; u += 16) {
              oe.moveTo(u - 32, u + 32), oe.lineTo(u + 32, u - 32);
            }
            (oe.lineWidth = (f * (a + l)) / 2), oe.stroke();
          }
          (Mt = e.createPattern(pt, 'repeat')), (be /= r);
        }
        return (
          (i /= 64 * be * n),
          (i -= h.floor(i)),
          (i *= 64 * be * n),
          Mt.setTransform(new DOMMatrix([be, 0, 0, be, i, p])),
          Mt
        );
      }
      return s;
    },
    sl = (e) => {
      let t = Ve[e] || ke;
      return t instanceof Array
        ? `url('data:image/svg+xml,<svg width="26" height="26" xmlns="http://www.w3.org/2000/svg"><rect width="26" height="26" fill="${t[0]}"/><rect width="26" height="26" fill="${t[1]}" fill-opacity="25%"/><path d="M22.5 -3.5L-3.5 22.5M35.5 9.5L9.5 35.5" stroke="${t[1]}" stroke-opacity="67%" stroke-width="9.19239"/></svg>')`
        : t;
    },
    dl = (e, t) => {
      if (Ot !== e) {
        let i = e.outputs;
        (Ot = e), (It = 0), (dt = { r: '', e: '', t: 0, n: {} });
        for (let p in i) {
          if (Te(p)) {
            continue;
          }
          let s = i[p].inputs;

          for (let n in s) {
            we(dt, Se(n), s[n].bytesInOutput);
          }
        }
      }
      It !== t &&
        ((It = t),
        (Ve = {}),
        (Me.innerHTML = ''),
        t === 1 ? pl(Ve, dt, 0, h.PI * 2) : t === 2 && (ul(Ve, dt), (Me.innerHTML = Ql)),
        Ct && Ct());
    },
    pl = (e, t, i, p) => {
      let o = t.t,
        s = t.n,
        n = [];
      e[t.e] = it(i + p / 2);

      for (let r in s) {
        n.push(s[r]);
      }
      for (let r of n.sort(ve)) {
        let l = (r.t / o) * p;
        pl(e, r, i, l), (i += l);
      }
    },
    qe = it(3.5),
    Ke = it(1),
    ke = '#CCC',
    Kl = [qe, Ke],
    Zl = (e) => (e ? (e === 1 ? qe : e === 2 ? Ke : Kl) : ke),
    Ee = (e, t) => {
      let i = Ve[e] || ke;
      return i === ke ? '' : i === Ke ? t + 'ESM' : i === qe ? t + 'CJS' : t + 'ESM & CJS';
    },
    ul = (e, t) => {
      let i = t.n,
        p = 0,
        o = !1;

      for (let s in i) {
        (p |= ul(e, i[s])), (o = !0);
      }
      if (!o) {
        let s = Ot.inputs[t.e],
          n = s && s.format;
        p = n === 'esm' ? 2 : n === 'cjs' ? 1 : 0;
      }
      return (e[t.e] = Zl(p)), p;
    },
    Me = m.createElement('div'),
    Ql =
      `<span class="${st}" style="background:` +
      Ke +
      `"></span>ESM <small>modern, faster, smaller</small><span class="${st}" style="background:` +
      qe +
      `"></span>CommonJS <small>legacy, slower, larger</small><span class="${st}" style="background:` +
      ke +
      '"></span>Other';
  Me.id = nl;
  var fl = m.getElementById('summaryPanel'),
    ml = (e) => (e === 1 ? 'file' : 'files'),
    cl = (e, t) => {
      let i = e.inputs,
        p = e.outputs,
        o = 0,
        s = 0,
        n = 0,
        r = 0,
        l = 0,
        a = 0,
        f = 0,
        u,
        N,
        H;
      for (let x in i) {
        let P = i[x],
          I = P.format;
        I === 'esm' ? (l += P.bytes) : I === 'cjs' ? (a += P.bytes) : (f += P.bytes),
          o++,
          (n += P.bytes);
      }

      for (let x in p) {
        Te(x) || (s++, (r += p[x].bytes));
      }
      (u = h.round((200 * l) / n)),
        (N = h.round((200 * a) / n)),
        (fl.innerHTML =
          '<table><tr><td><h2>' +
          z(ae(n)) +
          '</h2>' +
          z(_e(o)) +
          ' input ' +
          ml(o) +
          `</td><td class="${tl}">&rarr;</td><td><h2>` +
          z(ae(r)) +
          '</h2>' +
          z(_e(s)) +
          ' output ' +
          ml(s) +
          '</td></tr></table>' +
          (l || a
            ? `<a href="javascript:void 0" class="${St}"><span class="${wt}">` +
              _e(h.round((100 * a) / n)) +
              `% CJS</span><div class="${ll}"><div style="background:` +
              qe +
              ';width:' +
              N +
              'px"></div><div style="background:#CCC;width:' +
              (200 - u - N) +
              'px"></div><div style="background:' +
              Ke +
              ';width:' +
              u +
              `px"></div></div><span class="${wt}">` +
              _e(h.round((100 * l) / n)) +
              '% ESM</span></a>'
            : '')),
        (H = fl.querySelector('.' + St)),
        H && (H.onclick = t);
    };
  var hl = 's';
  var gl = 'b',
    bl = 'm',
    yl = 'h',
    Tl = 'f',
    xl = 'u';
  var Lt = 'w',
    Ae = 'k',
    vl = 'e',
    El = 'i';
  var De = m.createElement('div'),
    Nl,
    Pt,
    ut = null,
    Sl = /^\w[\w\d]*$/,
    Ze = () => De.parentElement !== null,
    tt = () => {
      De.remove(), ut && (ut.focus(), (ut = null));
    },
    rr = (e) => {
      let t = e.inputs,
        i = e.outputs,
        p = {},
        o = {},
        s = [],
        n = {};
      for (let l in i) {
        let a = i[l],
          f = a.entryPoint;
        if (f) {
          (p[f] = l), s.push(l);

          for (let u of a.imports) {
            !u.external && !Pe.call(n, u.path) && (n[u.path] = !0);
          }
        }
      }
      let r = [];
      for (let l of s) {
        let a = i[l].entryPoint;
        Pe.call(n, l) || ((o[a] = { e: a, h: void 0, o: 'entry-point', s: void 0 }), r.push(a));
      }

      if (!r.length) {
        for (let l of s) {
          let a = i[l].entryPoint;
          (o[a] = { e: a, h: void 0, o: 'entry-point', s: void 0 }), r.push(a);
        }
      }
      for (; r.length > 0; ) {
        let l = [];
        for (let a of r) {
          let f = t[a];

          for (let u of f.imports) {
            !u.external &&
              !Pe.call(o, u.path) &&
              ((o[u.path] = { e: a, h: u.original, o: u.kind, s: u.with }), l.push(u.path));
          }
        }
        r = l;
      }
      return { v: p, E: o };
    },
    Oe = (e, t, i) => {
      let p = e.inputs[t],
        o = m.activeElement;

      if (!p) {
        return;
      }
      (!Pt || Nl !== e) && ((Nl = e), (Pt = rr(e))),
        He && o && o.focus && o.tagName === 'A' && (ut = o);
      let s = m.createElement('div');
      (s.className = bl),
        (s.innerHTML =
          '<h2>' +
          z(t) +
          '</h2><p>Original size: <b>' +
          z(ae(p.bytes)) +
          '</b>' +
          (i === null ? '' : '<br>Bundled size: <b>' + z(ae(i)) + '</b>') +
          (p.format === 'esm'
            ? '<br>Module format: <b>ESM</b>'
            : p.format === 'cjs'
              ? '<br>Module format: <b>CommonJS</b>'
              : '') +
          (p.with
            ? '<br>Import attributes: <b>' +
              z(
                Object.entries(p.with)
                  .map(([r, l]) => (Sl.test(r) ? r : JSON.stringify(r)) + ': ' + JSON.stringify(l))
                  .join(', ')
              ) +
              '</b>'
            : '') +
          '</p>'),
        nr(s, Pt, t);
      let n = m.createElement('a');
      (n.className = yl),
        (n.href = 'javascript:void 0'),
        (n.onclick = tt),
        (n.innerHTML = '&times;'),
        s.append(n),
        (s.tabIndex = 0),
        (De.id = gl),
        (De.innerHTML = ''),
        De.append(s),
        (De.onmousedown = (r) => {
          r.target === De && tt();
        }),
        m.body.append(De),
        s.focus(),
        (s.onkeydown = (r) => {
          r.key === 'Escape' &&
            !r.shiftKey &&
            !r.metaKey &&
            !r.ctrlKey &&
            !r.altKey &&
            (r.preventDefault(), tt());
        });
    },
    nr = (e, t, i) => {
      let p = t.E,
        o = i,
        s = [{ e: i, x: null }];
      for (;;) {
        let a = p[o];

        if (!a) {
          return;
        }

        if (o === a.e) {
          break;
        }
        s.push({ e: a.e, x: { e: o, h: a.h, o: a.o, s: a.s } }), (o = a.e);
      }
      s.reverse();
      let n = t.v,
        r,
        l = 'Entry point';
      e.append('This file is included in the bundle because:');
      for (let a of s) {
        if (Pe.call(n, a.e)) {
          let H = m.createElement('div');
          (r = m.createElement('div')),
            (r.className = Tl),
            (H.className = xl),
            (H.textContent = 'Output file '),
            H.append(xt(n[a.e])),
            r.append(H),
            e.appendChild(r);
        } else if (!r) {
          return;
        }
        let f = Tt(l + ' '),
          u = Tt(` is included in the bundle.
`);
        r.firstChild &&
          r.append(`
`),
          r.append(f, xt(a.e), u);
        let N = a.x;

        if (N) {
          let H = N.h || Zt(N.e) || Kt(N.e, qt(a.e)),
            x = m.createElement('pre'),
            P = m.createElement('span');
          if (((P.className = Pe.call(n, N.e) ? El : vl), N.o === 'import-statement')) {
            x.append(xe(Lt, 'import '), xe(Ae, JSON.stringify(H))),
              N.s && (x.append(xe(Lt, ' with ')), Rt(x, N.s)),
              x.append(';'),
              (l = 'Imported file');
          } else if (N.o === 'require-call') {
            x.append('require(', xe(Ae, JSON.stringify(H)), ');'), (l = 'Required file');
          } else if (N.o === 'dynamic-import') {
            x.append('import(', xe(Ae, JSON.stringify(H))),
              N.s && (x.append(', '), Rt(x, { with: N.s })),
              x.append(');'),
              (l = 'Dynamically-imported file');
          } else if (N.o === 'import-rule') {
            x.append('@import ', xe(Ae, JSON.stringify(H)), ';'), (l = 'Imported stylesheet');
          } else if (N.o === 'url-token') {
            x.append('url(', xe(Ae, JSON.stringify(H)), ')'), (l = 'URL reference');
          } else {
            return;
          }
          (u.textContent = ` contains:
`),
            x.append(
              P,
              `
`
            ),
            r.append(x);
        } else {
          f.textContent = 'So ' + f.textContent.toLowerCase();
        }
      }
    },
    Rt = (e, t) => {
      let i = Object.keys(t);
      if (i.length === 0) {
        e.append('{}');
        return;
      }
      e.append('{ ');
      for (let p = 0; p < i.length; p++) {
        let o = i[p],
          s = t[o];
        p > 0 && e.append(', '),
          e.append(Sl.test(o) ? o : xe(Ae, JSON.stringify(o)), ': '),
          typeof s == 'string' ? e.append(xe(Ae, JSON.stringify(s))) : Rt(e, s);
      }
      e.append(' }');
    };
  var ir = (e) => {
      let t = e.outputs,
        i = 0,
        p = 0,
        o = [],
        s,
        n = (r, l) => {
          let a = r.n,
            f = [];

          for (let u in a) {
            f.push(n(a[u], !1));
          }
          return { r: r.r, e: r.e, p: ae(r.t), t: r.t, l: f.sort(ve), g: l };
        };
      for (let r in t) {
        let l = ge(r);
        l.pop(), (s = Ue(l.join('/'), s));
      }
      for (let r in t) {
        if (Te(r)) {
          continue;
        }
        let a = { r: s ? ge(r).slice(s.length).join('/') : r, e: '', t: 0, n: {} },
          f = t[r],
          u = f.inputs,
          N = f.bytes;
        for (let H in u) {
          let x = we(a, Se(H), u[H].bytesInOutput);
          x > p && (p = x);
        }
        (a.t = N), (i += N), o.push(n(a, !0));
      }
      e: for (;;) {
        let r;
        for (let l of o) {
          let a = l.l;

          if (!a.length) {
            continue;
          }

          if (a.length > 1 || a[0].l.length !== 1) {
            break e;
          }
          let f = a[0].r;

          if (r === void 0) {
            r = f;
          } else if (r !== f) {
            break e;
          }
        }

        if (r === void 0) {
          break;
        }
        for (let l of o) {
          let a = l.l;
          if (a.length) {
            a = a[0].l;

            for (let f of a) {
              f.r = r + f.r;
            }
            l.l = a;
          }
        }
        p--;
      }
      for (let r of o) {
        let l = 0;

        for (let a of r.l) {
          l += a.t;
        }
        l < r.t && r.l.push({ r: '(unassigned)', e: '', p: ae(r.t - l), t: r.t - l, l: [], g: !1 });
      }
      return o.sort(ve), { u: { r: '', e: '', p: '', t: i, l: o, g: !1 }, b: p + 1 };
    },
    Ht = (e, t, i, p, o) => {
      let s = [],
        n = (l, a, f, u, N) => {
          let H = e[l].t * N,
            x = e[a].t * N;
          return h.max((f * f * H) / (u * u), (u * u) / (f * f * x));
        };
      return (
        ((l, a, f, u, N) => {
          for (; l < e.length; ) {
            let H = 0;

            for (let C = l; C < e.length; C++) {
              H += e[C].t;
            }
            let x = h.min(u, N),
              P = (u * N) / H,
              I = l,
              G = 0,
              se = 0;
            for (; I < e.length; ) {
              let C = e[I].t * P,
                k = n(l, I, x, G + C, P);

              if (I > l && se < k) {
                break;
              }
              (G += C), (se = k), I++;
            }
            let X = h.round(G / x),
              J = 0;
            for (let C = l; C < I; C++) {
              let k = e[C],
                U = k.t * P,
                B = h.round((x * J) / G),
                ee = h.round((x * (J + U)) / G),
                [D, E, F, j] = u >= N ? [a, f + B, X, ee - B] : [a + B, f, ee - B, X];
              s.push({
                f: k,
                m: [D, E, F, j],
                n: F > 8 && j > 24 ? Ht(k.l, D + 4, E + 20, F - 8, j - 24) : [],
              }),
                (J += U);
            }
            (l = I), u >= N ? ((a += X), (u -= X)) : ((f += X), (N -= X));
          }
        })(0, t, i, p, o),
        s
      );
    },
    wl = (e) => {
      let t = ir(e),
        i = [],
        p = m.createElement('div'),
        o = m.createElement('main'),
        s = m.createElement('canvas'),
        n = s.getContext('2d'),
        r = 0,
        l = 0,
        a = null,
        f = null,
        u = 0,
        N = 0,
        H = '',
        x = '',
        P = '14px sans-serif',
        I = {},
        G = 'bold ' + P,
        se = {},
        X = 0,
        J = se,
        C = null,
        k = null,
        U = 0,
        B = 0,
        ee = 0,
        D = 1,
        E = null,
        F = null,
        j = () => {
          if (C) {
            let [d, c, b, v] = C.m,
              T = d + b,
              S = c + v,
              R = h.round(r / 10),
              _ = h.round(l / 10),
              W = r - R - 1,
              A = l - _ - 1,
              Q = F ? D : 1 - D,
              le = h.round(d + (R - d) * Q),
              pe = h.round(c + (_ - c) * Q),
              $ = h.round(T + (W - T) * Q),
              ue = h.round(S + (A - S) * Q),
              Ne = (jt) => jt - h.floor(jt / 64 - 0.5) * 64;
            (k = Ht([C.f], le, pe, $ - le, ue - pe)[0]),
              (U = Ne(-(d + T) / 2) * (1 - Q) + (le + $) / 2),
              (B = Ne(-(c + S) / 2) * (1 - Q) + (pe + ue) / 2);
          } else {
            (k = null), (U = 0), (B = 0);
          }
        },
        Y = () => {
          let d = r,
            c = l,
            b = te.devicePixelRatio || 1;
          (r = h.min(o.clientWidth, 1600)),
            (l = h.max(h.round(r / 2), innerHeight - 380)),
            (s.style.width = r + 'px'),
            (s.style.height = l + 'px'),
            (o.style.height = l + 'px'),
            (s.width = h.round(r * b)),
            (s.height = h.round(l * b)),
            n.scale(b, b),
            (r !== d || l !== c) && ((i = Ht(t.u.l, 0, 0, r - 1, l - 1)), j()),
            fe();
        },
        ce = () => {
          let d = D,
            c = C;
          (D = (Re() - ee) / 350),
            D < 0 || D > 1
              ? ((C = F), (D = 1), (a = null))
              : ((D = 1 - D), (D *= D * D), (D = 1 - D), (a = ie(ce))),
            (D !== d || C !== c) && j(),
            fe();
        },
        q = () => {
          a === null && (a = ie(ce));
        },
        re = (d) => {
          let c = J[d];
          return c === void 0 && ((c = n.measureText(String.fromCharCode(d)).width), (J[d] = c)), c;
        },
        K = (d, c) => {
          if (c < X) {
            return ['', 0];
          }
          let b = 0,
            v = d.length,
            T = 0;
          for (; T < v; ) {
            let S = re(d.charCodeAt(T));

            if (c < b + X + S) {
              return [d.slice(0, T) + '...', b + X];
            }
            (b += S), T++;
          }
          return [d, b];
        },
        Z = (d, c) => {
          let b = d.f,
            [v, T, S, R] = d.m,
            _ = (b === f ? 1 : 0) | (d === F ? 2 : 0);
          if (c === 1 && k) {
            let [W, A, Q, le] = k.m;
            v >= W && T >= A && v + S <= W + Q && T + R <= A + le && (c = 2);
          }

          for (let W of d.n) {
            _ |= Z(W, c);
          }
          return (
            c !== 2 &&
              !b.g &&
              ((n.fillStyle = Je(n, b.e, u, N, 1)),
              d.n.length
                ? (n.fillRect(v, T, S, 20),
                  n.fillRect(v, T + R - 4, S, 4),
                  n.fillRect(v, T + 20, 4, R - 24),
                  n.fillRect(v + S - 4, T + 20, 4, R - 24))
                : n.fillRect(v, T, S, R)),
            _
          );
        },
        de = (d, c) => {
          let b = d.f,
            [v, T, S, R] = d.m,
            _ = b.g;
          if (
            (f === b &&
              !_ &&
              (!C || c) &&
              ((n.fillStyle = 'rgba(255,255,255,0.5)'), n.fillRect(v, T, S, R)),
            _ || ot(n, '#222', v + 0.5, T + 0.5, S, R),
            R >= 20)
          ) {
            (n.fillStyle = _ ? x : '#000'), _ && ((n.font = G), (J = I), (X = 3 * re(46)));
            let W = S - 8,
              A = T + h.round(24 / 2),
              [Q, le] = K(b.r, W),
              pe = v + h.round((S - le) / 2);
            if ((_ && ((n.font = P), (J = se), (X = 3 * re(46))), Q === b.r && b.l.length)) {
              let $ = ' \u2013 ' + (me === 2 ? Ee(b.e, '') : b.p),
                [ue, Ne] = K($, W - le);
              (pe = v + h.round((S - le - Ne) / 2)),
                (n.globalAlpha = 0.5),
                n.fillText(ue, pe + le, A),
                (n.globalAlpha = 1);
            }
            if (
              (_ && ((n.font = G), (J = I), (X = 3 * re(46))),
              n.fillText(Q, pe, A),
              _ && ((n.font = P), (J = se), (X = 3 * re(46))),
              R > 40 && !b.l.length)
            ) {
              let $ = me === 2 ? Ee(b.e, '') : b.p,
                [ue, Ne] = K($, W);
              (n.globalAlpha = 0.5),
                n.fillText(ue, v + h.round((S - Ne) / 2), T + 20 + h.round(R - 24) / 2),
                (n.globalAlpha = 1);
            }

            for (let $ of d.n) {
              de($, c);
            }
          }
        },
        fe = () => {
          let d = getComputedStyle(m.body);
          (H = d.getPropertyValue('--bg')),
            (x = d.getPropertyValue('--fg-on')),
            (a = null),
            n.clearRect(0, 0, r, l),
            (n.textBaseline = 'middle'),
            (X = n.measureText('...').width);
          let c = null,
            b = null,
            v = k ? (E ? (F ? 1 : 1 - D) : D) : 0;
          u = N = 0;
          for (let T of i) {
            let S = Z(T, 1);
            S & 1 && (c = T), S & 2 && (b = T);
          }

          for (let T of i) {
            if ((de(T, !1), k || (c && T !== c))) {
              let [S, R, _, W] = T.m;
              (n.globalAlpha = 0.6 * (!k || (!E && b && T !== b) ? 1 : v)),
                (n.fillStyle = H),
                n.fillRect(S, R, _, W),
                (n.globalAlpha = 1);
            }
          }
          if (k) {
            let [T, S, R, _] = k.m,
              W = n.getTransform(),
              A = h.sqrt(W.a * W.d);
            n.save(),
              (n.shadowColor = 'rgba(0,0,0,0.5)'),
              (n.shadowBlur = A * (30 * v)),
              (n.shadowOffsetX = A * (2 * r)),
              (n.shadowOffsetY = A * (2 * l + 15 * v)),
              n.fillRect(T - 2 * r, S - 2 * l, R, _),
              n.restore(),
              (u = U),
              (N = B),
              Z(k, 0),
              de(k, !0);
          }
        },
        ne = m.createElement('div'),
        Le = (d, c, b) => {
          (ne.style.display = 'block'),
            (ne.style.left = d + 'px'),
            (ne.style.top = c + 'px'),
            (ne.innerHTML = b);
          let v = ne.offsetWidth;

          for (let T = ne; T; T = T.offsetParent) {
            v += T.offsetLeft;
          }
          v > r && (ne.style.left = d + r - v + 'px');
        },
        y = () => {
          ne.style.display = 'none';
        },
        w = (d) => {
          let c = (T, S) => {
              for (let R of T) {
                let [_, W, A, Q] = R.m;

                if (b >= _ && v >= W && b < _ + A && v < W + Q) {
                  return c(R.n, !1) || (S ? null : R);
                }
              }
              return null;
            },
            b = d.pageX,
            v = d.pageY;

          for (let T = s; T; T = T.offsetParent) {
            (b -= T.offsetLeft), (v -= T.offsetTop);
          }
          return k ? c([k], !1) : c(i, !0);
        },
        L = (d) => {
          let c = w(d);

          if ((O(c && c.f), c)) {
            let b = c.f,
              v = b.r === b.e ? We(b.e) : b.e,
              T = v.length - b.r.length;
            (v = z(v.slice(0, T)) + '<b>' + z(v.slice(T)) + '</b>'),
              (v += me === 2 ? z(Ee(b.e, ' \u2013 ')) : ' \u2013 ' + z(ae(b.t))),
              Le(d.pageX, d.pageY + 20, v);
          } else {
            y();
          }
        },
        O = (d) => {
          f !== d && ((f = d), (s.style.cursor = d && !d.l.length ? 'pointer' : 'auto'), q());
        },
        M = (d, c) => {
          for (let b of d) {
            let v = b.f === c ? b : M(b.n, c);

            if (v) {
              return v;
            }
          }
          return null;
        },
        V = (d) => {
          C !== d && ((D = 0), (ee = Re()), (E = C), (F = d), (C = d || M(i, C.f)), j(), q());
        };
      (s.onmousemove = (d) => {
        L(d);
      }),
        (s.onmouseout = (d) => {
          O(null), y();
        }),
        (p.onclick = (d) => {
          let c = w(d);

          if (c) {
            let b = c.f;
            b.l.length ? (c !== k ? (V(c), O(null), y()) : L(d)) : (Oe(e, b.e, b.t), L(d));
          } else {
            C && (V(null), L(d));
          }
        }),
        je((d) => {
          Ze() || L(d);
        }),
        Y(),
        Promise.resolve().then(Y),
        Xe(fe),
        $e(fe),
        Ye(Y),
        (p.id = hl),
        (p.innerHTML = `<div class="${Be}"><p>This visualization shows which input files were placed into each output file in the bundle. Click on a node to expand and focus it.</p><p><b>Benefit of this chart type:</b> Makes the most of available screen area.</p></div>`),
        (ne.className = ze),
        o.append(s),
        p.append(o, ne);
      let g = m.createElement('section');
      return g.append(Me), p.append(g), p;
    };
  var Ml = 'y',
    Il = 'z',
    Ol = 'F',
    Cl = 'P',
    Ll = 'C',
    Pl = 'S',
    At = 'j';
  var Rl = 't',
    Dt = 'M',
    Ft = 'N',
    Hl = 'q',
    kl = 'T';
  var Al = (e, t) => {
      for (; t; ) {
        if (t === e) {
          return !0;
        }
        t = t.i;
      }
      return !1;
    },
    ar = (e) => {
      let t = e.inputs,
        i = e.outputs,
        p = { r: '', e: '', t: 0, n: {} },
        o = (r) => {
          let l = r.n,
            a = [];

          for (let f in l) {
            a.push(o(l[f]));
          }
          return { e: r.e, t: r.t, l: a.sort(ve), i: null };
        },
        s = (r, l) => {
          let a = 0;
          for (let f of r.l) {
            let u = s(f, l + 1);
            (f.i = r), u > a && (a = u);
          }
          return a + 1;
        };

      for (let r in t) {
        we(p, Se(r), 0);
      }
      for (let r in i) {
        if (Te(r)) {
          continue;
        }
        let a = i[r].inputs;

        for (let f in a) {
          we(p, Se(f), a[f].bytesInOutput);
        }
      }
      let n = o(p);

      for (; n.l.length === 1; ) {
        n = n.l[0];
      }
      return { u: n, b: s(n, 0) };
    },
    _t = (e, t, i) => {
      if (e === t) {
        return;
      }
      let p = t.i,
        o = p.t || 1,
        s = 0;
      _t(e, p, i);
      for (let n of p.l) {
        if (n === t) {
          (i.y += (i.c * s) / o), (i.c = (n.t / o) * i.c);
          break;
        }
        s += n.t;
      }
      i.T += 1;
    },
    Qe = (e) => 50 * 8 * h.log(1 + h.log(1 + e / 8)),
    Dl = (e) => {
      let t = m.createElement('div'),
        i = m.createElement('main'),
        p = ar(e),
        o = p.u,
        s = null,
        n = (x) => {
          o !== x && ((o = x), u(), H());
        },
        r = (x) => {
          s !== x && ((s = x), u(), H());
        },
        l = () => {
          let x = m.createElement('div'),
            P = m.createElement('canvas'),
            I = P.getContext('2d'),
            G = () => {
              let g = 2 * h.ceil(Qe(p.b)),
                d = te.devicePixelRatio || 1;
              (C = h.min(h.round(innerWidth * 0.4), g)),
                (k = C),
                (U = C >> 1),
                (B = k >> 1),
                (P.style.width = C + 'px'),
                (P.style.height = k + 'px'),
                (P.width = h.round(C * d)),
                (P.height = h.round(k * d)),
                I.scale(d, d),
                X();
            },
            se = (g, d, c, b, v, T, S) => {
              let R = Qe(d + 1);

              if (R > B) {
                return S;
              }
              g === s && (T |= 8);
              let _ = (c + R) / 2,
                W = b + v;

              if (W - S < 1.5 / _) {
                return S;
              }
              let A = 2 / _;

              if ((v > A && (A = v), T & 2)) {
                (I.fillStyle = Je(I, g.e, U, B, 1)),
                  I.beginPath(),
                  I.arc(U, B, c, b, b + A, !1),
                  I.arc(U, B, R, b + A, b, !0),
                  I.fill(),
                  s &&
                    (T & 8 || g.i === s) &&
                    ((I.fillStyle = 'rgba(255, 255, 255, 0.3)'), I.fill());
              } else {
                let ue = A === h.PI * 2,
                  Ne = T & 4 || ue ? R : c;
                T & 1 && c > 0 && I.arc(U, B, c, b + A, b, !0),
                  I.moveTo(U + Ne * h.cos(b), B + Ne * h.sin(b)),
                  I.arc(U, B, R, b, b + A, !1),
                  ue || I.lineTo(U + c * h.cos(b + A), B + c * h.sin(b + A));
              }
              let Q = g.t,
                le = T & 10,
                pe = 0,
                $ = -1 / 0;

              for (let ue of g.l) {
                ($ = se(ue, d + 1, R, b + (v * pe) / Q, (ue.t / Q) * v, le, $)),
                  (pe += ue.t),
                  (le |= 4);
              }
              return W;
            },
            X = () => {
              I.clearRect(0, 0, C, k),
                se(K, Z, Qe(Z), de, fe, 3, -1 / 0),
                (I.strokeStyle = '#222'),
                I.beginPath(),
                se(K, Z, Qe(Z), de, fe, 1, -1 / 0),
                I.stroke(),
                Z === 0 &&
                  ((I.fillStyle = '#222'),
                  (I.font = 'bold 16px sans-serif'),
                  (I.textAlign = 'center'),
                  (I.textBaseline = 'middle'),
                  I.fillText(ae(Y.t), U, B));
            },
            J = -h.PI / 2,
            C = 0,
            k = 0,
            U = 0,
            B = 0,
            ee = null,
            D = 0,
            E = 0,
            F = J,
            j = h.PI * 2,
            Y = o,
            ce = E,
            q = F,
            re = j,
            K = o,
            Z = E,
            de = F,
            fe = j,
            ne = (g) => {
              let d = (S, R, _, W, A) => {
                  let Q = Qe(R + 1);

                  if (Q > B) {
                    return null;
                  }
                  if (v >= _ && v < Q) {
                    let $ = T - W;

                    if ((($ /= h.PI * 2), ($ -= h.floor($)), ($ *= h.PI * 2), $ < A)) {
                      return S === K ? S.i : S;
                    }
                  }
                  let le = S.t,
                    pe = 0;
                  for (let $ of S.l) {
                    let ue = d($, R + 1, Q, W + (A * pe) / le, ($.t / le) * A);

                    if (ue) {
                      return ue;
                    }
                    pe += $.t;
                  }
                  return null;
                },
                c = g.pageX,
                b = g.pageY;

              for (let S = P; S; S = S.offsetParent) {
                (c -= S.offsetLeft), (b -= S.offsetTop);
              }
              (c -= U), (b -= B);
              let v = h.sqrt(c * c + b * b),
                T = h.atan2(b, c);
              return d(K, Z, Qe(Z), de, fe);
            },
            Le = () => {
              let g = (Re() - D) / 350;
              g < 0 || g > 1
                ? ((g = 1), (ee = null), (K = Y), (ce = 0), (q = J), (re = h.PI * 2))
                : (g < 0.5 ? (g *= 4 * g * g) : ((g = 1 - g), (g *= 4 * g * g), (g = 1 - g)),
                  (ee = ie(Le))),
                (Z = E + (ce - E) * g),
                (de = F + (q - F) * g),
                (fe = j + (re - j) * g),
                X();
            },
            y = m.createElement('div'),
            w = (g, d, c) => {
              (y.style.display = 'block'),
                (y.style.left = g + 'px'),
                (y.style.top = d + 'px'),
                (y.innerHTML = c);
            },
            L = () => {
              y.style.display = 'none';
            },
            O = null,
            M = [],
            V = (g) => {
              let d = ne(g);

              if ((r(d), d && d !== K.i)) {
                let c = d.e;
                if (d.i && d.i.e !== '') {
                  let b = d.i.e.length;
                  c = z(c.slice(0, b)) + '<b>' + z(c.slice(b)) + '</b>';
                } else {
                  c = '<b>' + z(We(c)) + '</b>';
                }
                me === 2 ? (c += z(Ee(d.e, ' \u2013 '))) : (c += ' \u2013 ' + z(ae(d.t))),
                  w(g.pageX, g.pageY + 20, c),
                  (P.style.cursor = 'pointer');
              } else {
                L();
              }
            };
          return (
            G(),
            Xe(X),
            Ye(G),
            je((g) => {
              Ze() || V(g);
            }),
            (P.onmousemove = (g) => {
              V(g);
            }),
            (P.onmouseout = () => {
              r(null), L();
            }),
            (P.onclick = (g) => {
              let d = ne(g);

              if (!d) {
                return;
              }
              L();
              let c = [];
              d !== K.i ? (c = M.concat(o)) : M.length > 0 && ((d = M.pop()), (c = M.slice())),
                d.l.length > 0 ? (n(d), (M = c)) : (g.preventDefault(), Oe(e, d.e, d.t));
            }),
            (x.className = Il),
            x.append(P, Me),
            (y.className = ze),
            i.append(y, x),
            [
              X,
              () => {
                if (
                  (O !== s &&
                    ((O = s), s || ((P.style.cursor = 'auto'), L()), ee === null && (ee = ie(Le))),
                  Y !== o)
                ) {
                  if (((M.length = 0), ee === null && (ee = ie(Le)), (D = Re()), Al(K, o))) {
                    let g = { T: Z, y: de, c: fe };
                    _t(K, o, g),
                      (Z = g.T),
                      (de = g.y),
                      (fe = g.c),
                      (ce = 0),
                      (q = J),
                      (re = h.PI * 2),
                      (K = o);
                  } else if (Al(o, K)) {
                    let g = { T: 0, y: J, c: h.PI * 2 };
                    _t(o, K, g), (ce = g.T), (q = g.y), (re = g.c);
                  } else {
                    (D = -1 / 0), (K = o);
                  }
                  (E = Z), (F = de), (j = fe), (Y = o);
                }
              },
            ]
          );
        },
        a = () => {
          let x = m.createElement('div'),
            P = () => {
              let C = o.i,
                k = o.l,
                U = m.createElement('div'),
                B = 1;
              U.className = Pl;
              for (let E of k) {
                let F = E.t;
                F > B && (B = F);
              }
              if (((I.length = 0), (G.length = 0), C)) {
                let E = m.createElement('a');
                (E.className = At), (E.tabIndex = 0), U.append(E);
                let F = m.createElement('div');
                (F.className = Dt), E.append(F);
                let j = m.createElement('div');
                (j.className = Ft),
                  E.append(j),
                  (E.href = 'javascript:void 0'),
                  (F.textContent = '../'),
                  (E.onclick = () => {
                    n(C), He && G.length > 0 && G[0].focus();
                  }),
                  (E.onfocus = E.onmouseover = () => r(C)),
                  (E.onblur = E.onmouseout = () => r(null)),
                  I.push(C),
                  G.push(E);
              }
              for (let E of k) {
                let F = E.e.slice(o.e.length),
                  j = ae(E.t),
                  Y = m.createElement('a');
                (Y.className = At), (Y.tabIndex = 0), U.append(Y);
                let ce = m.createElement('div');
                (ce.className = Dt), (ce.innerHTML = z(F === E.e ? We(F) : F)), Y.append(ce);
                let q = m.createElement('div');
                (q.className = Ft), Y.append(q);
                let re = m.createElement('div'),
                  K = sl(E.e);
                (re.className = Rl + (E.t ? '' : ' ' + Hl)),
                  (re.style.background = K),
                  (re.style.width = (100 * E.t) / B + '%'),
                  q.append(re);
                let Z = m.createElement('div');
                (Z.className = kl),
                  (Z.textContent = me === 2 ? Ee(E.e, '') : j),
                  re.append(Z),
                  (Y.href = 'javascript:void 0'),
                  (Y.onclick = (de) => {
                    de.preventDefault(),
                      E.l.length > 0 ? (n(E), He && G.length > 0 && G[0].focus()) : Oe(e, E.e, E.t);
                  }),
                  (Y.onfocus = Y.onmouseover = () => r(E)),
                  (Y.onblur = Y.onmouseout = () => r(null)),
                  I.push(E),
                  G.push(Y);
              }
              let ee = m.createElement('div');
              (ee.className = Cl), (ee.textContent = 'Directory: ');
              let D = m.createElement('div');
              (D.className = Ll), ee.append(D);
              for (let E = o; E; E = E.i) {
                let F = E.e || '/',
                  j = m.createElement('a');
                E.i && (F = F.slice(E.i.e.length)),
                  (j.textContent = F),
                  E !== o &&
                    ((j.href = 'javascript:void 0'),
                    (j.onclick = (Y) => {
                      Y.preventDefault(),
                        n(E),
                        He && G.length > 0 && G[!I[0] && G.length > 1 ? 1 : 0].focus();
                    })),
                  D.insertBefore(j, D.firstChild),
                  o == p.u && ((j.tabIndex = -1), I.unshift(o), G.unshift(j));
              }
              (x.innerHTML = ''), x.append(ee, U);
            },
            I = [],
            G = [],
            se = o,
            X = null,
            J = null;
          return (
            (x.className = Ol),
            i.append(x),
            P(),
            [
              P,
              () => {
                if ((se !== o && ((se = o), P()), X !== s)) {
                  (X = s), J && (J.classList.remove('hover'), (J = null));
                  for (let C = s; C; C = C.i) {
                    let k = I.indexOf(C);
                    if (k >= 0) {
                      (J = G[k]), J.classList.add('hover');
                      break;
                    }
                  }
                }
              },
            ]
          );
        },
        [f, u] = l(),
        [N, H] = a();
      return (
        $e(() => {
          f(), N();
        }),
        (t.id = Ml),
        (t.innerHTML = `<div class="${Be}"><p>This visualization shows how much space each input file takes up in the final bundle. Input files that take up 0 bytes have been completely eliminated by tree-shaking.</p><p><b>Benefit of this chart type:</b> Can be navigated with the keyboard.</p></div>`),
        t.append(i),
        t
      );
    };
  var Fl = 'A';
  var pr = (e) => {
      let t = e.outputs,
        i = 0,
        p = 0,
        o = [],
        s,
        n = (l) => ' \u2013 ' + ae(l),
        r = (l) => {
          let a = l.n,
            f = [];

          for (let u in a) {
            f.push(r(a[u]));
          }
          return { r: l.r, e: l.e, p: n(l.t), t: l.t, l: f.sort(ve) };
        };
      for (let l in t) {
        let a = ge(l);
        a.pop(), (s = Ue(a.join('/'), s));
      }
      for (let l in t) {
        if (Te(l)) {
          continue;
        }
        let f = { r: s ? ge(l).slice(s.length).join('/') : l, e: '', t: 0, n: {} },
          u = t[l],
          N = u.inputs,
          H = u.bytes;
        for (let x in N) {
          let P = we(f, Se(x), N[x].bytesInOutput);
          P > p && (p = P);
        }
        (f.t = H), (i += H), o.push(r(f));
      }
      e: for (;;) {
        let l;
        for (let a of o) {
          let f = a.l;

          if (!f.length) {
            continue;
          }

          if (f.length > 1 || f[0].l.length !== 1) {
            break e;
          }
          let u = f[0].r;

          if (l === void 0) {
            l = u;
          } else if (l !== u) {
            break e;
          }
        }

        if (l === void 0) {
          break;
        }
        for (let a of o) {
          let f = a.l;
          if (f.length) {
            f = f[0].l;

            for (let u of f) {
              u.r = l + u.r;
            }
            a.l = f;
          }
        }
        p--;
      }
      for (let l of o) {
        let a = 0;

        for (let f of l.l) {
          a += f.t;
        }
        a < l.t && l.l.push({ r: '(unassigned)', e: '', p: n(l.t - a), t: l.t - a, l: [] });
      }
      return o.sort(ve), { u: { r: '', e: '', p: '', t: i, l: o }, b: p + 1 };
    },
    _l = (e) => {
      let t = pr(e),
        i = t.u.t,
        p = 0,
        o = i,
        s = m.createElement('div'),
        n = m.createElement('main'),
        r = m.createElement('canvas'),
        l = r.getContext('2d'),
        a = 0,
        f = 0,
        u = 0,
        N = 0,
        H = 0,
        x = !1,
        P = 1,
        I = null,
        G = null,
        se = '',
        X = '14px sans-serif',
        J = {},
        C = 'bold ' + X,
        k = {},
        U = 0,
        B = k,
        ee = (y) => {
          G !== y &&
            ((G = y), (r.style.cursor = y && !y.l.length ? 'pointer' : 'auto'), y || K(), ce());
        },
        D = (y) => {
          let w = B[y];
          return w === void 0 && ((w = l.measureText(String.fromCharCode(y)).width), (B[y] = w)), w;
        },
        E = () => {
          let y = te.devicePixelRatio || 1;
          (a = s.clientWidth + 2 * 50),
            (f = t.b * 24 + 1),
            (u = (a - 1e3) >> 1),
            (N = u + 1e3),
            u < 0 && (u = 0),
            N > a && (N = a),
            (N -= u),
            (P = i / N),
            (r.style.width = a + 'px'),
            (r.style.height = f + 'px'),
            (n.style.height = f + 'px'),
            (r.width = h.round(a * y)),
            (r.height = h.round(f * y)),
            l.scale(y, y),
            Y();
        },
        F = (y, w) => {
          let L = U,
            O = y.length,
            M = 0;

          for (; M < O && ((L += D(y.charCodeAt(M))), !(L > w)); ) {
            M++;
          }
          return y.slice(0, M) + '...';
        },
        j = (y, w, L, O, M) => {
          let V = N / (o - p),
            g = u + (L - p) * V,
            d = y.t * V,
            c = g + d;

          if (c < O + 1.5) {
            return O;
          }

          if (g + d < 0 || g > a) {
            return c;
          }
          let b = d < 2 ? 2 : d,
            v = (g > 0 ? g : 0) + 5,
            T = w + 24 / 2,
            S = '',
            R = '',
            _,
            W = 0,
            A = d + g - v,
            Q = y.e ? Je(l, y.e, u - p * V, 24, V * P) : ke,
            le = 'black',
            pe = -1 / 0;
          M & 1
            ? ((le = se), (l.font = C), (B = J), (U = 3 * D(46)))
            : ((l.fillStyle = Q),
              l.fillRect(g, w, b, 24),
              (M & 2 || (G && y.e === G.e)) &&
                ((l.fillStyle = 'rgba(255, 255, 255, 0.3)'), l.fillRect(g, w, b, 24), (M |= 2))),
            U < A &&
              ((S = y.r),
              (_ = l.measureText(S).width),
              _ <= A ? (W += _) : ((S = F(S, A)), (W = A)),
              (l.fillStyle = le),
              l.fillText(S, v, T)),
            M & 1 && ((l.font = X), (B = k), (U = 3 * D(46))),
            W + U < A &&
              ((R = me === 2 ? Ee(y.e, ' \u2013 ') : y.p),
              (_ = l.measureText(R).width),
              W + _ > A && (R = F(R, A - W)),
              (l.globalAlpha = 0.5),
              l.fillText(R, v + W, T),
              (l.globalAlpha = 1));

          for (let $ of y.l) {
            (pe = j($, w + 24, L, pe, M & -2)), (L += $.t);
          }
          return M & 1 || ot(l, '#222', g + 0.5, w + 0.5, b, 24), c;
        },
        Y = () => {
          let y = getComputedStyle(m.body),
            w = 0,
            L = -1 / 0;
          (I = null),
            (se = y.getPropertyValue('--fg-on')),
            l.clearRect(0, 0, a, f),
            (l.textBaseline = 'middle');

          for (let O of t.u.l) {
            (L = j(O, 0, w, L, 1)), (w += O.t);
          }
        },
        ce = () => {
          I === null && (I = ie(Y));
        },
        q = m.createElement('div'),
        re = (y, w, L) => {
          (q.style.display = 'block'),
            (q.style.left = y + 'px'),
            (q.style.top = w + 'px'),
            (q.innerHTML = L);
          let O = q.offsetWidth;

          for (let M = q; M; M = M.offsetParent) {
            O += M.offsetLeft;
          }
          O > a && (q.style.left = y + a - O + 'px');
        },
        K = () => {
          q.style.display = 'none';
        },
        Z = (y) => {
          let w = (g, d, c) => {
              if (M >= c && M < c + g.t) {
                if (O >= d && O < d + 24 && g.e) {
                  return g;
                }

                if (O >= d + 24) {
                  for (let b of g.l) {
                    let v = w(b, d + 24, c);
                    if (v) {
                      return v;
                    }
                    c += b.t;
                  }
                }
              }
              return null;
            },
            L = y.pageX,
            O = y.pageY;

          for (let g = r; g; g = g.offsetParent) {
            (L -= g.offsetLeft), (O -= g.offsetTop);
          }
          let M = p + ((o - p) / N) * (L - u),
            V = 0;
          for (let g of t.u.l) {
            let d = w(g, 0, V);

            if (d) {
              return d;
            }
            V += g.t;
          }
          return null;
        },
        de = (y, w, L) => {
          let O = p,
            M = o,
            V = 0;

          if (L !== null) {
            let g = O + ((M - O) / N) * (L - u),
              d = h.pow(1.01, w);
            (O = g + (O - g) * d), (M = g + (M - g) * d);
          } else {
            V = (y * (M - O)) / N;
          }
          O + V < 0 ? (V = -O) : M + V > i && (V = i - M),
            (O += V),
            (M += V),
            O < 0 && (O = 0),
            M > i && (M = i),
            (p !== O || o !== M) && ((p = O), (o = M), ce());
        },
        fe = (y) => {
          let w = Z(y);

          if ((ee(w), w)) {
            let L = w.r === w.e ? We(w.e) : w.e,
              O = L.length - w.r.length;
            (L = z(L.slice(0, O)) + '<b>' + z(L.slice(O)) + '</b>'),
              (L += me === 2 ? z(Ee(w.e, ' \u2013 ')) : ' \u2013 ' + z(ae(w.t))),
              re(y.pageX, y.pageY + 20, L);
          } else {
            K();
          }
        },
        ne = !1;
      (r.onmousedown = (y) => {
        if (((ne = !1), y.button !== 2)) {
          let w = y.pageX,
            L = (M) => {
              let V = M.pageX - w;
              (!ne && h.abs(V) < 3) || ((ne = !0), de(-V, 0, null), (w = M.pageX));
            },
            O = () => {
              m.removeEventListener('mousemove', L), m.removeEventListener('mouseup', O);
            };
          y.preventDefault(), m.addEventListener('mousemove', L), m.addEventListener('mouseup', O);
        }
      }),
        (r.onmousemove = (y) => {
          fe(y);
        }),
        (r.onmouseout = (y) => {
          ee(null);
        }),
        (r.onclick = (y) => {
          if (ne) {
            return;
          }
          let w = Z(y);
          ee(w), w && !w.l.length && Oe(e, w.e, w.t);
        }),
        je((y) => {
          if (Ze()) {
            return;
          }
          let w = y.deltaX,
            L = y.deltaY,
            O = Re(),
            M = O - H < 50 ? x : y.ctrlKey || y.metaKey;
          (H = O),
            (x = M),
            (M || h.abs(w) >= h.abs(L)) && y.preventDefault(),
            de(w, L, M ? y.pageX : null),
            fe(y);
        }),
        E(),
        Promise.resolve().then(E),
        Xe(Y),
        $e(Y),
        Ye(E),
        (s.id = Fl),
        (s.innerHTML =
          `<div class="${Be}"><p>This visualization shows which input files were placed into each output file in the bundle. Use the scroll wheel with the ` +
          ($t ? 'command' : 'control') +
          ' key to zoom in and out.</p><p><b>Benefit of this chart type:</b> Best chart for quick mouse navigation.</p></div>'),
        (q.className = ze),
        n.append(r),
        s.append(n, q);
      let Le = m.createElement('section');
      return Le.append(Me), s.append(Le), s;
    };
  var Wl = 'B',
    Bl = 'D',
    zl = 'E',
    Wt = 'G';
  var Gl,
    fr = (e) => {
      let t = e.inputs,
        i = {},
        p = [];
      for (let o in t) {
        let s = t[o];

        for (let n of s.imports) {
          if (n.original && n.original[0] !== '.') {
            let r = i[n.original] || (i[n.original] = []);
            r.includes(n.path) || r.push(n.path);
          }
        }
      }
      for (let o in i) {
        let s = i[o];
        if (s.length > 1) {
          let n = m.createElement('div'),
            r = m.createElement('ul'),
            l,
            a;
          (n.className = zl),
            (n.innerHTML =
              'The import path <code>' +
              z(o) +
              '</code> resolves to multiple files in the bundle:');

          for (let f of s) {
            l = Ue(f, l);
          }
          for (let f of s) {
            let u = ge(f);
            l && (u = u.slice(l.length)), (a = Jt(u.join('/'), a));
          }
          for (let f of s.sort()) {
            let u = ge(f).map(z),
              N = m.createElement('li'),
              H = '<pre><a href="javascript:void 0">',
              x = '';
            l &&
              l.length &&
              ((H += `<span class="${Wt}">` + u.slice(0, l.length).join('/') + '/</span>'),
              (u = u.slice(l.length))),
              a &&
                a.length &&
                ((x =
                  `<span class="${Wt}">` +
                  (u.length > a.length ? '/' : '') +
                  u.slice(u.length - a.length).join('/') +
                  '</span>'),
                (u.length -= a.length)),
              (N.innerHTML = H + '<b>' + u.join('/') + '</b>' + x + '</a></pre>'),
              r.append(N),
              (N.querySelector('a').onclick = () => {
                Oe(e, f, null);
              });
          }
          n.append(r), p.push(n);
        }
      }
      return p;
    },
    Ul = (e) => {
      if (Gl === e) {
        return;
      }
      Gl = e;
      let t = m.getElementById('warningsPanel'),
        i = fr(e),
        p = i.length;

      if (p) {
        t.innerHTML =
          `<div class="${Wl}">\u26A0\uFE0F This bundle has <b><a href="javascript:void 0">` +
          p +
          ' warning' +
          (p === 1 ? '' : 's') +
          '</a></b><span>.</span></div>';
        let o = t.querySelector('span'),
          s = m.createElement('div');
        s.className = Bl;
        for (let n of i) {
          s.append(n);
        }
        t.append(s),
          (t.querySelector('a').onclick = () => {
            s.style.display === 'block'
              ? ((o.textContent = '.'), (s.style.display = 'none'))
              : ((o.textContent = ':'), (s.style.display = 'block'));
          });
      } else {
        t.innerHTML = '';
      }
    };
  var mr = m.getElementById('startPanel'),
    cr = m.getElementById('resultsPanel'),
    mt = m.getElementById('chartPanel'),
    Bt = m.getElementById('useTreemap'),
    zt = m.getElementById('useSunburst'),
    Gt = m.getElementById('useFlame'),
    Ce = 0,
    me = 0,
    Ut = (e) => typeof e == 'object' && e !== null && !(e instanceof Array),
    et = (e) => {
      let t = JSON.parse(e),
        i = (o) => {
          Ce !== o &&
            (Ce === 1
              ? Bt.classList.remove(Fe)
              : Ce === 2
                ? zt.classList.remove(Fe)
                : Ce === 3 && Gt.classList.remove(Fe),
            (Ce = o),
            (mt.innerHTML = ''),
            Ce === 1
              ? (mt.append(wl(t)), Bt.classList.add(Fe), nt('chart', 'treemap'))
              : Ce === 2
                ? (mt.append(Dl(t)), zt.classList.add(Fe), nt('chart', 'sunburst'))
                : Ce === 3 && (mt.append(_l(t)), Gt.classList.add(Fe), nt('chart', 'flame')));
        },
        p = (o) => {
          me !== o && ((me = o), dl(t, me));
        };

      if (!Ut(t) || !Ut(t.inputs) || !Ut(t.outputs)) {
        throw new Error('Invalid metafile format');
      }
      (mr.style.display = 'none'),
        (cr.style.display = 'block'),
        (Bt.onclick = () => i(1)),
        (zt.onclick = () => i(2)),
        (Gt.onclick = () => i(3)),
        (Ce = 0),
        (me = 0),
        cl(t, () => p(me === 1 ? 2 : 1)),
        Ul(t),
        tt(),
        i(rt('chart') === 'flame' ? 3 : rt('chart') === 'sunburst' ? 2 : 1),
        p(1);
    },
    hr = m.documentElement.dataset,
    jl = () => {
      (hr.theme = rt('theme') + ''), Ge && Ge();
    };
  jl();
  te.addEventListener('storage', jl);
  m.getElementById('loadExample').onclick = () => {
    fetch('example-metafile.json')
      .then((e) => e.text())
      .then(et);
  };
  if (location.hash !== '') {
    try {
      et(atob(location.hash.slice(1)));
    } catch (e) {}
    try {
      history.replaceState({}, '', location.pathname);
    } catch (e) {}
  }

  /*
  Additional code for Storybook to load the metafile from the parent window.
  The story sets this global variable to the metafile in a beforeEach hook.
  */
  if (parent.metafile) {
    et(parent.metafile);
  }
})();
