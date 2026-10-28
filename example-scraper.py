#!/usr/bin/env python3
"""Example buyer-team scraper for the Little Legion simulation price feed.

Usage:
    python example-scraper.py https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/

Uses only Python's standard library. It fetches the public JSON feed directly,
checks the required offer fields, then prints every offer's full price and terms.
"""
from __future__ import annotations

import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

REQUIRED = {
    "offerId",
    "offerName",
    "productQuantities",
    "totalPrice",
    "eligibilityTerms",
    "effectiveFrom",
    "expiresAt",
    "simulatedAvailability",
}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    base_url = sys.argv[1].strip()
    if not base_url.startswith(("https://", "http://")):
        print("Error: pass the site's full http:// or https:// base URL.", file=sys.stderr)
        return 2
    if not base_url.endswith("/"):
        base_url += "/"

    feed_url = urljoin(base_url, "price-feed.json")
    request = Request(
        feed_url,
        headers={"User-Agent": "CSC322-Classroom-Offer-Scraper/1.0", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            if response.status != 200:
                print(f"Error: feed returned HTTP {response.status}.", file=sys.stderr)
                return 1
            feed = json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"Could not read the price feed at {feed_url}: {exc}", file=sys.stderr)
        return 1

    seller = feed.get("seller", {})
    offers = feed.get("offers", [])
    print(f"Seller: {seller.get('businessName', '(missing businessName)')} ({seller.get('sellerId', '(missing sellerId)')})")
    print(f"Market mode: {feed.get('marketMode', '(missing)')}")
    print(f"Updated: {feed.get('siteUpdatedAt', '(missing)')}")
    if feed.get("marketMode") != "simulation-only":
        print("Warning: expected marketMode='simulation-only'. Review before using these offers.", file=sys.stderr)
    print(f"Offers received: {len(offers)}\n")

    errors = 0
    for offer in offers:
        missing = sorted(REQUIRED - offer.keys())
        if missing:
            errors += 1
            print(f"INVALID {offer.get('offerId', '(no offer ID)')}: missing {', '.join(missing)}")
            continue
        try:
            total_price = float(offer["totalPrice"])
            if total_price < 0:
                raise ValueError("totalPrice cannot be negative")
        except (TypeError, ValueError) as exc:
            errors += 1
            print(f"INVALID {offer['offerId']}: {exc}")
            continue
        quantities = offer["productQuantities"]
        contents = ", ".join(f"{qty} x {product_id}" for product_id, qty in quantities.items())
        print(f"{offer['offerId']} | {offer['offerName']} | ${total_price:.2f} total")
        print(f"  Contents: {contents}")
        print(f"  Eligibility: {offer['eligibilityTerms']}")
        print(f"  Effective: {offer['effectiveFrom']} | Expires: {offer['expiresAt']}")
        print(f"  Virtual availability: {offer['simulatedAvailability']}\n")

    print("Feed validation:", "PASS" if errors == 0 else f"FAIL ({errors} invalid offer(s))")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
