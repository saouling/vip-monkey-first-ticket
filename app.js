(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const screen = $('#screen');
  const sheet = $('#sheet');
  const scrim = $('#scrim');

  const state = {
    lang: 'sv',
    view: 'chat',
    step: 'chat',
    auth: null,           // 'apple' | 'google' | 'bankid' | 'email'
    holdEnd: 0,
    holdTimer: 0,
    bStage: 1,
  };

  const TIMES = { chat: '14:12', web: '14:13', open: '14:15', event: '14:16', tickets: '14:19', ticket: '21:42', b1: '14:13', b2: '14:14' };
  const TAB_VIEWS = ['event', 'tickets', 'ticket'];
  const HOLD_MS = 10 * 60 * 1000;

  // ---------- language ----------
  const t = (key, vars = {}) => {
    const s = (window.STRINGS[state.lang] || {})[key] ?? window.STRINGS.sv[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  };

  function applyLang() {
    document.documentElement.lang = state.lang;
    document.title = t('doc.title');
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr, t(key));
      });
    });
    $$('.lang-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    $('#tabbar').setAttribute('aria-label', state.lang === 'sv' ? 'Huvudmeny' : 'Main menu');
    fillDob();
    updatePayLabel();
    tickHold();
    renderTickets();
    if (!$('#swish-err').hidden) showSwishError();
    try { localStorage.setItem('vm-lang', state.lang); } catch (e) {}
  }

  // ---------- navigation ----------
  function showView(name, { focus = true } = {}) {
    const next = $(`.view[data-view="${name}"]`);
    if (!next) return;
    $$('.view').forEach(v => {
      const on = v === next;
      v.classList.toggle('is-active', on);
      v.inert = !on;
    });
    if (state.view !== name) {
      next.classList.remove('is-entering');
      void next.offsetWidth;
      next.classList.add('is-entering');
    }
    state.view = name;
    $('#sb-time').textContent = TIMES[name] || '14:16';
    if (name === 'ticket') screen.setAttribute('data-dark', ''); else screen.removeAttribute('data-dark');
    const tabbar = $('#tabbar');
    tabbar.hidden = !TAB_VIEWS.includes(name);
    $$('.tab').forEach(tab => {
      const cur = tab.dataset.tab === name || (tab.dataset.tab === 'tickets' && name === 'ticket');
      if (cur) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    if (name !== 'web') $('#store').hidden = true;
    if (focus) focusIn(next);
  }

  function focusIn(root) {
    const target = root.querySelector('h2, [data-focus]');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    if (document.activeElement && screen.contains(document.activeElement) || document.activeElement === document.body) {
      target.focus({ preventScroll: true });
    }
  }

  function setStep(step) {
    state.step = step;
    $$('.steps [data-go]').forEach(b => {
      if (b.dataset.go === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    if (location.hash.slice(1) !== step) history.replaceState(null, '', `#${step}`);
  }

  function go(target, opts = {}) {
    switch (target) {
      case 'store':
        closeSheet(true);
        showView('web');
        openStore();
        setStep('web');
        return;
      case 'event':
        if (!state.auth) state.auth = 'apple';
        closeSheet(true, 'keep');
        showView('event');
        break;
      case 'checkout':
        if (!state.auth) state.auth = 'apple';
        showView('event', { focus: false });
        openSheet('checkout');
        break;
      case 'swish':
        if (!state.auth) state.auth = 'apple';
        showView('event', { focus: false });
        if (!state.holdEnd) startHold();
        openSheet('swish');
        break;
      case 'done':
        if (!state.auth) state.auth = 'apple';
        showView('event', { focus: false });
        openSheet('done');
        break;
      default:
        closeSheet(true);
        showView(target);
    }
    setStep(target);
    if (opts.reset) reset();
  }

  function reset() {
    state.auth = null;
    closeSheet('reset', 'release');
    stopHold();
    state.holdEnd = 0;
    updateCta();
    $$('form').forEach(f => f.reset());
    $$('.field-err').forEach(e => { e.hidden = true; });
    $$('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    $('#allergy-more').hidden = true;
    $('#school').disabled = false;
    $('#email-form').hidden = true;
    $('#email-toggle').setAttribute('aria-expanded', 'false');
    resetStore();
    resetB();
    updatePayLabel();
    $('#event-scroll').scrollTop = 0;
  }

  // ---------- simulated App Store ----------
  const storeGet = $('#store-get');
  function openStore() { resetStore(); $('#store').hidden = false; storeGet.focus(); }
  function resetStore() {
    storeGet.dataset.stage = 'get';
    storeGet.removeAttribute('aria-busy');
    storeGet.querySelector('span').dataset.i18n = 'store.get';
    storeGet.querySelector('span').textContent = t('store.get');
  }
  storeGet.addEventListener('click', () => {
    const label = storeGet.querySelector('span');
    if (storeGet.dataset.stage === 'get') {
      storeGet.dataset.stage = 'installing';
      storeGet.setAttribute('aria-busy', 'true');
      label.dataset.i18n = 'store.installing';
      label.textContent = t('store.installing');
      setTimeout(() => {
        storeGet.dataset.stage = 'open';
        storeGet.removeAttribute('aria-busy');
        label.dataset.i18n = 'store.open';
        label.textContent = t('store.open');
        storeGet.focus();
      }, 1300);
    } else if (storeGet.dataset.stage === 'open') {
      go('open');
    }
  });

  // ---------- first open: sign-in ----------
  $$('[data-auth]').forEach(btn => btn.addEventListener('click', () => signIn(btn.dataset.auth, btn)));
  function signIn(method, btn) {
    btn.setAttribute('aria-busy', 'true');
    setTimeout(() => {
      btn.removeAttribute('aria-busy');
      state.auth = method;
      go('event');
      toast(t(method === 'bankid' ? 'toast.bankid' : 'toast.signedin'));
    }, 900);
  }
  $('#email-toggle').addEventListener('click', e => {
    const form = $('#email-form');
    form.hidden = !form.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) $('#email').focus();
  });
  $('#email-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#email');
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    $('#email-err').hidden = ok;
    if (ok) input.removeAttribute('aria-invalid'); else { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    signIn('email', e.submitter || $('#email-form .btn'));
  });
  $('#email').addEventListener('input', () => { $('#email-err').hidden = true; $('#email').removeAttribute('aria-invalid'); });

  // ---------- event page ----------
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    if (tab.disabled) return;
    go(tab.dataset.tab);
  }));

  // ---------- sheet ----------
  function openSheet(pane) {
    const wasOpen = !sheet.hidden;
    sheet.hidden = false;
    scrim.hidden = false;
    $$('.pane', sheet).forEach(p => { p.hidden = p.dataset.pane !== pane; });
    sheet.classList.toggle('is-tall', pane === 'done');
    screen.classList.add('has-sheet');
    $('#cancel-confirm').hidden = true;
    $('.view-event .scroll').inert = true;
    $('.cta-bar').inert = true;
    $('#tabbar').inert = true;
    if (pane === 'checkout') {
      if (!state.holdEnd || Date.now() > state.holdEnd) startHold();
      applyAuthToCheckout();
      $('#sheet-title').focus({ preventScroll: true });
    }
    if (pane === 'swish') {
      hideSwishError();
      $('#swish-title').focus({ preventScroll: true });
    }
    if (pane === 'done') {
      stopHold();
      renderTickets(true);
      $('#done-title').focus({ preventScroll: true });
    }
    if (!wasOpen) sheet.style.animation = '';
  }
  // mode: 'keep' = step back to the event, the ticket stays held; 'release' = purchase cancelled
  function closeSheet(silent, mode = 'keep') {
    if (sheet.hidden) return;
    sheet.hidden = true;
    scrim.hidden = true;
    screen.classList.remove('has-sheet');
    $('.view-event .scroll').inert = false;
    $('.cta-bar').inert = false;
    $('#tabbar').inert = false;
    if (mode === 'release' || silent === 'reset') {
      stopHold();
      state.holdEnd = 0;
    }
    updateCta();
    if (!silent) {
      setStep('event');
      $('#cta-btn').focus();
    }
  }
  const activePane = () => $$('.pane', sheet).find(p => !p.hidden)?.dataset.pane;
  function requestClose() {
    if (sheet.hidden) return;
    const pane = activePane();
    if (pane === 'swish') { askCancel(); return; }
    closeSheet(false, pane === 'done' ? 'release' : 'keep');
  }
  $$('[data-close]').forEach(b => b.addEventListener('click', requestClose));
  scrim.addEventListener('click', requestClose);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || sheet.hidden) return;
    if (!$('#cancel-confirm').hidden) { $('#cancel-confirm').hidden = true; $('#swish-title').focus(); return; }
    requestClose();
  });
  function askCancel() {
    $('#cancel-confirm').hidden = false;
    $('#cancel-no').focus();
  }
  $$('[data-confirm-cancel]').forEach(b => b.addEventListener('click', askCancel));
  $('#cancel-no').addEventListener('click', () => { $('#cancel-confirm').hidden = true; $('#swish-title').focus(); });
  $('#cancel-yes').addEventListener('click', () => { $('#cancel-confirm').hidden = true; hideSwishError(); closeSheet(false, 'release'); });
  function updateCta() {
    const label = $('#cta-label');
    const held = state.holdEnd && state.holdEnd > Date.now() && sheet.hidden;
    label.textContent = held ? t('ev.cta.resume', { t: fmt(state.holdEnd - Date.now()) }) : t('ev.cta');
  }

  // hold timer
  function startHold() {
    state.holdEnd = Date.now() + HOLD_MS;
    $('#hold').hidden = false;
    $('#hold-expired').hidden = true;
    $('#pay-btn').disabled = false;
    clearInterval(state.holdTimer);
    state.holdTimer = setInterval(tickHold, 1000);
    tickHold();
  }
  function stopHold() { clearInterval(state.holdTimer); }
  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function tickHold() {
    if (!state.holdEnd) return;
    const left = state.holdEnd - Date.now();
    const txt = t('co.hold', { t: fmt(left) });
    $('#hold-text').textContent = txt;
    $('#swish-hold').textContent = txt;
    $('#hold').classList.toggle('is-low', left < 120000);
    if (!$('#swish-err').hidden) $('#swish-err-text').textContent = t('sw.cancelled', { t: fmt(left) });
    updateCta();
    if (left <= 0) {
      stopHold();
      state.holdEnd = 0;
      updateCta();
      $('#hold').hidden = true;
      $('#hold-expired').hidden = false;
      $('#pay-btn').disabled = true;
    }
  }
  $('#hold-again').addEventListener('click', startHold);

  // checkout form
  function fillDob() {
    const d = $('#dob-d'), m = $('#dob-m'), y = $('#dob-y');
    const keep = [d.value, m.value, y.value];
    const opt = (v, l) => `<option value="${v}">${l}</option>`;
    d.innerHTML = opt('', t('co.day')) + Array.from({ length: 31 }, (_, i) => opt(i + 1, i + 1)).join('');
    m.innerHTML = opt('', t('co.month')) + t('co.months').split(',').map((n, i) => opt(i + 1, n)).join('');
    y.innerHTML = opt('', t('co.year')) + Array.from({ length: 70 }, (_, i) => 2012 - i).map(v => opt(v, v)).join('');
    [d.value, m.value, y.value] = keep;
  }
  function applyAuthToCheckout() {
    const verified = state.auth === 'bankid';
    $('#age-input-wrap').hidden = verified;
    $('#age-ok').hidden = !verified;
  }
  $('#no-school').addEventListener('change', e => {
    const school = $('#school');
    school.disabled = e.target.checked;
    if (e.target.checked) { school.value = ''; clearErr(school, '#school-err'); }
  });
  $$('input[name="allergy"]').forEach(r => r.addEventListener('change', () => {
    const yes = $('input[name="allergy"]:checked').value === 'yes';
    $('#allergy-more').hidden = !yes;
    if (yes) $('#allergy-text').focus();
  }));
  $$('input[name="pay"]').forEach(r => r.addEventListener('change', updatePayLabel));
  function updatePayLabel() {
    const card = $('input[name="pay"]:checked')?.value === 'card';
    const label = $('#pay-label');
    label.dataset.i18n = card ? 'co.btn.card' : 'co.btn.swish';
    label.textContent = t(label.dataset.i18n);
    const m = $('#sum-method');
    m.dataset.i18n = card ? 'co.card' : 'co.swish';
    m.textContent = t(m.dataset.i18n);
  }
  function setErr(input, errSel, msg) {
    const err = $(errSel);
    if (msg) err.textContent = msg;
    err.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }
  function clearErr(input, errSel) {
    $(errSel).hidden = true;
    input.removeAttribute('aria-invalid');
  }
  [['#school', '#school-err'], ['#allergy-text', '#allergy-err']].forEach(([i, e]) => {
    $(i).addEventListener('input', () => { clearErr($(i), e); $('#form-err').hidden = true; });
  });
  $$('.dob select').forEach(sel => sel.addEventListener('change', () => {
    $('#dob-err').hidden = true; $$('.dob select').forEach(x => x.removeAttribute('aria-invalid')); $('#form-err').hidden = true;
  }));

  $('.pane-checkout').addEventListener('submit', e => {
    e.preventDefault();
    const invalid = [], names = [];
    if (state.auth !== 'bankid') {
      const d = $('#dob-d'), m = $('#dob-m'), y = $('#dob-y');
      const first = [d, m, y].find(x => !x.value);
      if (first) { setErr(first, '#dob-err', t('co.age.err')); invalid.push(first); names.push(t('co.err.dob')); }
      else {
        const eighteen = new Date(+y.value + 18, +m.value - 1, +d.value);
        if (eighteen > new Date(2026, 9, 16)) { setErr(y, '#dob-err', t('co.age.young')); invalid.push(y); names.push(t('co.err.dob')); }
        else $('#dob-err').hidden = true;
      }
    }
    const school = $('#school');
    if (!$('#no-school').checked && !school.value.trim()) { setErr(school, '#school-err'); invalid.push(school); names.push(t('co.err.school')); }
    const yes = $('input[name="allergy"]:checked').value === 'yes';
    const allergy = $('#allergy-text');
    if (yes && !allergy.value.trim()) { setErr(allergy, '#allergy-err'); invalid.push(allergy); names.push(t('co.err.allergy')); }
    const fe = $('#form-err');
    fe.hidden = invalid.length === 0;
    if (invalid.length) {
      fe.textContent = t(invalid.length === 1 ? 'co.errs.one' : 'co.errs', { n: invalid.length, list: names.join(', ') });
      invalid[0].focus();
      return;
    }

    if ($('input[name="pay"]:checked').value === 'swish') {
      openSheet('swish');
      setStep('swish');
    } else {
      const btn = $('#pay-btn');
      btn.setAttribute('aria-busy', 'true');
      $('#pay-label').textContent = t('card.wait');
      setTimeout(() => {
        btn.removeAttribute('aria-busy');
        updatePayLabel();
        openSheet('done');
        setStep('done');
      }, 1400);
    }
  });

  // swish
  $('#swish-open').addEventListener('click', () => {
    const btn = $('#swish-open');
    btn.setAttribute('aria-busy', 'true');
    setTimeout(() => btn.removeAttribute('aria-busy'), 2000);
  });
  $('#demo-ok').addEventListener('click', () => { openSheet('done'); setStep('done'); });
  $('#demo-no').addEventListener('click', showSwishError);
  $('#swish-retry').addEventListener('click', hideSwishError);
  function showSwishError() {
    $('.pane-swish').classList.add('is-error');
    $('#swish-err').hidden = false;
    $('#swish-err-text').textContent = t('sw.cancelled', { t: fmt(state.holdEnd - Date.now()) });
    $('#swish-open').hidden = true;
    $('#swish-retry').hidden = false;
    $('#swish-retry').focus();
  }
  function hideSwishError() {
    $('.pane-swish').classList.remove('is-error');
    $('#swish-err').hidden = true;
    $('#swish-open').hidden = false;
    $('#swish-retry').hidden = true;
  }

  // done
  $('#add-cal').addEventListener('click', () => toast(t('toast.cal')));

  // ---------- the ticket object ----------
  function qrSVG(seed = 20261016) {
    const n = 25;
    let x = seed;
    const rand = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1000) / 1000; };
    const cells = [];
    const finder = (r, c) => {
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
        const edge = i === 0 || i === 6 || j === 0 || j === 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (edge || core) cells.push([r + i, c + j]);
      }
    };
    const inFinder = (r, c) => (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8);
    const inMark = (r, c) => r >= 9 && r <= 15 && c >= 9 && c <= 15;
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (inFinder(r, c) || inMark(r, c)) continue;
      if (rand() > 0.52) cells.push([r, c]);
    }
    const rects = cells.map(([r, c]) => `<rect x="${c}" y="${r}" width="1.02" height="1.02"/>`).join('');
    return `<svg viewBox="0 0 ${n} ${n}" fill="#0C0C0C" shape-rendering="crispEdges" role="img" aria-label="${t('tk.qr')}">${rects}</svg>`;
  }

  function ticketHTML() {
    return `
      <svg class="tk-poster" viewBox="0 0 358 200" aria-hidden="true"><use href="#poster-hostrus"/></svg>
      <div class="tk-head">
        <div><b>Höstrus</b><span>${t('ev.date')} · Magasin Tolv</span></div>
        <span class="tk-valid">${t('tk.valid')}</span>
      </div>
      <div class="tk-perf" aria-hidden="true"></div>
      <div class="tk-body">
        <div class="tk-meta">
          <div><small>${t('tk.holder')}</small><b>Alex Lind</b></div>
          <div><small>${t('tk.type')}</small><b>${t('ev.ticket')}</b></div>
        </div>
        <div class="tk-qr">${qrSVG()}<img class="tk-mark" src="assets/monkey-head.png" alt="${t('tk.mark')}" width="34" height="34"></div>
        <div class="tk-live" aria-hidden="true"></div>
        <p class="tk-live-label">${t('tk.live')}</p>
      </div>
      <div class="tk-foot">
        <span><svg class="ic" aria-hidden="true"><use href="#i-id-badge-2"/></svg>${t('tk.id')}</span>
        <span><svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg>${t('tk.entry')}</span>
      </div>`;
  }
  function renderTickets(animate = false) {
    const done = $('#done-ticket');
    done.innerHTML = ticketHTML();
    done.classList.remove('is-filling');
    if (animate) { void done.offsetWidth; done.classList.add('is-filling'); }
    $('#door-ticket').innerHTML = ticketHTML();
  }

  // ---------- variant B ----------
  function resetB() {
    state.bStage = 1;
    $('#b-code-wrap').hidden = true;
    const l = $('#b-submit-label'); l.dataset.i18n = 'b.send'; l.textContent = t('b.send');
  }
  $('#b-form').addEventListener('submit', e => {
    e.preventDefault();
    const phone = $('#b-phone');
    if (state.bStage === 1) {
      const digits = phone.value.replace(/\D/g, '');
      if (digits.length < 8) { phone.setAttribute('aria-invalid', 'true'); $('#b-phone-err').hidden = false; phone.focus(); return; }
      phone.removeAttribute('aria-invalid'); $('#b-phone-err').hidden = true;
      state.bStage = 2;
      $('#b-code-wrap').hidden = false;
      const l = $('#b-submit-label'); l.dataset.i18n = 'b.pay'; l.textContent = t('b.pay');
      $('#b-code').focus();
    } else {
      const btn = $('#b-submit');
      btn.setAttribute('aria-busy', 'true');
      setTimeout(() => { btn.removeAttribute('aria-busy'); go('b2'); }, 1200);
    }
  });
  $('#b-phone').addEventListener('input', () => { $('#b-phone').removeAttribute('aria-invalid'); $('#b-phone-err').hidden = true; });

  // ---------- toast ----------
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  // ---------- wiring ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-go]');
    if (!el) return;
    e.preventDefault();
    go(el.dataset.go, { reset: el.hasAttribute('data-reset') });
  });
  $$('.lang-btn').forEach(b => b.addEventListener('click', () => { state.lang = b.dataset.lang; applyLang(); }));

  // start: ?lang=en and #step deep links (also used to render screenshots)
  const params = new URLSearchParams(location.search);
  if (params.get('shot')) document.documentElement.classList.add('shot');
  let saved = null;
  try { saved = localStorage.getItem('vm-lang'); } catch (e) {}
  state.lang = params.get('lang') || saved || 'sv';
  if (!window.STRINGS[state.lang]) state.lang = 'sv';
  if (params.get('auth')) state.auth = params.get('auth');
  applyLang();
  const start = location.hash.slice(1);
  const valid = ['chat', 'web', 'store', 'open', 'event', 'checkout', 'swish', 'done', 'tickets', 'ticket', 'b1', 'b2'];
  go(valid.includes(start) ? start : 'chat');
  if (params.get('state') === 'errors') $('.pane-checkout').requestSubmit();
  if (params.get('state') === 'swish-cancelled') showSwishError();
  if (params.get('state') === 'confirm') askCancel();
  if (params.get('state') === 'held') { closeSheet(false, 'keep'); history.replaceState(null, '', '#event'); }
  if (params.get('state') === 'filled') { $('#dob-d').value = '4'; $('#dob-m').value = '3'; $('#dob-y').value = '2003'; $('#school').value = 'Min skola'; }
  if (params.get('state') === 'installed') { storeGet.click(); }
  if (params.get('state') === 'email') $('#email-toggle').click();
  if (params.get('state') === 'b-code') { $('#b-phone').value = '70 123 45 67'; $('#b-form').requestSubmit(); }
})();
