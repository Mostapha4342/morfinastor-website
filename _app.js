/* ==========================================================================
   MORPHINA STORE — APPLICATION LOGIC (modular vanilla JS)
   ========================================================================== */
(function(){
  'use strict';

  /* ---------- 1. STATE & DATA ---------- */
  const RATES = { USD:1, EUR:0.92, GBp:0.79, MAD:10.0 };
  const SYMBOL = { USD:'$', EUR:'€', GBP:'£', MAD:'MAD' };
  const TAX_RATE = 0;   // 0 = no tax; set e.g. 0.0825 to apply a sales/VAT rate. Applied in USD then re-formatted.
  const CART_KEY = 'morphina_cart';
  const state = {
    currency: localStorage.getItem('morphina_cur') || 'USD',
    theme: localStorage.getItem('morphina_theme') || 'dark',
    cat: 'all',
    query: '',
    cart: loadCart()
  };
  // --- cart persistence helpers ---
  function loadCart(){
    try{ return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch(e){ return {}; }
  }
  function saveCart(){
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }

  /* =====================================================================
     KINGUIN API AUTO-DELIVERY CONFIG
     ---------------------------------------------------------------------
     This block prepares the storefront for Kinguin's REST API so that a
     license KEY is issued automatically the moment a payment succeeds.

     LIVE FLOW (once wired):
       1. Customer clicks "Checkout securely".
       2. We POST the order to our payment provider (Stripe/PayPal) → `createPaymentIntent()`.
       3. On payment success we POST an order to the Kinguin API with the items'
          Kinguin `sku`s (the per-product `sku` field above) using `apiKey`.
       4. Kinguin returns the license key(s) → we store them and email the buyer
          (auto-delivery). See `KinguinClient.placeOrder()` below.

     SECURITY: NEVER expose `apiKey` in client-side code. In production, proxy
     every Kinguin call through YOUR backend (a serverless function or an API
     route) that holds the key and stamps the timestamp + signature server-side.
     ===================================================================== */
  const KINGUIN = {
    enabled: false,                          // ← set true once a backend proxy is live
    baseUrl: 'https://api.kinguin.net',      // Kinguin API root
    signEndpoint: '/v4/sign',                // HMAC signature endpoint (server-side)
    orderEndpoint: '/v4/orders',             // create-order / key-issuance endpoint
    paymentEndpoint: '/v4/orders/{id}/payments', // payment-confirmation → key release
    apiKey: 'REPLACE_WITH_YOUR_SERVER_SIDE_KEY', // placeholder — kept server-side
    // Optional dynamic pricing re-check against Kinguin wholesale cost at checkout.
    margin: 0.22,                            // ≈22% target gross margin above wholesale
  };

  /* =====================================================================
     PAYMENT GATEWAY KEYS & CONFIG
     ---------------------------------------------------------------------
     ⚠️  PLACE YOUR REAL KEYS HERE  ⚠️
     • PAYPAL.clientId  → from the PayPal Developer Dashboard (Live/Test app).
                         The PayPal SDK is loaded lazily, on demand, when the
                         customer reaches Step 2 — so no network call happens
                         until checkout is opened.
     • STRIPE.publishableKey → from the Stripe Dashboard (pk_test_… / pk_live_…).
                         This is a PUBLIC key and is safe to ship in the frontend.
                         Your SECRET key must stay server-side (see the backend
                         proxy comments in KINGUIN above) — never expose it here.
     ===================================================================== */
  const PAYPAL = {
    clientId: 'YOUR_PAYPAL_CLIENT_ID',   // ← paste your PayPal Client ID
    currency: 'USD',                     // PayPal settlement currency (non-USD requires a live merchant account)
    intent: 'capture',                   // 'authorize' or 'capture'
  };
  const STRIPE = {
    publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY', // ← paste your Stripe publishable key (pk_…)
    style: { base: { color:'', fontFamily:'inherit', fontSize:'15px', '::placeholder':{color:'#94a3c6'} } },
  };
  // Builds the payload Kinguin needs for a single cart line. Extend freely.
  function kinguinLine(p, qty){
    return {
      productId: p.sku,     // Kinguin catalog id — `sku` on each PRODUCT
      quantity: qty,
      currency: 'USD',      // Kinguin settles in USD; we display in `state.currency`
      unitPriceUsd: p.price // our chosen retail price (already undercuts the market)
    };
  }
  /* The order object sent to the Kinguin auto-delivery endpoint. */
  function buildKinguinOrder(cartSnapshot){
    return {
      invoiceType: 'personal',
      items: cartSnapshot.map(li => kinguinLine(li.product, li.qty)),
      customer: { email: 'customer@example.com', accountId: 'guest' },
      locale: state.currency,
    };
  }

  // BASE PRICES ARE IN USD. All prices are re-priced live by the currency selector.
  //
  // PRICING STRATEGY (Kinguin Integration):
  //   price  = the customer-facing retail price, tuned to UNDER-CUT the current
  //            Kinguin / G2A market rate while preserving a healthy margin over
  //            our Kinguin wholesale cost. These are the "win" prices.
  //   old    = a REALISTIC MSRP anchor (street/box price), NOT inflated placeholders
  //            (e.g. no more $18,749). It feeds the strikethrough price + "% OFF".
  //   sku    = the Kinguin catalog product-id used by the auto-delivery API
  //            (KEY_ISSUANCE). Placeholder strings — swap in real Kinguin SKUs.
  //   imgSrc = official cover image (see /img/*). Falls back to the emoji + gradient
  //            thumbnail automatically if the file can't load (e.g. offline preview).
  const PRODUCTS = [
    // Operating Systems
    {id:'os1', cat:'os', sku:'KG-W11P-RET', name:'Windows 11 Pro (Retail)', desc:'Retail digital key · lifetime activation', ic:'🪟', grad:'#0ea5e9,#6366f1', imgSrc:'img/win11.jpg', price:13.99, old:29.99, rating:4.97, reviews:2140},
    {id:'os2', cat:'os', sku:'KG-W11H-RET', name:'Windows 11 Home (Retail)', desc:'Retail digital key · lifetime activation', ic:'🪟', grad:'#0ea5e9,#6366f1', imgSrc:'img/win11.jpg', price:11.99, old:24.99, rating:4.98, reviews:1780},
    {id:'os3', cat:'os', sku:'KG-W11P-OEM', name:'Windows 11 Pro (OEM)', desc:'OEM digital key · 1 device', ic:'🪟', grad:'#0ea5e9,#6366f1', imgSrc:'img/win11.jpg', price:12.99, old:22.99, rating:4.96, reviews:1210},
    {id:'os4', cat:'os', sku:'KG-W10P-RET', name:'Windows 10 Pro (Retail)', desc:'Retail digital key · lifetime activation', ic:'💻', grad:'#0ea5e9,#6366f1', imgSrc:'img/win10.jpg', price:7.99, old:19.99, rating:4.9, reviews:980},
    {id:'os5', cat:'os', sku:'KG-W11E-ENT', name:'Windows 11 Enterprise', desc:'Corporate license · lifetime', ic:'🖥️', grad:'#0ea5e9,#6366f1', imgSrc:'img/win11.jpg', price:22.99, old:49.99, rating:4.85, reviews:540},
    // Office Suites
    {id:'of1', cat:'office', sku:'KG-OF24-PP', name:'Office 2024 Professional Plus', desc:'Word, Excel, PowerPoint + more', ic:'📊', grad:'#f59e0b,#ef4444', imgSrc:'img/office2024.jpg', price:26.99, old:79.99, rating:5.0, reviews:860},
    {id:'of2', cat:'office', sku:'KG-OF21-PP', name:'Office 2021 Professional Plus', desc:'Retail digital key · lifetime', ic:'📊', grad:'#f59e0b,#ef4444', imgSrc:'img/office2021.png', price:14.99, old:49.99, rating:4.95, reviews:1540},
    {id:'of3', cat:'office', sku:'KG-OF21-HB', name:'Office 2021 Home & Business', desc:'Mac + PC · lifetime activation', ic:'📘', grad:'#f59e0b,#ef4444', imgSrc:'img/office2021.png', price:12.99, old:39.99, rating:4.93, reviews:760},
    {id:'of4', cat:'office', sku:'KG-365-PH', name:'Office / Microsoft 365 (1 Year)', desc:'Cloud subscription · 5 PC/Mac', ic:'☁️', grad:'#f59e0b,#ef4444', imgSrc:'img/microsoft365.jpg', price:16.99, old:29.99, rating:4.94, reviews:1320},
    // Antivirus
    {id:'av1', cat:'antivirus', sku:'KG-AVAST-PS', name:'Avast Premium Security', desc:'1 year · 10 devices', ic:'🛡️', grad:'#10b981,#22d3ee', imgSrc:'img/avast.png', price:18.99, old:39.99, rating:5.0, reviews:610},
    {id:'av2', cat:'antivirus', sku:'KG-KASP-TS', name:'Kaspersky Total Security', desc:'1 year · 5 devices', ic:'🛡️', grad:'#10b981,#22d3ee', imgSrc:'img/kaspersky.webp', price:20.99, old:44.99, rating:4.99, reviews:720},
    {id:'av3', cat:'antivirus', sku:'KG-ESET-SSP', name:'ESET Smart Security Premium', desc:'1 year · 5 devices', ic:'🔰', grad:'#10b981,#22d3ee', imgSrc:'img/eset.jpg', price:22.99, old:49.99, rating:5.0, reviews:430},
    {id:'av4', cat:'antivirus', sku:'KG-NORTON-36', name:'Norton 360 Deluxe', desc:'1 year · 5 devices', ic:'🛡️', grad:'#10b981,#22d3ee', imgSrc:'', price:14.99, old:29.99, rating:4.75, reviews:380},
    // AI Licenses
    {id:'ai1', cat:'ai', sku:'KG-CHATGPT-P', name:'ChatGPT Plus (1 Year · Shared)', desc:'Premium AI access · GPT-4', ic:'🤖', grad:'#a855f7,#ec4899', imgSrc:'img/chatgpt.jpg', price:63.99, old:119.99, rating:4.9, reviews:940},
    {id:'ai2', cat:'ai', sku:'KG-GEMINI-A', name:'Gemini Advanced (1 Year · Shared)', desc:'Google AI · 2TB storage', ic:'✨', grad:'#a855f7,#ec4899', imgSrc:'img/gemini.png', price:59.99, old:119.99, rating:4.8, reviews:520},
    {id:'ai3', cat:'ai', sku:'KG-CLAUDE-P', name:'Claude Pro (1 Year · Shared)', desc:'Anthropic AI · full model access', ic:'🧠', grad:'#a855f7,#ec4899', imgSrc:'img/chatgpt.jpg', price:55.99, old:99.99, rating:4.9, reviews:430},
    {id:'ai4', cat:'ai', sku:'KG-COPILOT-P', name:'Microsoft Copilot Pro (1 Year)', desc:'Office AI assistant', ic:'🤝', grad:'#a855f7,#ec4899', imgSrc:'img/copilot.png', price:54.99, old:99.99, rating:4.7, reviews:300},
    // Graphics
    {id:'gr1', cat:'graphics', sku:'KG-PS-1Y', name:'Adobe Photoshop (1 Year)', desc:'Creative Cloud · full version', ic:'🎨', grad:'#ef4444,#ec4899', imgSrc:'img/photoshop.jpg', price:73.99, old:139.99, rating:4.95, reviews:560},
    {id:'gr2', cat:'graphics', sku:'KG-AI-1Y', name:'Adobe Illustrator (1 Year)', desc:'Vector design · full version', ic:'🖌️', grad:'#ef4444,#ec4899', imgSrc:'img/illustrator.webp', price:73.99, old:139.99, rating:4.9, reviews:410},
    {id:'gr3', cat:'graphics', sku:'KG-COREL-1Y', name:'CorelDRAW Graphics Suite', desc:'Design suite · lifetime', ic:'✏️', grad:'#ef4444,#ec4899', imgSrc:'', price:49.99, old:99.99, rating:4.85, reviews:280},
    {id:'gr4', cat:'graphics', sku:'KG-CANVA-1Y', name:'Canva Pro (1 Year)', desc:'Design & AI features', ic:'🎨', grad:'#ef4444,#ec4899', imgSrc:'', price:29.99, old:59.99, rating:4.8, reviews:640},
  ];

  const CATS = { os:['#0ea5e9','#6366f1'], office:['#f59e0b','#ef4444'], antivirus:['#10b981','#22d3ee'], ai:['#a855f7','#ec4899'], graphics:['#ef4444','#ec4899'] };
  const CATNAME = { os:'Operating Systems', office:'Office Suites', antivirus:'Antivirus', ai:'AI Tools', graphics:'Graphics' };
  const FEATURED = ['os1','of1','av2','ai1','gr1'];

  /* ---------- 2. HELPERS ---------- */
  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  function fmt(usd){
    const v = usd * RATES[state.currency];
    const s = SYMBOL[state.currency];
    if(state.currency === 'MAD') return s + ' ' + Math.round(v).toLocaleString('en-US');
    return s + v.toFixed(2).replace(/\.00$/, '');
  }
  function savePct(o,n){ return Math.round((1 - n/o)*100); }
  function stars(r){
    let full = Math.round(r);
    if(full > 5) full = 5;
    return '★'.repeat(full) + '☆'.repeat(5-full);
  }
  function toast(msg, type='success'){
    const t = $('#toast');
    t.className = 'show ' + (type==='error' ? 't-error' : type==='info' ? 't-info' : 't-success');
    t.innerHTML = msg;
    clearTimeout(t._t);
    t._t = setTimeout(()=>{ t.className=''; }, 2800);
  }
  function cardHTML(p){
    const pct = savePct(p.old, p.price);
    return `
      <article class="p-card reveal in" data-id="${p.id}" data-cat="${p.cat}">
        <div class="p-thumb" style="background:linear-gradient(135deg,${p.grad})">
          <span class="cat-tag">${CATNAME[p.cat]}</span>
          <span class="sale-tag">-${pct}%</span>
          <span class="icon">${p.ic}</span>
          ${p.imgSrc ? `<img class="p-img" src="${p.imgSrc}" alt="${p.name}" loading="lazy" onerror="this.remove()" />` : ''}
        </div>
        <div class="p-body">
          <div class="p-cat">${CATNAME[p.cat]}</div>
          <div class="p-name">${p.name}</div>
          <div class="p-desc">${p.desc}</div>
          <div class="p-rating"><span class="stars">${stars(p.rating)}</span> ${p.rating.toFixed(2)} <span>(${p.reviews})</span></div>
          <div class="p-price">
            <span class="cur-val">${fmt(p.price)}</span>
            <span class="cur-old">${fmt(p.old)}</span>
            <span class="cur-save">Save ${pct}%</span>
          </div>
          <div class="p-buy">
            <a class="btn btn-primary" data-add="${p.id}" href="#catalog" onclick="return false;">Buy now</a>
            <button class="btn btn-ghost btn-sm" style="padding:.72rem .7rem" data-add="${p.id}">+ Cart</button>
          </div>
        </div>
      </article>`;
  }

  /* ---------- 3. RENDER CATALOG + BEST SELLERS ---------- */
  function renderCatalog(){
    const grid = $('#productGrid');
    const list = PRODUCTS.filter(p =>
      (state.cat==='all' || p.cat===state.cat) &&
      (p.name + ' ' + CATNAME[p.cat]).toLowerCase().includes(state.query.toLowerCase())
    );
    grid.innerHTML = list.map(cardHTML).join('');
    $('#noResults').style.display = list.length ? 'none' : 'block';
  }
  function renderBest(){
    const best = PRODUCTS.filter(p => FEATURED.includes(p.id));
    $('#bestGrid').innerHTML = best.map(cardHTML).join('');
  }
  function repriceAll(){
    renderCatalog();
    renderBest();
    renderCart();
  }

  /* ---------- 4. CART ---------- */
  /* Recompute cart financials. Product prices are stored in USD; fmt() converts
     to the active display currency. Subtotal + tax(if any) + total computed live. */
  function cartTotals(){
    const ids = Object.keys(state.cart);
    const subtotal = ids.reduce((a,k)=> a + PRODUCTS.find(x=>x.id===k).price * state.cart[k], 0);
    const tax = subtotal * TAX_RATE;
    return { ids, subtotal, tax, total: subtotal + tax, count: ids.reduce((a,k)=>a+state.cart[k],0) };
  }
  function renderCart(){
    const { ids, subtotal, tax, total, count } = cartTotals();
    $('#cartCount').textContent = count;
    $('#cartQty').textContent = count ? `(${count})` : '';
    const box = $('#cartItems');
    if(!ids.length){
      box.innerHTML = `<div class="empty"><div class="big">🛒</div><div>Your cart is empty</div><div style="font-size:.82rem">Add a license to get started.</div></div>`;
      $('#cartTotals').hidden = true;
    } else {
      box.innerHTML = ids.map(id => {
        const p = PRODUCTS.find(x=>x.id===id);
        const q = state.cart[id];
        return `<div class="cart-item">
          <div class="thumb" style="background:linear-gradient(135deg,${p.grad})">${p.imgSrc ? `<img src="${p.imgSrc}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.remove()">` : p.ic}</div>
          <div class="info"><div class="nm">${p.name}</div><div class="pr">${fmt(p.price)} each</div></div>
          <div class="qty"><button data-dec="${id}">−</button><span>${q}</span><button data-inc="${id}">+</button></div>
          <button class="rm" data-rm="${id}" aria-label="Remove"><span class="cart-rm">✕</span></button>
        </div>`;
      }).join('');
      const taxHTML = TAX_RATE
        ? `<div class="tr"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
            <div class="tr"><span>Tax (${(TAX_RATE*100).toFixed(2)}%)</span><span>${fmt(tax)}</span></div>`
        : `<div class="tr"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
            <div class="tr"><span>Tax</span><span>Included</span></div>`;
      $('#cartTotals').innerHTML = `${taxHTML}<div class="tr grand"><span>Total</span><span>${fmt(total)}</span></div>`;
      $('#cartTotals').hidden = false;
    }
    $('#cartTotal').textContent = fmt(total);
  }

  function addToCart(id, qty=1){
    state.cart[id] = (state.cart[id]||0) + qty;
    saveCart();
    renderCart();
    const p = PRODUCTS.find(x=>x.id===id);
    toast(`<span>🛒 Added <b>${p.name}</b> to cart.</span>`, 'success');
  }
  // Unified qty setter (handles inc/dec/remove/clear) + persistence
  function setQty(id, qty){
    if(qty<=0) delete state.cart[id];
    else state.cart[id] = qty;
    saveCart(); renderCart();
  }
  function clearCart(){
    state.cart = {};
    saveCart(); renderCart();
    toast('🧹 Cart cleared.', 'info');
  }
  function openCart(){ $('#overlay').classList.add('open'); $('#cartDrawer').classList.add('open'); document.body.style.overflow='hidden'; }
  function closeCart(){ $('#overlay').classList.remove('open'); $('#cartDrawer').classList.remove('open'); document.body.style.overflow=''; }

  // Cart delegation (inc/dec/remove)
  $('#cartItems').addEventListener('click', e=>{
    const inc=e.target.closest('[data-inc]'), dec=e.target.closest('[data-dec]'), rm=e.target.closest('[data-rm]');
    if(inc){ const id=inc.dataset.inc; setQty(id, (state.cart[id]||0)+1); }
    else if(dec){ const id=dec.dataset.dec; setQty(id, (state.cart[id]||0)-1); }
    else if(rm){ const id=rm.dataset.rm; setQty(id, 0); }
  });
  $('#clearCartBtn').addEventListener('click', clearCart);

  /* =====================================================================
     MULTI-STEP CHECKOUT MODAL
     ---------------------------------------------------------------------
     Step 1 → customer details (email + names, validated).
     Step 2 → payment gateway selection (Stripe / PayPal, SDK placeholders).
     Step 3 → order summary & review.
     "Pay securely" runs the Kinguin auto-delivery handshake, shows a spinner,
     then reveals the Order-Success modal with the generated key + copy button
     and an email-dispatch confirmation.
     ===================================================================== */
  let checkoutStep = 1, selectedPM = 'stripe';
  // holds lazily-initialised gateway handles & flags (SDKs load on demand)
  const gateway = { stripeReady:false, stripe:null, elements:null, card:null, paypalRendered:false };
  // inject an external SDK <script> on demand (never blocks first paint)
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(document.querySelector('script[src="'+src+'"]')) return resolve();
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = ()=>resolve(s);
      s.onerror = ()=>reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
  }
  // Stripe Card Element theme-aware style
  function stripeStyle(){
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      base: { color:dark?'#e8efff':'#0b1a33', fontFamily:'inherit', fontSize:'15px',
              '::placeholder':{ color:dark?'#93a3c6':'#8a97b0' } },
      invalid: { color:'#fb7185' }
    };
  }
  // surface a note inside the gateway area (e.g. SDK failed to load)
  function showGatewayNote(sel, msg){ const el=$(sel); if(!el) return; el.innerHTML='⚠️ '+msg; el.hidden=false; }
  // validation for Step 2/3 actions that depend on a valid email
  function ensureEmail(){ return EMAIL_RE.test($('#coEmail').value.trim()); }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function goToStep(n){
    checkoutStep = n;
    $$('.co-step').forEach(el=>el.classList.toggle('active', +el.dataset.stepBody === n));
    // step indicator
    $$('#coDots .step-dot').forEach(d=>{
      const s = +d.dataset.step;
      d.classList.toggle('active', s===n);
      d.classList.toggle('done', s<n);
    });
    $$('#coDots .dash').forEach(d=>d.classList.toggle('done', +d.dataset.dash < n));
    $('#coBack').hidden = n===1;
    $('#coNext').hidden = n===3;
    if(n===3) renderReview();
    updatePaymentUI();
  }
  /* Show/hide the dynamic gateway UI for the selected method and lazy-load the
     relevant SDK. Stripe: mounts the Card Element on Step 2. PayPal: renders the
     Smart Buttons on the Step 3 review screen (where the transaction is placed). */
  function updatePaymentUI(){
    const isPayPal = selectedPM === 'paypal';
    $('#stripeArea').hidden = isPayPal;
    $('#paypalArea').hidden = !isPayPal;
    $('#paypalButtonContainer').hidden = !(isPayPal && checkoutStep===3);
    // "Pay securely" is the Stripe action, shown on the review step only.
    $('#placeOrder').hidden = !(checkoutStep===3 && !isPayPal);
    if(isPayPal && checkoutStep===3) renderPayPal();
    else if(!isPayPal) renderStripe();
  }
  // field-level validation helpers
  function setFieldError(input, on){
    input.classList.toggle('invalid', on);
    const f = input.closest('.field'); if(f) f.classList.toggle('has-err', on);
    return !on;
  }
  function validDetails(){
    const email=$('#coEmail'), first=$('#coFirst'), last=$('#coLast');
    let ok = true;
    ok = setFieldError(email, !EMAIL_RE.test(email.value.trim())) && ok;
    ok = setFieldError(first, !first.value.trim()) && ok;
    ok = setFieldError(last, !last.value.trim()) && ok;
    return ok;
  }
  // live clear an error once the user starts typing a valid value
  ['#coEmail','#coFirst','#coLast'].forEach(sel=>{
    const el = $(sel);
    if(el) el.addEventListener('input', ()=>setFieldError(el, false));
  });
  function renderReview(){
    const { ids, subtotal, tax, total } = cartTotals();
    $('#reviewItems').innerHTML = ids.map(id=>{
      const p = PRODUCTS.find(x=>x.id===id), q = state.cart[id];
      return `<div class="review-item">
        <div class="thumb" style="background:linear-gradient(135deg,${p.grad})">${p.imgSrc ? `<img src="${p.imgSrc}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px" onerror="this.remove()">` : p.ic}</div>
        <div><div class="nm">${p.name}</div><div class="sub">Qty ${q} · Digital delivery</div></div>
        <div class="pr">${fmt(p.price*q)}</div></div>`;
    }).join('');
    const taxHTML = TAX_RATE
      ? `<div class="co-row"><span class="lbl">Tax</span><span>${fmt(tax)}</span></div>`
      : '<div class="co-row"><span class="lbl">Tax</span><span>Included</span></div>';
    $('#reviewTotals').innerHTML = `<div class="co-row"><span class="lbl">Subtotal</span><span>${fmt(subtotal)}</span></div>${taxHTML}<div class="co-row total"><span class="lbl">Total</span><span>${fmt(total)}</span></div>`;
  }
  function openCheckout(){
    if(!Object.keys(state.cart).length){ toast('🛒 Your cart is empty — add a license first.', 'info'); return; }
    $('#checkoutModal').classList.add('open');
    document.body.style.overflow='hidden';
    goToStep(1);
  }
  function closeCheckout(){
    if($('#placeOrder').getAttribute('data-loading')==='1') return; // block close mid-payment
    $('#checkoutModal').classList.remove('open');
    document.body.style.overflow='';
  }
  // payment method switcher (PayPal ⇄ Credit Card / Stripe)
  $('#pmList').addEventListener('click', e=>{
    const opt = e.target.closest('.pm-opt'); if(!opt) return;
    selectedPM = opt.dataset.pm;
    $$('.pm-opt').forEach(o=>o.classList.toggle('selected', o===opt));
    updatePaymentUI();
  });
  $('#coNext').addEventListener('click', ()=>{
    if(checkoutStep===1 && !validDetails()){ toast('⚠️ Please fix the highlighted fields.', 'error'); return; }
    goToStep(checkoutStep+1);
  });
  $('#coBack').addEventListener('click', ()=>goToStep(checkoutStep-1));
  $('#coClose').addEventListener('click', closeCheckout);
  $('#checkoutModal').addEventListener('click', e=>{ if(e.target.id==='checkoutModal') closeCheckout(); });

  /* =====================================================================
     PAYPAL SMART BUTTONS (production-ready)
     ---------------------------------------------------------------------
     SDK: https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID
     Loaded lazily on the review step. `createOrder` builds the purchase unit
     from the live cart total; `onApprove` CAPTURES the transaction, then fires
     the Kinguin fulfillment (`completeOrder`) so the key is released on screen.
     Set PAYPAL.clientId above to enable real payments (placeholder otherwise).
     ===================================================================== */
  async function renderPayPal(){
    if(gateway.paypalRendered) return;
    if(typeof paypal === 'undefined'){
      try{
        await loadScript('https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(PAYPAL.clientId)
          +'&currency='+encodeURIComponent(PAYPAL.currency)+'&intent='+encodeURIComponent(PAYPAL.intent));
      }catch(err){ showGatewayNote('#paypalFallback','PayPal could not be loaded — use card payment or check your connection.'); return; }
    }
    if(typeof paypal === 'undefined' || !paypal.Buttons){
      showGatewayNote('#paypalFallback','PayPal Smart Buttons are unavailable.'); return;
    }
    const light = document.documentElement.getAttribute('data-theme')==='light';
    try{
      paypal.Buttons({
        style: { layout:'vertical', shape:'rect', color: light?'gold':'blue', label:'pay', height:44 },
        createOrder: (data, actions)=> actions.order.create({
          purchase_units:[{ amount:{ value: cartTotals().total.toFixed(2), currency_code: PAYPAL.currency } }]
        }),
        onApprove: async (data, actions)=>{
          try{
            const details = await actions.order.capture();          // capture the transaction
            await completeOrder('paypal', data.orderID, details);   // Kinguin fulfillment + success modal
          }catch(err){
            console.error('PayPal capture failed:', err);
            toast('⚠️ PayPal payment could not be captured. Please try again.', 'error');
          }
        },
        onCancel: ()=> toast('PayPal checkout was cancelled — no charge was made.', 'info'),
        onError: (err)=> toast('⚠️ PayPal error: '+(err && err.message || 'please try again.'), 'error'),
      }).render('#paypalButtonContainer');
      gateway.paypalRendered = true;
    }catch(err){ showGatewayNote('#paypalFallback','Unable to render PayPal buttons.'); }
  }

  /* =====================================================================
     STRIPE CARD ELEMENT (production-ready)
     ---------------------------------------------------------------------
     SDK: https://js.stripe.com/v3/   (set STRIPE.publishableKey above)
     Mounts a Card Element on Step 2. `submitOrder` validates, calls
     `stripe.createToken(card)` (a client-side token placeholder), and on success
     fires the Kinguin fulfillment. In production you'd POST the token to YOUR
     backend to create a PaymentIntent/charge + set up the webhook.
     ===================================================================== */
  async function renderStripe(){
    if(gateway.stripeReady) return;
    if(typeof Stripe === 'undefined'){
      try{ await loadScript('https://js.stripe.com/v3/'); }
      catch(err){ showGatewayNote('#stripeMeta','Stripe could not be loaded — check your connection.'); return; }
    }
    if(typeof Stripe === 'undefined'){ showGatewayNote('#stripeMeta','Stripe is unavailable.'); return; }
    gateway.stripe = Stripe(STRIPE.publishableKey);
    gateway.elements = gateway.stripe.elements();
    gateway.card = gateway.elements.create('card', { style: stripeStyle(), hidePostalCode:true });
    gateway.card.mount('#cardElement');
    gateway.card.on('focus', ()=>$('#cardElement').classList.add('focused'));
    gateway.card.on('blur',  ()=>$('#cardElement').classList.remove('focused'));
    gateway.stripeReady = true;
  }

  /* ---- STRIPE submit: token → fulfillment ---- */
  async function submitOrder(){
    if(selectedPM !== 'stripe') return;           // PayPal is driven by its own button
    const btn = $('#placeOrder');
    btn.setAttribute('data-loading','1');
    btn.querySelector('.spinner').hidden = false;
    const label = $('#placeOrderLabel'), orig = label.textContent;
    label.textContent = 'Processing…';
    try{
      if(!gateway.stripe || !gateway.card) throw new Error('Card form is not ready yet.');
      if(!ensureEmail()) throw new Error('A valid email is required for key delivery.');
      // Client-side token creation (placeholder — see PaymentIntent comment above)
      const { token, error } = await gateway.stripe.createToken(gateway.card);
      if(error) throw new Error(error.message || 'Card details are invalid.');
      await completeOrder('stripe', token && token.id, { token: token && token.id });
    }catch(err){
      console.error('Stripe error:', err);
      toast('⚠️ '+(err.message || 'Payment failed. Please verify your card details.'), 'error');
    }finally{
      btn.removeAttribute('data-loading');
      btn.querySelector('.spinner').hidden = true;
      label.textContent = orig;
      goToStep(1);
    }
  }
  $('#placeOrder').addEventListener('click', submitOrder);

  /* =====================================================================
     SHARED FULFILLMENT — runs the Kinguin handshake + success modal.
     Called by BOTH gateways once payment is authorized/captured.
     provider = 'stripe' | 'paypal'; paymentRef = token.id or PayPal order id.
     ===================================================================== */
  async function completeOrder(provider, paymentRef, details){
    const btn = $('#placeOrder');   // hidden for PayPal, but guarded
    if(btn){ btn.setAttribute('data-loading','1'); const sp=btn.querySelector('.spinner'); if(sp) sp.hidden=false; }
    try{
      const email = $('#coEmail').value.trim();
      const orderItems = Object.keys(state.cart).map(id=>({ product: PRODUCTS.find(x=>x.id===id), qty: state.cart[id] }));
      // ★ Kinguin auto-delivery (availability → purchase → capture keys) ★
      const keys = await processKinguinOrder(orderItems, email || 'customer@example.com');
      // Log the order (production: POST to your order store / DB)
      console.info('📦 ORDER COMPLETE', { provider, paymentRef, ...(details||{}), email, items: orderItems, keys });
      // Success modal
      $('#successEmail').textContent = email || 'your email';
      $('#successRef').textContent = new Date(Date.now()+3600e3).toLocaleString();
      $('#successKey').textContent = keys.map(k=>k.key).join('\n');
      $('#successText').textContent = `${orderItems.length} license${orderItems.length>1?'s are':' is'} ready — your key${keys.length>1?'s are':' is'} below.`;
      $('#checkoutModal').classList.remove('open');
      $('#successModal').classList.add('open');
      toast('✅ Payment successful — order confirmed!', 'success');
      clearCart();
    }catch(err){
      console.error('Order failed:', err);
      throw err;   // let the caller surface the right toast
    }finally{
      if(btn){ btn.removeAttribute('data-loading'); const sp=btn.querySelector('.spinner'); if(sp) sp.hidden=true; }
    }
  }
  // success modal close
  function closeSuccess(){ $('#successModal').classList.remove('open'); document.body.style.overflow=''; }
  $('#successClose').addEventListener('click', closeSuccess);
  $('#successModal').addEventListener('click', e=>{ if(e.target.id==='successModal') closeSuccess(); });

  // copy key to clipboard (with graceful fallback)
  $('#copyKey').addEventListener('click', async ()=>{
    const text = $('#successKey').textContent.trim();
    try{
      await navigator.clipboard.writeText(text);
      toast('📋 Key copied to clipboard!', 'success');
    }catch(e){
      const ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast('📋 Key copied to clipboard!', 'success');
    }
  });

  /* =====================================================================
     KINGUIN AUTO-DELIVERY — MOCK + PRODUCTION-READY
     ---------------------------------------------------------------------
     processKinguinOrder(items, customerEmail)
       Simulates the full Kinguin handshake for an order (one or more products).
       Each step is async so you can drop in the real backend proxy without
       changing the caller. In production, POST the payload to YOUR backend
       (which holds KINGUIN.apiKey server-side), then:
         1. verify stock      → GET  {baseUrl}/v4/products/{sku}/availability
         2. trigger purchase  → POST {baseUrl}/v4/orders { kinguinLine(...) }
         3. capture key       → read `key` from the order/payment response
         4. email the buyer   → transactional email (auto-delivery)
       Returns [{ product, sku, key, orderId }].
     ===================================================================== */
  function fakeKey(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = ()=>Array.from({length:5}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
  }
  const wait = ms => new Promise(r=>setTimeout(r, ms));
  async function processKinguinOrder(items, customerEmail){
    // (1) network handshake latency
    await wait(900);

    // (2) VERIFY AVAILABILITY — real code checks `available === true` per sku.
    if(!items.length) throw new Error('No items in order.');

    // (3) TRIGGER KEY PURCHASE per unit and CAPTURE the generated key response.
    const keys = [];
    for(const {product, qty} of items){
      for(let i=0;i<qty;i++){
        await wait(180);
        const sku = product.sku;
        const response = { orderId:'ORD-'+Date.now(), sku, key: fakeKey(), status:'ACTIVE' };
        keys.push({ product, sku, key: response.key, orderId: response.orderId });
      }
    }

    // (4) email-dispatch confirmation (mock — mirrored by the success modal).
    console.info(`📧 Auto-delivery: ${keys.length} key(s) queued for ${customerEmail}`);
    return keys;
  }

  $('#checkoutBtn').addEventListener('click', openCheckout);
  $('#cartBtn').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', closeCart);

  // Close any open modal / drawer with the Escape key
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape') return;
    if($('#successModal').classList.contains('open')) closeSuccess();
    else if($('#checkoutModal').classList.contains('open')) closeCheckout();
    else if($('#cartDrawer').classList.contains('open')) closeCart();
  });

  // Add-to-cart (delegated on both grids)
  ['#productGrid','#bestGrid'].forEach(sel=>{
    $(sel).addEventListener('click', e=>{
      const btn = e.target.closest('[data-add]');
      if(btn){ addToCart(btn.dataset.add); }
    });
  });

  /* ---------- 5. CATEGORY FILTER ---------- */
  $('#filters').addEventListener('click', e=>{
    const b = e.target.closest('.filt');
    if(!b) return;
    $$('.filt').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    state.cat = b.dataset.cat;
    renderCatalog();
  });
  // nav category dropdown
  $('#catMenu').addEventListener('click', e=>{
    const b = e.target.closest('button[data-cat]');
    if(!b) return;
    state.cat = b.dataset.cat;
    const filt = $(`.filt[data-cat="${state.cat}"]`);
    if(filt){ $$('.filt').forEach(x=>x.classList.remove('active')); filt.classList.add('active'); }
    renderCatalog();
    $('#catDD').classList.remove('open');
    document.getElementById('catalog').scrollIntoView({behavior:'smooth'});
  });

  /* ---------- 6. SEARCH ---------- */
  function doSearch(v){
    state.query = v.trim();
    renderCatalog();
  }
  $('#searchInput').addEventListener('input', e=>{ doSearch(e.target.value); $('#searchMobile').value = e.target.value; });
  const sm = $('#searchMobile');
  if(sm) sm.addEventListener('input', e=>{ doSearch(e.target.value); });

  /* ---------- 7. CURRENCY ---------- */
  $('#curMenu').addEventListener('click', e=>{
    const b = e.target.closest('button[data-cur]');
    if(!b) return;
    setCurrency(b.dataset.cur);
    $('#curDD').classList.remove('open');
  });
  function setCurrency(c){
    state.currency = c;
    localStorage.setItem('morphina_cur', c);
    $('#curSymbol').textContent = SYMBOL[c];
    $$('#curMenu button').forEach(x=>x.classList.toggle('active', x.dataset.cur===c));
    repriceAll();
  }

  /* ---------- 8. THEME ---------- */
  function applyTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('morphina_theme', t);
    // retint the WebGL scene lighting/materials so the 3D follows the theme
    if(window.__setThreeTheme) window.__setThreeTheme(t);
    // retint the Stripe Card Element so it matches dark/light mode
    if(typeof gateway !== 'undefined' && gateway.card) gateway.card.update({ style: stripeStyle() });
  }
  $('#themeSwitch').addEventListener('click', ()=>{
    state.theme = state.theme==='dark'?'light':'dark';
    applyTheme(state.theme);
  });

  /* ---------- 9. DROPDOWNS / MOBILE MENU ---------- */
  function closeDDs(){ $$('.dd').forEach(d=>d.classList.remove('open')); $('#mobileMenu').classList.remove('open'); }
  function toggleDD(el){
    const was = el.classList.contains('open');
    closeDDs();
    if(!was) el.classList.add('open');
  }
  $('#catBtn').addEventListener('click', e=>{ e.stopPropagation(); toggleDD($('#catDD')); });
  $('#curBtn').addEventListener('click', e=>{ e.stopPropagation(); toggleDD($('#curDD')); });
  document.addEventListener('click', e=>{ if(!e.target.closest('.dd')) closeDDs(); });
  $('#burger').addEventListener('click', e=>{ e.stopPropagation(); $('#mobileMenu').classList.toggle('open'); });
  $$('#mobileMenu [data-close]').forEach(el=>el.addEventListener('click', closeDDs));

  /* ---------- 10. FAQ ---------- */
  $$('.faq-q').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = btn.parentElement;
      const was = item.classList.contains('open');
      $$('.faq-item').forEach(x=>x.classList.remove('open'));
      if(!was) item.classList.add('open');
    });
  });

  /* ---------- 11. COUNTDOWN ---------- */
  let end = new Date(); end.setHours(23,59,59,999);
  const cd = $('#countdown');
  function tick(){
    let d = end - new Date();
    if(d<=0){ end=new Date(); end.setDate(end.getDate()+1); end.setHours(23,59,59,999); d = end - new Date(); }
    const h = String(Math.floor(d/3.6e6)).padStart(2,'0');
    const m = String(Math.floor(d%3.6e6/6e4)).padStart(2,'0');
    const s = String(Math.floor(d%6e4/1e3)).padStart(2,'0');
    cd.textContent = `${h}:${m}:${s}`;
  }
  tick(); setInterval(tick, 1000);

  /* ---------- 12. 3D TILT (vanilla JS, works offline) ---------- */
  function bindTilt(container){
    container.addEventListener('mousemove', e=>{
      const cards = container.querySelectorAll('.p-card');
      cards.forEach(card=>{
        const r = card.getBoundingClientRect();
        if(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom){
          const cx = r.left + r.width/2, cy = r.top + r.height/2;
          const dx = (e.clientX - cx)/r.width, dy = (e.clientY - cy)/r.height;
          card.style.setProperty('--ry', (dx*10).toFixed(2)+'deg');
          card.style.setProperty('--rx', (-dy*10).toFixed(2)+'deg');
          card.style.setProperty('--mx', (dx*50+50)+'%');
          card.style.setProperty('--my', (dy*50+50)+'%');
        }
      });
    });
    container.addEventListener('mouseleave', ()=>{
      container.querySelectorAll('.p-card').forEach(card=>{
        card.style.setProperty('--rx','0deg');
        card.style.setProperty('--ry','0deg');
      });
    });
  }
  bindTilt($('#productGrid'));
  bindTilt($('#bestGrid'));

  /* ---------- 13. REVEAL ON SCROLL ---------- */
  const io = new IntersectionObserver(es=>{
    es.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:.1});
  $$('.reveal').forEach(el=>io.observe(el));

  /* =====================================================================
     14. THREE.JS HERO — theme-aware, high-fidelity 3D scene
     ---------------------------------------------------------------------
     • A soft, undulating "depth mesh" of glowing blue points, a sparse drifting
       particle field, and faint orbit rings — pushed far back so they read as a
       subtle ambient atmosphere BEHIND the hero text & cards, never a foreground
       block. The canvas is `pointer-events:none` and layered beneath the UI, so
       all clicks, scrolls and interactions pass straight through.
     • `setThreeTheme()` lerps the scene lighting/materials toward the current
       theme palette (deep electric blue in dark, sky blue in light) so the
       3D seamlessly follows the Dark/Light toggle.
     • Degrades gracefully: if the CDN can't load, the hero falls back to the
       pure-CSS floating cards, so the preview never breaks.
     ===================================================================== */
  // map the page's CSS-theme palette into hex the renderer understands
  const THEME3D = {
    dark:  { bg:0x050a18, deep:0x2b6bff, mid:0x4f8cff, ice:0x38bdf8, ambient:0x2b3a66, ambientI:0.55, pInt:1.5 },
    light: { bg:0xeef4ff, deep:0x0a84ff, mid:0x3b82f6, ice:0x38bdf8, ambient:0xffffff, ambientI:0.9,  pInt:0.9 }
  };
  let threeTheme = 'dark', threeRefs = null;

  function initThree(){
    const canvas = $('#hero3d');
    if(!canvas || typeof THREE === 'undefined'){ canvas && (canvas.style.display='none'); return; } // graceful fallback
    try{
      threeTheme = state.theme;               // start the scene on the saved theme
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth/canvas.clientHeight, .1, 1000);
      camera.position.set(0, 0, 26);
      const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const pal = THEME3D[threeTheme];

      // --- soft, dim lights (referenced so setThreeTheme can retint them) ---
      const amb = new THREE.AmbientLight(pal.ambient, pal.ambientI);
      const key = new THREE.PointLight(pal.mid, pal.pInt, 60);  key.position.set(6,6,10);
      const fill = new THREE.PointLight(pal.ice, 0.4, 60);       fill.position.set(-8,-4,-4);
      scene.add(amb, key, fill);

      // --- ambient "depth mesh": a soft grid of glowing points that undulates in Z.
      //     Pushed far back so it reads as atmosphere behind the UI, not a block.
      const COLS=72, ROWS=46, COUNT=COLS*ROWS;
      const meshXY = new Float32Array(COUNT*2);     // base x,y per point
      const meshPos = new Float32Array(COUNT*3);
      const meshPhase = new Float32Array(COUNT);
      let mi=0;
      for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
          const x=(c/(COLS-1)-.5)*48;
          const y=(r/(ROWS-1)-.5)*32;
          meshXY[mi*2]=x; meshXY[mi*2+1]=y;
          meshPos[mi*3]=x; meshPos[mi*3+1]=y; meshPos[mi*3+2]=0;
          meshPhase[mi]=x*.35+y*.22; mi++;
        }
      }
      const meshGeo = new THREE.BufferGeometry();
      meshGeo.setAttribute('position', new THREE.BufferAttribute(meshPos,3));
      const meshMat = new THREE.PointsMaterial({ color:pal.mid, size:.16, transparent:true, opacity:.42, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending });
      const mesh = new THREE.Points(meshGeo, meshMat);
      mesh.position.z=-17; scene.add(mesh);

      // --- sparse floating particles ---
      const pGeo = new THREE.BufferGeometry();
      const N = 520, pos = new Float32Array(N*3);
      for(let i=0;i<N;i++){ pos[i*3]=(Math.random()-.5)*54; pos[i*3+1]=(Math.random()-.5)*40; pos[i*3+2]=(Math.random()-.5)*30-6; }
      pGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
      const pMat = new THREE.PointsMaterial({ color:0xffffff, size:.11, transparent:true, opacity:.35, sizeAttenuation:true, depthWrite:false });
      const points = new THREE.Points(pGeo, pMat);
      scene.add(points);

      // --- soft glowing orbit rings (faint, pushed into the background) ---
      const ringMat = new THREE.MeshBasicMaterial({ color:pal.ice, wireframe:true, transparent:true, opacity:.2 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(15,.05,8,120), ringMat);
      ring.rotation.x=Math.PI/2.3; ring.position.z=-14; scene.add(ring);
      const ring2Mat = new THREE.MeshBasicMaterial({ color:pal.deep, wireframe:true, transparent:true, opacity:.14 });
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(20,.04,8,140), ring2Mat);
      ring2.rotation.x=Math.PI/1.8; ring2.rotation.y=.6; ring2.position.z=-18; scene.add(ring2);

      // --- fog for depth ---
      scene.fog = new THREE.FogExp2(pal.bg, 0.016);

      threeRefs = { scene, renderer, camera, amb, key, fill, meshMat, meshGeo, meshXY, meshPhase, mesh, pMat, points, ringMat, ring2Mat, ring, ring2 };

      // --- cursor parallax ---
      let mouseX=0, mouseY=0;
      window.addEventListener('pointermove', e=>{
        mouseX = (e.clientX/window.innerWidth - .5);
        mouseY = (e.clientY/window.innerHeight - .5);
      }, {passive:true});

      const clock = new THREE.Clock();
      const meshArray = meshGeo.attributes.position.array;
      (function animate(){
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        scene.fog.color.setHex(THEME3D[threeTheme].bg);
        // gentle glowing wave across the depth mesh
        for(let i=0;i<COUNT;i++){
          const bx=meshXY[i*2], by=meshXY[i*2+1];
          meshArray[i*3+2] = Math.sin(bx*.25 + t*1.1 + meshPhase[i])*1.5 + Math.cos(by*.2 + t*.7)*1.5;
        }
        meshGeo.attributes.position.needsUpdate = true;
        points.rotation.y = t*.02;
        ring.rotation.z += .0008;
        ring2.rotation.z -= .0006;
        // very subtle cursor parallax depth shift
        camera.position.x += (mouseX*2.5 - camera.position.x)*.04;
        camera.position.y += (-mouseY*2.5 - camera.position.y)*.04;
        camera.lookAt(0,0,0);
        renderer.render(scene, camera);
      })();

      function onResize(){
        camera.aspect = canvas.clientWidth/canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      }
      window.addEventListener('resize', onResize);

      // smooth-morph scene to the active palette (called on theme switch)
      window.__setThreeTheme = function(t){
        threeTheme = t;
        if(!threeRefs) return;
        const p = THEME3D[t];
        // lerp each color toward target
        const lerpTo = (obj, hex, f)=>{ const c=new THREE.Color(hex); obj.r+= (c.r-obj.r)*f; obj.g+=(c.g-obj.g)*f; obj.b+=(c.b-obj.b)*f; };
        lerpTo(amb.color, p.ambient, .4); amb.intensity += (p.ambientI-amb.intensity)*.4;
        lerpTo(key.color, p.mid, .4);      key.intensity += (p.pInt-key.intensity)*.4;
        lerpTo(fill.color, p.ice, .4);
        threeRefs.meshMat.color.lerp(new THREE.Color(p.mid), .4);
        threeRefs.ringMat.color.lerp(new THREE.Color(p.ice), .4);
        threeRefs.ring2Mat.color.lerp(new THREE.Color(p.deep), .4);
        threeRefs.meshMat.opacity = t==='light'? .26 : .42;
        threeRefs.pMat.opacity = t==='light'? .22 : .35;
        threeRefs.pMat.size = t==='light'? .09 : .11;
        renderer.toneMappingExposure = t==='light'? .9 : 1.05;
      };
      window.__setThreeTheme(threeTheme);
    }catch(err){ console.warn('Three.js hero disabled:', err); }
  }

  /* ---------- 14b. STAGE POINTER PARALLAX (pure-3D CSS cards) ---------- */
  function bindStageTilt(){
    const stage = document.querySelector('.stage');
    if(!stage) return;
    stage.addEventListener('mousemove', e=>{
      const r = stage.getBoundingClientRect();
      const dx = (e.clientX-r.left)/r.width - .5, dy = (e.clientY-r.top)/r.height - .5;
      // custom props inherit to children: translate the whole visual + add rotation
      stage.style.setProperty('--px', (dx*-12).toFixed(1)+'px');
      stage.style.setProperty('--py', (dy*-12).toFixed(1)+'px');
      stage.querySelectorAll('.card3d').forEach(c=>{
        // keep the CSS-declared base rotation and layer the parallax on top
        const base = getComputedStyle(c).getPropertyValue('--tt').trim() || 'rotateY(0deg) rotateX(0deg)';
        c.style.setProperty('--tt', `${(dx*16).toFixed(2)}deg ${(dy*-16).toFixed(2)}deg ${base}`);
      });
    });
    stage.addEventListener('mouseleave', ()=>{
      stage.style.setProperty('--px','0px'); stage.style.setProperty('--py','0px');
      stage.querySelectorAll('.card3d').forEach(c=>c.style.removeProperty('--tt'));
    });
  }

  /* ---------- 15. INIT ---------- */
  applyTheme(state.theme);
  setCurrency(state.currency);
  renderCatalog();
  renderBest();
  bindStageTilt();
  $('#year').textContent = new Date().getFullYear();
  initThree();
})();
