/* CNCM library module. Source file: the build script wraps this into paste-in files in dist/. */
(function () {
  'use strict';

  /* ---------------- CONFIG: safe to edit ---------------- */
  var CONFIG = /*@CONFIG*/{}/*@END*/;
  /* ------------------------------------------------------- */
  var DEFAULTS = {
    rootId: 'cncm-webinar-library', // the <div> this library fills
    dataId: 'cncm-wl-data',          // the <script type="text/plain"> holding the CSV
    prefix: 'wl',                    // prefix for element ids, unique per library on a page
    sheetCsvUrl: '',                 // optional published Google Sheet (CSV) to use instead of the data block
    language: 'auto',                // 'auto' follows the page language; or 'en' / 'fr'
    pageSize: 24,                    // cards before "Show more"; 0 = all
    urlState: true,                  // keep filters in the address bar so views can be shared
    defaultSort: 'newest',           // 'newest' or 'az' (use 'az' when few items have dates)
    include: null,                   // show only matching rows, e.g. { type: 'Webinar' }
    text: {}                         // override wording: { one: 'resource' } or per language { en: {...}, fr: {...} }
  };
  (function () { for (var key in DEFAULTS) { if (!(key in CONFIG)) { CONFIG[key] = DEFAULTS[key]; } } })();

  var TEXT = {
    en: {
      label: 'Webinar library', one: 'webinar', many: 'webinars',
      search: 'Search webinars', placeholder: 'Title, topic, presenter or keyword',
      topic: 'Topic', allTopics: 'All topics', type: 'Type', allTypes: 'All types',
      region: 'Region', allRegions: 'All regions', language: 'Language', allLanguages: 'All languages',
      year: 'Year', allYears: 'All years', undated: 'Date not listed',
      date: 'Date', pastUpcoming: 'Past and upcoming', upcoming: 'Upcoming', past: 'Past',
      sort: 'Sort by', newest: 'Newest first', az: 'Title A to Z',
      clear: 'Clear filters', showingAll: 'Showing all {n} {items}', showing: 'Showing {k} of {n} {items}',
      noMatch: 'Nothing matches your search. Try fewer words or ', clearLink: 'clear the filters',
      none: 'Nothing is listed yet. Please check back soon.', presenter: 'Presenter: ',
      view: 'View webinar', resources: 'Resources', newTab: ' (opens in a new tab)',
      more: 'Show more ({r} more)'
    },
    fr: {
      label: 'Bibliothèque de webinaires', one: 'webinaire', many: 'webinaires',
      search: 'Rechercher des webinaires', placeholder: 'Titre, sujet, présentateur ou mot-clé',
      topic: 'Sujet', allTopics: 'Tous les sujets', type: 'Type', allTypes: 'Tous les types',
      region: 'Région', allRegions: 'Toutes les régions', language: 'Langue', allLanguages: 'Toutes les langues',
      year: 'Année', allYears: 'Toutes les années', undated: 'Date non indiquée',
      date: 'Date', pastUpcoming: 'Passés et à venir', upcoming: 'À venir', past: 'Passés',
      sort: 'Trier par', newest: 'Plus récents', az: 'Titre de A à Z',
      clear: 'Effacer les filtres', showingAll: 'Résultats : {n} {items}', showing: 'Résultats : {k} sur {n} {items}',
      noMatch: 'Aucun résultat. Essayez moins de mots ou ', clearLink: 'effacez les filtres',
      none: 'Aucun contenu pour le moment. Revenez bientôt.', presenter: 'Présentation : ',
      view: 'Voir le webinaire', resources: 'Ressources', newTab: ' (s’ouvre dans un nouvel onglet)',
      more: 'Afficher plus ({r} de plus)'
    }
  };
  var lang = CONFIG.language === 'fr' || CONFIG.language === 'en' ? CONFIG.language
    : (/^fr/i.test(document.documentElement.getAttribute('lang') || '') ? 'fr' : 'en');
  var T = {}, k;
  for (k in TEXT.en) { T[k] = TEXT[lang][k]; }
  var over = CONFIG.text && (CONFIG.text.en || CONFIG.text.fr) ? (CONFIG.text[lang] || {}) : (CONFIG.text || {});
  for (k in over) { if (Object.prototype.hasOwnProperty.call(over, k)) { T[k] = over[k]; } }
  var LOCALE = lang === 'fr' ? 'fr-CA' : 'en-CA';
  function fmt(str, o) { return String(str).replace(/\{(\w+)\}/g, function (m, key) { return o[key] != null ? o[key] : m; }); }
  function fold(str) {
    str = String(str || '').toLowerCase();
    return str.normalize ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
  }
  var limit = CONFIG.pageSize > 0 ? CONFIG.pageSize : Infinity;
  /* ------------------------------------------------------- */

  var root = document.getElementById(CONFIG.rootId);
  var P = CONFIG.prefix;
  if (!root || root.getAttribute('data-ready') === '1') { return; }
  root.setAttribute('data-ready', '1');

  var items = [];
  var els = {};

  function parseCSV(text) {
    var rows = [], row = [], field = '', inQ = false, i, c;
    text = String(text || '').replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; } else { inQ = false; }
        } else { field += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') { i++; }
        row.push(field); field = '';
        rows.push(row); row = [];
      } else { field += c; }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (x) { return String(x).trim() !== ''; });
    });
  }

  function parseDate(s) {
    s = String(s || '').trim();
    var m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(s);
    if (!m) { return { ts: null, year: null, label: '' }; }
    var y = +m[1], mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    var label;
    try {
      if (m[3]) { label = dt.toLocaleDateString(LOCALE, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
      else if (m[2]) { label = dt.toLocaleDateString(LOCALE, { year: 'numeric', month: 'long', timeZone: 'UTC' }); }
      else { label = String(y); }
    } catch (e) { label = s; }
    return { ts: dt.getTime(), year: y, label: label };
  }

  function safeUrl(u) {
    u = String(u || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function toItems(rows) {
    if (!rows.length) { return []; }
    var head = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var idx = function (name) { return head.indexOf(name); };
    var col = { title: idx('title'), date: idx('date'), topic: idx('topic'), presenter: idx('presenter'),
                description: idx('description'), link: idx('link'), resources: idx('resources'),
                region: idx('region'), language: idx('language'), type: idx('type') };
    if (col.title < 0) { return []; }
    var get = function (r, k) { return col[k] >= 0 && r[col[k]] != null ? String(r[col[k]]).trim() : ''; };
    var out = [];
    rows.slice(1).forEach(function (r) {
      var title = get(r, 'title');
      if (!title) { return; }
      var d = parseDate(get(r, 'date'));
      out.push({
        title: title, ts: d.ts, year: d.year, dateLabel: d.label,
        topic: get(r, 'topic'), presenter: get(r, 'presenter'), description: get(r, 'description'),
        link: safeUrl(get(r, 'link')), resources: safeUrl(get(r, 'resources')),
        region: get(r, 'region'), language: get(r, 'language'), type: get(r, 'type')
      });
      var o = out[out.length - 1];
      o.topics = o.topic ? o.topic.split(';').map(function (t) { return t.trim(); }).filter(Boolean) : [];
      o.hay = fold([o.title, o.topic, o.presenter, o.description, o.region, o.language, o.type].join(' '));
    });
    return out;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function field(cls, labelText, control, id) {
    var wrap = el('div', 'wl-field ' + cls);
    var lab = el('label', 'wl-label', labelText);
    lab.setAttribute('for', id);
    control.id = id;
    wrap.appendChild(lab);
    wrap.appendChild(control);
    return wrap;
  }

  function buildShell() {
    // keep <noscript> out of the way once JS runs
    while (root.firstChild) { root.removeChild(root.firstChild); }

    var toolbar = el('div', 'wl-toolbar');
    toolbar.setAttribute('role', 'search');

    els.q = el('input', 'wl-input');
    els.q.type = 'search';
    els.q.setAttribute('autocomplete', 'off');
    els.q.setAttribute('placeholder', T.placeholder);
    els.fq = field('wl-search', T.search, els.q, P + '-q');

    els.type = el('select', 'wl-select');
    els.fty = field('wl-type', T.type, els.type, P + '-type');

    els.topic = el('select', 'wl-select');
    els.ft = field('wl-topic', T.topic, els.topic, P + '-topic');

    els.region = el('select', 'wl-select');
    els.fr = field('wl-region', T.region, els.region, P + '-region');

    els.lang = el('select', 'wl-select');
    els.fl = field('wl-lang', T.language, els.lang, P + '-lang');

    els.year = el('select', 'wl-select');
    els.fy = field('wl-year', T.year, els.year, P + '-year');

    els.sort = el('select', 'wl-select');
    [['newest', T.newest], ['az', T.az]].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; els.sort.appendChild(op);
    });
    els.fs = field('wl-sort', T.sort, els.sort, P + '-sort');

    els.when = el('select', 'wl-select');
    els.fw = field('wl-when', T.date, els.when, P + '-when');

    toolbar.appendChild(els.fq); toolbar.appendChild(els.fty); toolbar.appendChild(els.fr); toolbar.appendChild(els.ft);
    toolbar.appendChild(els.fl); toolbar.appendChild(els.fw); toolbar.appendChild(els.fy); toolbar.appendChild(els.fs);

    var row = el('div', 'wl-statusrow');
    els.count = el('p', 'wl-count');
    els.count.setAttribute('role', 'status');
    els.count.setAttribute('aria-live', 'polite');
    els.clear = el('button', 'wl-clear', T.clear);
    els.clear.type = 'button';
    els.clear.hidden = true;
    row.appendChild(els.count); row.appendChild(els.clear);

    els.list = el('ul', 'wl-list');
    els.empty = el('p', 'wl-empty');
    els.empty.hidden = true;

    els.moreWrap = el('div', 'wl-morewrap');
    els.moreWrap.hidden = true;
    els.more = el('button', 'wl-btn wl-more');
    els.more.type = 'button';
    els.more.addEventListener('click', function () {
      var firstNew = els.list.children.length;
      limit += CONFIG.pageSize;
      render(true);
      var next = els.list.children[firstNew];
      var a = next && next.querySelector('a');
      if (a) { a.focus(); }
    });
    els.moreWrap.appendChild(els.more);

    root.setAttribute('aria-label', T.label);
    root.appendChild(toolbar); root.appendChild(row);
    root.appendChild(els.list); root.appendChild(els.empty); root.appendChild(els.moreWrap);

    var update = function () { limit = CONFIG.pageSize > 0 ? CONFIG.pageSize : Infinity; render(); };
    els.q.addEventListener('input', update);
    [els.type, els.topic, els.region, els.lang, els.when, els.year, els.sort].forEach(function (sel) {
      sel.addEventListener('change', update);
    });
    els.clear.addEventListener('click', resetFilters);
  }

  function fillOptions(select, allLabel, values) {
    while (select.firstChild) { select.removeChild(select.firstChild); }
    var all = el('option', null, allLabel); all.value = ''; select.appendChild(all);
    values.forEach(function (v) { var o = el('option', null, v.label); o.value = v.value; select.appendChild(o); });
  }

  function setupFilters() {
    var topics = {}, types = {}, regions = {}, langs = {}, years = {}, undated = false, hasFuture = false, hasPast = false;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    items.forEach(function (it) {
      it.topics.forEach(function (t) { topics[t] = true; });
      if (it.type) { types[it.type] = true; }
      if (it.region) { regions[it.region] = true; }
      if (it.language) { langs[it.language] = true; }
      if (it.ts != null) { if (it.ts >= today.getTime()) { hasFuture = true; } else { hasPast = true; } }
      if (it.year != null) { years[it.year] = true; } else { undated = true; }
    });
    var tlist = Object.keys(topics).sort(function (a, b) { return a.localeCompare(b, LOCALE); })
      .map(function (t) { return { value: t, label: t }; });
    fillOptions(els.topic, T.allTopics, tlist);
    els.ft.hidden = tlist.length < 2;

    var ylist = Object.keys(years).map(Number).sort(function (a, b) { return b - a; })
      .map(function (y) { return { value: String(y), label: String(y) }; });
    if (ylist.length && undated) { ylist.push({ value: 'undated', label: T.undated }); }
    fillOptions(els.year, T.allYears, ylist);
    els.fy.hidden = Object.keys(years).length < 2;   // a year filter needs at least two real years

    var toList = function (o) { return Object.keys(o).sort(function (a, b) { return a.localeCompare(b, LOCALE); })
      .map(function (t) { return { value: t, label: t }; }); };
    var rlist = toList(regions), llist = toList(langs), tylist = toList(types);
    fillOptions(els.type, T.allTypes, tylist); els.fty.hidden = tylist.length < 2;
    fillOptions(els.region, T.allRegions, rlist); els.fr.hidden = rlist.length < 2;
    fillOptions(els.lang, T.allLanguages, llist); els.fl.hidden = llist.length < 2;
    fillOptions(els.when, T.pastUpcoming, [{ value: 'upcoming', label: T.upcoming }, { value: 'past', label: T.past }]);
    els.fw.hidden = !(hasFuture && hasPast);
  }

  function matches(it, words, f) {
    var topic = f.topic, year = f.year, region = f.region, lang = f.lang, when = f.when;
    if (f.type && it.type !== f.type) { return false; }
    if (topic && it.topics.indexOf(topic) < 0) { return false; }
    if (region && it.region !== region) { return false; }
    if (lang && it.language !== lang) { return false; }
    if (when) {
      var t0 = new Date(); t0.setHours(0, 0, 0, 0);
      if (it.ts == null) { return false; }
      if (when === 'upcoming' && it.ts < t0.getTime()) { return false; }
      if (when === 'past' && it.ts >= t0.getTime()) { return false; }
    }
    if (year) {
      if (year === 'undated') { if (it.year != null) { return false; } }
      else if (String(it.year) !== year) { return false; }
    }
    if (words.length) {
      for (var i = 0; i < words.length; i++) { if (it.hay.indexOf(words[i]) < 0) { return false; } }
    }
    return true;
  }

  function sortItems(list, mode) {
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (mode === 'az') { return a.title.localeCompare(b.title, LOCALE); }
      if (a.ts == null && b.ts == null) { return a.title.localeCompare(b.title, LOCALE); }
      if (a.ts == null) { return 1; }
      if (b.ts == null) { return -1; }
      return b.ts - a.ts || a.title.localeCompare(b.title, LOCALE);
    });
    return copy;
  }

  function linkBtn(href, text, cls, title) {
    var a = el('a', 'wl-btn ' + cls, text);
    a.href = href;
    var same = false;
    try { same = new URL(href, location.href).hostname === location.hostname && location.hostname !== ''; } catch (e) {}
    if (!same) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    var vh = el('span', 'wl-vh', ': ' + title + (same ? '' : T.newTab));
    a.appendChild(vh);
    return a;
  }

  function card(it) {
    var li = el('li', 'wl-card');
    if (it.topics.length) {
      var tags = el('p', 'wl-tags');
      it.topics.forEach(function (t) { tags.appendChild(el('span', 'wl-tag', t)); });
      li.appendChild(tags);
    }
    li.appendChild(el('h3', 'wl-title', it.title));
    var meta = [];
    if (it.type) { meta.push(it.type); }
    if (it.dateLabel) { meta.push(it.dateLabel); }
    if (it.presenter) { meta.push(T.presenter + it.presenter); }
    if (it.region) { meta.push(it.region); }
    if (it.language) { meta.push(it.language); }
    if (meta.length) { li.appendChild(el('p', 'wl-meta', meta.join('  ·  '))); }
    if (it.description) { li.appendChild(el('p', 'wl-desc', it.description)); }
    if (it.link || it.resources) {
      var act = el('div', 'wl-actions');
      if (it.link) { act.appendChild(linkBtn(it.link, T.view, 'wl-primary', it.title)); }
      if (it.resources) { act.appendChild(linkBtn(it.resources, T.resources, 'wl-secondary', it.title)); }
      li.appendChild(act);
    }
    return li;
  }

  function resetFilters() {
    els.q.value = ''; els.type.value = ''; els.topic.value = ''; els.year.value = ''; els.region.value = '';
    els.lang.value = ''; els.when.value = ''; els.sort.value = CONFIG.defaultSort;
    limit = CONFIG.pageSize > 0 ? CONFIG.pageSize : Infinity;
    render(); els.q.focus();
  }

  var FILTERS = [['q', 'q'], ['type', 'type'], ['topic', 'topic'], ['region', 'region'], ['lang', 'lang'],
    ['year', 'year'], ['when', 'when'], ['sort', 'sort']];

  function readUrl() {
    if (!CONFIG.urlState) { return; }
    try {
      var p = new URLSearchParams(location.search);
      FILTERS.forEach(function (f) {
        var v = p.get(P + '_' + f[0]);
        if (v == null) { return; }
        var c = els[f[1]];
        if (c.tagName === 'SELECT') {
          for (var i = 0; i < c.options.length; i++) { if (c.options[i].value === v) { c.value = v; break; } }
        } else { c.value = v; }
      });
    } catch (e) {}
  }

  function writeUrl() {
    if (!CONFIG.urlState || !window.history || !history.replaceState) { return; }
    try {
      var u = new URL(location.href);
      FILTERS.forEach(function (f) {
        var v = els[f[1]].value;
        if (v && !(f[0] === 'sort' && v === CONFIG.defaultSort)) { u.searchParams.set(P + '_' + f[0], v); }
        else { u.searchParams.delete(P + '_' + f[0]); }
      });
      if (u.href !== location.href) { history.replaceState(history.state, '', u.href); }
    } catch (e) {}
  }

  function render(keepUrl) {
    var words = fold(els.q.value).split(/\s+/).filter(Boolean);
    var f = { type: els.type.value, topic: els.topic.value, year: els.year.value, region: els.region.value,
              lang: els.lang.value, when: els.when.value };
    var shown = sortItems(items.filter(function (it) { return matches(it, words, f); }), els.sort.value);

    while (els.list.firstChild) { els.list.removeChild(els.list.firstChild); }
    shown.slice(0, limit).forEach(function (it) { els.list.appendChild(card(it)); });

    var rest = shown.length - Math.min(shown.length, limit);
    els.moreWrap.hidden = rest <= 0;
    els.more.textContent = fmt(T.more, { r: rest });

    var total = items.length;
    var noun = function (n) { return n === 1 ? T.one : T.many; };
    els.count.textContent = shown.length === total
      ? fmt(T.showingAll, { n: total, items: noun(total) })
      : fmt(T.showing, { k: shown.length, n: total, items: noun(total) });

    var filtered = words.length || f.type || f.topic || f.year || f.region || f.lang || f.when || els.sort.value !== CONFIG.defaultSort;
    els.clear.hidden = !filtered;

    if (!shown.length) {
      els.empty.hidden = false;
      if (!els.empty.firstChild) {
        els.empty.appendChild(document.createTextNode(T.noMatch));
        var b = el('button', 'wl-clear', T.clearLink);
        b.type = 'button';
        b.addEventListener('click', resetFilters);
        els.empty.appendChild(b);
        els.empty.appendChild(document.createTextNode('.'));
      }
    } else { els.empty.hidden = true; }
    if (!keepUrl) { writeUrl(); }
  }

  function included(it) {
    if (!CONFIG.include) { return true; }
    for (var key in CONFIG.include) {
      if (Object.prototype.hasOwnProperty.call(CONFIG.include, key) && String(it[key] || '') !== String(CONFIG.include[key])) { return false; }
    }
    return true;
  }

  function start(csvText) {
    items = toItems(parseCSV(csvText)).filter(included);
    buildShell();
    if (!items.length) {
      els.count.textContent = '';
      els.empty.hidden = false;
      els.empty.textContent = T.none;
      return;
    }
    setupFilters();
    els.sort.value = CONFIG.defaultSort;
    readUrl();
    render();
  }

  function embeddedCSV() {
    var d = document.getElementById(CONFIG.dataId);
    return d ? d.textContent : '';
  }

  var embedded = embeddedCSV();
  if (CONFIG.sheetCsvUrl && typeof fetch === 'function') {
    fetch(CONFIG.sheetCsvUrl, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.text(); })
      .then(function (t) {
        if (toItems(parseCSV(t)).filter(included).length) { start(t); } else { throw new Error('Sheet had no usable rows'); }
      })
      .catch(function (e) {
        if (window.console && console.warn) { console.warn('[webinar library] Using built-in list. ' + e.message); }
        start(embedded);
      });
  } else {
    start(embedded);
  }
})();
