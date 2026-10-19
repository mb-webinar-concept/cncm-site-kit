/* CNCM impact module: headline numbers, schools by region, and a searchable division table.
   Source file: the build script wraps this into a paste-in file in dist/. */
(function () {
  'use strict';

  /* ---------------- CONFIG: safe to edit ---------------- */
  var CONFIG = /*@CONFIG*/{}/*@END*/;
  /* ------------------------------------------------------- */
  var DEFAULTS = {
    rootId: 'cncm-impact',
    statsId: 'cncm-im-stats',         // <script type="text/plain"> with label,value,detail,source,source_url
    divisionsId: 'cncm-im-divisions', // <script type="text/plain"> with region,division,schools_supported,schools_total,note
    statsCsvUrl: '',                  // optional published Google Sheet (CSV) for the numbers
    divisionsCsvUrl: '',              // optional published Google Sheet (CSV) for the divisions
    language: 'auto',
    text: {}
  };
  (function () { for (var key in DEFAULTS) { if (!(key in CONFIG)) { CONFIG[key] = DEFAULTS[key]; } } })();

  var TEXT = {
    en: {
      label: 'Our impact', byRegion: 'Schools supported, by region', table: 'Schools supported, by school division',
      search: 'Search divisions', placeholder: 'Division name', region: 'Region', allRegions: 'All regions',
      division: 'School division', supported: 'Schools supported', total: 'Schools in division',
      showing: 'Showing {k} of {n} divisions', none: 'No division matches your search.',
      source: 'Source', note: 'Note', of: 'of', schools: 'schools'
    },
    fr: {
      label: 'Notre impact', byRegion: 'Écoles soutenues, par région', table: 'Écoles soutenues, par division scolaire',
      search: 'Rechercher une division', placeholder: 'Nom de la division', region: 'Région', allRegions: 'Toutes les régions',
      division: 'Division scolaire', supported: 'Écoles soutenues', total: 'Écoles de la division',
      showing: '{k} divisions sur {n}', none: 'Aucune division ne correspond à votre recherche.',
      source: 'Source', note: 'Remarque', of: 'sur', schools: 'écoles'
    }
  };
  var lang = CONFIG.language === 'fr' || CONFIG.language === 'en' ? CONFIG.language
    : (/^fr/i.test(document.documentElement.getAttribute('lang') || '') ? 'fr' : 'en');
  var T = {}, k;
  for (k in TEXT.en) { T[k] = TEXT[lang][k]; }
  var over = CONFIG.text && (CONFIG.text.en || CONFIG.text.fr) ? (CONFIG.text[lang] || {}) : (CONFIG.text || {});
  for (k in over) { if (Object.prototype.hasOwnProperty.call(over, k)) { T[k] = over[k]; } }
  var LOCALE = lang === 'fr' ? 'fr-CA' : 'en-CA';

  var root = document.getElementById(CONFIG.rootId);
  if (!root || root.getAttribute('data-ready') === '1') { return; }
  root.setAttribute('data-ready', '1');

  function parseCSV(text) {
    var rows = [], row = [], field = '', inQ = false, i, c;
    text = String(text || '').replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (inQ) {
        if (c === '"') { if (text.charAt(i + 1) === '"') { field += '"'; i++; } else { inQ = false; } }
        else { field += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') { i++; }
        row.push(field); field = ''; rows.push(row); row = [];
      } else { field += c; }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }
  function records(text) {
    var rows = parseCSV(text);
    if (!rows.length) { return []; }
    var head = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = r[i] != null ? String(r[i]).trim() : ''; });
      return o;
    });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function fold(s) {
    s = String(s || '').toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }
  function num(s) { var n = parseInt(String(s).replace(/[^\d-]/g, ''), 10); return isNaN(n) ? null : n; }
  function fmtNum(n) { try { return n.toLocaleString(LOCALE); } catch (e) { return String(n); } }
  function block(id) { var d = document.getElementById(id); return d ? d.textContent : ''; }
  function load(url, fallbackText) {
    if (!url || typeof fetch !== 'function') { return Promise.resolve(fallbackText); }
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.text(); })
      .then(function (t) { if (!records(t).length) { throw new Error('no rows'); } return t; })
      .catch(function (e) {
        if (window.console && console.warn) { console.warn('[impact] Using built-in data. ' + e.message); }
        return fallbackText;
      });
  }

  function renderStats(stats) {
    if (!stats.length) { return null; }
    var ul = el('ul', 'im-stats');
    stats.forEach(function (s) {
      if (!s.value) { return; }
      var li = el('li', 'im-stat');
      li.appendChild(el('p', 'im-value', s.value));
      li.appendChild(el('p', 'im-label', s.label));
      if (s.detail) { li.appendChild(el('p', 'im-detail', s.detail)); }
      if (s.source) {
        var src = el('p', 'im-source');
        var href = safeUrl(s.source_url);
        if (href) {
          var a = el('a', null, s.source); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
          src.appendChild(document.createTextNode(T.source + ': ')); src.appendChild(a);
        } else { src.textContent = T.source + ': ' + s.source; }
        li.appendChild(src);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  function start(statsText, divText) {
    var stats = records(statsText);
    var divs = records(divText).filter(function (d) { return d.division; }).map(function (d) {
      return { region: d.region, division: d.division, sup: num(d.schools_supported), tot: num(d.schools_total),
               note: d.note || '', hay: fold(d.division + ' ' + d.region) };
    });
    while (root.firstChild) { root.removeChild(root.firstChild); }
    root.setAttribute('aria-label', T.label);

    var s = renderStats(stats);
    if (s) { root.appendChild(s); }
    if (!divs.length) { return; }

    // Region totals, computed from the division rows
    var totals = {}, order = [];
    divs.forEach(function (d) {
      if (!(d.region in totals)) { totals[d.region] = 0; order.push(d.region); }
      totals[d.region] += d.sup || 0;
    });
    order.sort(function (a, b) { return totals[b] - totals[a]; });
    var max = Math.max.apply(null, order.map(function (r) { return totals[r]; })) || 1;

    var sec = el('section', 'im-regions');
    var h = el('h3', 'im-h', T.byRegion); h.id = CONFIG.rootId + '-regions-h';
    sec.setAttribute('aria-labelledby', h.id);
    sec.appendChild(h);
    var list = el('ul', 'im-bars');
    order.forEach(function (r) {
      var li = el('li', 'im-bar');
      var btn = el('button', 'im-barbtn');
      btn.type = 'button';
      btn.setAttribute('aria-label', r + ': ' + fmtNum(totals[r]) + ' ' + T.schools);
      btn.appendChild(el('span', 'im-barlabel', r));
      var track = el('span', 'im-track');
      var fill = el('span', 'im-fill');
      fill.style.width = Math.max(2, Math.round(totals[r] / max * 100)) + '%';
      track.appendChild(fill);
      btn.appendChild(track);
      btn.appendChild(el('span', 'im-barnum', fmtNum(totals[r])));
      btn.addEventListener('click', function () { sel.value = r; render(); table.focus(); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    sec.appendChild(list);
    root.appendChild(sec);

    // Searchable table
    var tsec = el('section', 'im-tablesec');
    var th = el('h3', 'im-h', T.table); th.id = CONFIG.rootId + '-table-h';
    tsec.setAttribute('aria-labelledby', th.id);
    tsec.appendChild(th);
    var bar = el('div', 'im-toolbar');
    bar.setAttribute('role', 'search');
    var q = el('input', 'im-input'); q.type = 'search'; q.id = CONFIG.rootId + '-q';
    q.setAttribute('placeholder', T.placeholder); q.setAttribute('autocomplete', 'off');
    var ql = el('label', 'im-label-f', T.search); ql.setAttribute('for', q.id);
    var sel = el('select', 'im-select'); sel.id = CONFIG.rootId + '-region';
    var sl = el('label', 'im-label-f', T.region); sl.setAttribute('for', sel.id);
    var all = el('option', null, T.allRegions); all.value = ''; sel.appendChild(all);
    order.slice().sort(function (a, b) { return a.localeCompare(b, LOCALE); }).forEach(function (r) {
      var o = el('option', null, r); o.value = r; sel.appendChild(o);
    });
    var f1 = el('div', 'im-field'); f1.appendChild(ql); f1.appendChild(q);
    var f2 = el('div', 'im-field'); f2.appendChild(sl); f2.appendChild(sel);
    bar.appendChild(f1); bar.appendChild(f2);
    tsec.appendChild(bar);
    var status = el('p', 'im-count'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    tsec.appendChild(status);
    var wrap = el('div', 'im-tablewrap');
    var table = el('table', 'im-table'); table.tabIndex = -1;
    var cap = el('caption', 'im-vh', T.table); table.appendChild(cap);
    var thead = el('thead'); var hr = el('tr');
    [T.division, T.region, T.supported, T.total].forEach(function (t, i) {
      var c = el('th', i > 1 ? 'im-num' : null, t); c.scope = 'col'; hr.appendChild(c);
    });
    thead.appendChild(hr); table.appendChild(thead);
    var tbody = el('tbody'); table.appendChild(tbody);
    wrap.appendChild(table); tsec.appendChild(wrap);
    var empty = el('p', 'im-empty', T.none); empty.hidden = true; tsec.appendChild(empty);
    root.appendChild(tsec);

    function render() {
      var words = fold(q.value).split(/\s+/).filter(Boolean), r = sel.value;
      var shown = divs.filter(function (d) {
        if (r && d.region !== r) { return false; }
        for (var i = 0; i < words.length; i++) { if (d.hay.indexOf(words[i]) < 0) { return false; } }
        return true;
      }).sort(function (a, b) { return a.division.localeCompare(b.division, LOCALE) || a.region.localeCompare(b.region, LOCALE); });
      while (tbody.firstChild) { tbody.removeChild(tbody.firstChild); }
      shown.forEach(function (d) {
        var tr = el('tr');
        var c1 = el('th', null, d.division); c1.scope = 'row';
        if (d.note) { c1.appendChild(el('span', 'im-note', d.note)); }
        tr.appendChild(c1);
        tr.appendChild(el('td', null, d.region));
        tr.appendChild(el('td', 'im-num', d.sup == null ? '' : fmtNum(d.sup)));
        tr.appendChild(el('td', 'im-num', d.tot == null ? '' : fmtNum(d.tot)));
        tbody.appendChild(tr);
      });
      status.textContent = T.showing.replace('{k}', shown.length).replace('{n}', divs.length);
      empty.hidden = shown.length > 0;
      wrap.hidden = shown.length === 0;
    }
    q.addEventListener('input', render);
    sel.addEventListener('change', render);
    render();
  }

  Promise.all([load(CONFIG.statsCsvUrl, block(CONFIG.statsId)), load(CONFIG.divisionsCsvUrl, block(CONFIG.divisionsId))])
    .then(function (r) { start(r[0], r[1]); });
})();
