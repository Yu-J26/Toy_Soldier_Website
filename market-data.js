(() => {
  'use strict';

  const money = value => Number.isFinite(Number(value)) ? '$' + Number(value).toFixed(2) : 'See feed';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  function fetchJson(path) {
    return fetch(path).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  fetchJson('price-history.json')
    .then(data => {
      const rows = Array.isArray(data.history) ? data.history : [];
      $('history-rows').innerHTML = rows.length
        ? rows.slice().reverse().map(row => `<tr><td>${escapeHtml(row.timestamp || row.date)}</td><td>${escapeHtml(row.changeType)}</td><td>${escapeHtml(row.details)}</td></tr>`).join('')
        : '<tr><td colspan="3">No history entries published.</td></tr>';
      $('history-status').textContent = `${rows.length} published history entr${rows.length === 1 ? 'y' : 'ies'} · Source: price-history.json`;
    })
    .catch(() => {
      $('history-rows').innerHTML = '<tr><td colspan="3">Could not load history. Open through GitHub Pages or a local web server.</td></tr>';
      $('history-status').textContent = 'History feed: unavailable';
    });

  fetchJson('price-feed.json')
    .then(feed => {
      $('feed-preview').textContent = JSON.stringify(feed, null, 2).slice(0, 7000);
      const sellerId = feed.seller?.sellerId || feed.sellerId || 'not specified';
      $('feed-status').textContent = `Feed loaded · Seller: ${sellerId} · Mode: ${feed.marketMode || 'not specified'}`;

      const offers = Array.isArray(feed.offers) ? feed.offers : (Array.isArray(feed.products) ? feed.products : []);
      $('offer-rows').innerHTML = offers.length ? offers.map(offer => {
        const id = offer.offerId || offer.productId || offer.id || '—';
        const name = offer.offerName || offer.productName || offer.name || offer.title || id;
        const quantity = offer.productQuantities || offer.quantities || offer.quantity || 'See feed';
        const quantityText = typeof quantity === 'object'
          ? Object.entries(quantity).map(([key, value]) => `${key}: ${value}`).join(', ')
          : quantity;
        const price = offer.totalPrice ?? offer.total_price ?? offer.listedUnitPrice ?? offer.price ?? offer.total;
        const eligibility = [
          offer.eligibility || offer.eligibilityTerms,
          offer.simulatedAvailability || offer.availability,
          offer.effectiveAt || offer.effectiveFrom || offer.effectiveTime
        ].filter(Boolean).join(' · ') || 'See JSON feed';
        return `<tr><td><code>${escapeHtml(id)}</code></td><td>${escapeHtml(name)}</td><td>${escapeHtml(quantityText)}</td><td>${money(price)}</td><td>${escapeHtml(eligibility)}</td></tr>`;
      }).join('') : '<tr><td colspan="5">Offer records are available in the JSON preview and downloadable files.</td></tr>';
    })
    .catch(() => {
      $('feed-preview').textContent = 'Could not load price-feed.json. Open this site through GitHub Pages or a local web server.';
      $('feed-status').textContent = 'Feed status: unavailable';
      $('offer-rows').innerHTML = '<tr><td colspan="5">Could not load the feed.</td></tr>';
    });

  function $(id) {
    return document.getElementById(id);
  }
})();
