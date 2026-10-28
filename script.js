(() => {
  'use strict';

  const FEED_URL = 'price-feed.json';
  const STORAGE_KEY = 'littleLegionSimulationDemoReceiptsV1';
  const unitOfferByProduct = {
    'SOLDIER-BASIC': 'OFFER-BASIC-UNIT-001',
    'SOLDIER-PREMIUM': 'OFFER-PREMIUM-UNIT-001',
    'SOLDIER-COLLECTOR': 'OFFER-COLLECTOR-UNIT-001'
  };
  const productCatalog = {
    'SOLDIER-BASIC': { price: 2.00 },
    'SOLDIER-PREMIUM': { price: 3.25 },
    'SOLDIER-COLLECTOR': { price: 4.50 }
  };
  const offerCatalog = {
    'OFFER-BASIC-UNIT-001': { name: 'Classic Green Soldier', price: 2.00, quantities: { 'SOLDIER-BASIC': 1 } },
    'OFFER-BASIC-TRIO-001': { name: 'Three-Soldier Squad', price: 5.70, quantities: { 'SOLDIER-BASIC': 3 } },
    'OFFER-MIXED-SET-001': { name: 'Mixed Patrol', price: 6.75, quantities: { 'SOLDIER-BASIC': 2, 'SOLDIER-PREMIUM': 1 } },
    'OFFER-PREMIUM-UNIT-001': { name: 'Desert Tan Soldier', price: 3.25, quantities: { 'SOLDIER-PREMIUM': 1 } },
    'OFFER-COLLECTOR-UNIT-001': { name: 'Collector Bronze Soldier', price: 4.50, quantities: { 'SOLDIER-COLLECTOR': 1 } }
  };

  let cart = [];
  const $ = id => document.getElementById(id);
  const money = value => '$' + Number(value).toFixed(2);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  function readReceipts() {
    try {
      const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];
    } catch (_) {
      return [];
    }
  }

  function saveReceipts(rows) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      return true;
    } catch (_) {
      return false;
    }
  }

  function validPrice(value) {
    return value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
  }

  function applyPriceFeed(feed) {
    if (Array.isArray(feed.products)) {
      feed.products.forEach(product => {
        const current = productCatalog[product.productId];
        if (current && validPrice(product.listedUnitPrice)) current.price = Number(product.listedUnitPrice);
      });
    }

    if (Array.isArray(feed.offers)) {
      feed.offers.forEach(publishedOffer => {
        const current = offerCatalog[publishedOffer.offerId];
        if (!current) return;
        if (validPrice(publishedOffer.totalPrice)) current.price = Number(publishedOffer.totalPrice);
        if (publishedOffer.offerName) current.name = publishedOffer.offerName;
        if (publishedOffer.productQuantities && typeof publishedOffer.productQuantities === 'object') {
          const quantities = Object.fromEntries(Object.entries(publishedOffer.productQuantities)
            .filter(([productId, quantity]) => productCatalog[productId] && Number.isInteger(Number(quantity)) && Number(quantity) > 0)
            .map(([productId, quantity]) => [productId, Number(quantity)]));
          if (Object.keys(quantities).length) current.quantities = quantities;
        }
      });
    }

    document.querySelectorAll('[data-product]').forEach(card => {
      const offer = offerCatalog[unitOfferByProduct[card.dataset.product]];
      const price = card.querySelector('[data-product-price]');
      if (offer && price) price.textContent = offer.price.toFixed(2);
    });

    document.querySelectorAll('[data-offer]').forEach(card => {
      const offer = offerCatalog[card.dataset.offer];
      if (!offer) return;
      const price = card.querySelector('[data-offer-price]');
      if (price) price.textContent = offer.price.toFixed(2);
      const listPrice = Object.entries(offer.quantities).reduce((sum, [productId, quantity]) => {
        return sum + (productCatalog[productId]?.price || 0) * quantity;
      }, 0);
      const regularPrice = card.querySelector('del');
      if (regularPrice && listPrice > 0) regularPrice.textContent = money(listPrice);
    });
  }

  function loadPriceFeed() {
    fetch(FEED_URL)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(feed => {
        if (!feed || typeof feed !== 'object') throw new Error('Invalid feed');
        applyPriceFeed(feed);
        if (cart.length) renderCart();
        if (feed.siteUpdatedAt) {
          const updated = new Date(feed.siteUpdatedAt);
          $('updated-at').textContent = Number.isNaN(updated.getTime())
            ? 'See price-feed.json'
            : updated.toLocaleString();
        }
      })
      .catch(() => {
        $('updated-at').textContent = 'See price-feed.json';
      });
  }

  function cartCount() {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  function cartTotal() {
    return cart.reduce((total, item) => total + offerCatalog[item.id].price * item.quantity, 0);
  }

  function renderCart() {
    const host = $('cart-items');
    if (cart.length === 0) {
      host.innerHTML = '<p class="small-note">Your cart is empty. Add a soldier or bundle to create a demo receipt.</p>';
    } else {
      host.innerHTML = cart.map(item => {
        const offer = offerCatalog[item.id];
        const safeId = escapeHtml(item.id);
        const safeName = escapeHtml(offer.name);
        return `<div class="cart-line"><div><strong>${safeName}</strong><small>${safeId}</small></div><div class="qty-controls"><button type="button" data-minus="${safeId}" aria-label="Remove one ${safeName}">−</button><span>${item.quantity}</span><button type="button" data-plus="${safeId}" aria-label="Add one ${safeName}">+</button></div><strong>${money(offer.price * item.quantity)}</strong></div>`;
      }).join('');
    }
    $('cart-count').textContent = String(cartCount());
    $('cart-total').textContent = money(cartTotal());
  }

  function openCart() {
    renderCart();
    if (!$('cart-dialog').open) $('cart-dialog').showModal();
  }

  function addToCart(id) {
    const offer = offerCatalog[id];
    if (!offer) return;
    const existing = cart.find(item => item.id === id);
    if (existing) existing.quantity = Math.min(existing.quantity + 1, 99);
    else cart.push({ id, quantity: 1 });
    $('checkout-result').textContent = '';
    openCart();
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderReceipts() {
    const receipts = readReceipts();
    $('receipt-list').innerHTML = receipts.length ? receipts.map(receipt => {
      const createdAt = new Date(receipt.createdAt);
      const dateText = Number.isNaN(createdAt.getTime()) ? 'Date unavailable' : createdAt.toLocaleString();
      const itemCount = Array.isArray(receipt.items) ? receipt.items.length : 0;
      const total = validPrice(receipt.total) ? money(receipt.total) : '$0.00';
      return `<div class="receipt-row"><div><strong>${escapeHtml(receipt.buyerName || 'Demo buyer')} · ${escapeHtml(receipt.receiptId || 'Receipt')}</strong><small>${dateText} · ${itemCount} line(s) · Demo only</small></div><strong>${total}</strong></div>`;
    }).join('') : '<p>No demo receipts saved in this browser yet.</p>';
  }

  function createReceipt(event) {
    event.preventDefault();
    if (cart.length === 0) {
      $('checkout-result').textContent = 'Add an item before generating a receipt.';
      return;
    }

    const form = new FormData(event.currentTarget);
    const buyerName = String(form.get('buyerName') || '').trim();
    if (!buyerName) {
      $('checkout-result').textContent = 'Enter a demo buyer name to generate a receipt.';
      $('buyer-name').focus();
      return;
    }

    const receiptId = `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const receipt = {
      receiptId,
      status: 'LOCAL DEMO ONLY — NOT AN OFFICIAL SCORED TRANSACTION',
      buyerName,
      buyerId: String(form.get('buyerId') || '').trim(),
      createdAt: new Date().toISOString(),
      currency: 'USD',
      total: Number(cartTotal().toFixed(2)),
      items: cart.map(item => {
        const offer = offerCatalog[item.id];
        return {
          offerId: item.id,
          offerName: offer.name,
          quantity: item.quantity,
          unitOfferPrice: offer.price,
          lineTotal: Number((offer.price * item.quantity).toFixed(2)),
          productQuantities: { ...offer.quantities }
        };
      })
    };

    const receipts = readReceipts();
    receipts.unshift(receipt);
    receipts.length = Math.min(receipts.length, 100);
    const saved = saveReceipts(receipts);
    const storageMessage = saved
      ? 'Saved in this browser only.'
      : 'This browser could not save the receipt. Download a copy now.';
    $('checkout-result').innerHTML = `<div class="receipt-success"><strong>Demo receipt created</strong><p>Receipt ID: <b>${escapeHtml(receipt.receiptId)}</b></p><p>Buyer: ${escapeHtml(receipt.buyerName)} · Total: <b>${money(receipt.total)}</b></p><p class="small-note">${storageMessage} ${escapeHtml(receipt.status)}</p><a href="#" id="download-this-receipt">Download receipt JSON</a></div>`;
    $('download-this-receipt').addEventListener('click', downloadEvent => {
      downloadEvent.preventDefault();
      download(`receipt-${receipt.receiptId}.json`, JSON.stringify(receipt, null, 2), 'application/json');
    });

    cart = [];
    renderCart();
    event.currentTarget.reset();
    if (saved) renderReceipts();
  }

  document.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => addToCart(button.dataset.add));
  });

  $('open-cart').addEventListener('click', openCart);
  $('cart-items').addEventListener('click', event => {
    const button = event.target.closest('[data-minus], [data-plus]');
    if (!button) return;
    const id = button.dataset.minus || button.dataset.plus;
    const item = cart.find(row => row.id === id);
    if (!item) return;
    if (button.hasAttribute('data-minus')) {
      if (item.quantity > 1) item.quantity--;
      else cart = cart.filter(row => row.id !== id);
    } else {
      item.quantity = Math.min(99, item.quantity + 1);
    }
    renderCart();
  });

  $('checkout-form').addEventListener('submit', createReceipt);
  $('view-receipts').addEventListener('click', () => {
    $('receipt-panel').classList.remove('hidden');
    renderReceipts();
    $('receipt-panel').scrollIntoView({ behavior: 'smooth' });
  });
  $('close-receipts').addEventListener('click', () => $('receipt-panel').classList.add('hidden'));
  $('export-demo').addEventListener('click', () => {
    download('little-legion-demo-receipts.json', JSON.stringify({
      marketMode: 'simulation-only',
      official: false,
      receipts: readReceipts()
    }, null, 2), 'application/json');
  });

  renderCart();
  loadPriceFeed();
})();
