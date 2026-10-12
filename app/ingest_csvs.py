#!/usr/bin/env python3
"""Build-time CSV ingestion for the Analytica demo prototype.

Takes real merchant CSV exports and produces the same data/*.json contract the
demo frames consume — so the demo runs on a merchant's own numbers with zero
code changes. Graceful: spend.csv + orders.csv are required (Frames 1 & 3);
ads.csv, daily_adset.csv, funnel.csv are optional (their frames degrade to an
honest "bring this file" state when missing).

CSV contract
------------
spend.csv (REQUIRED): adset_id, adset_name, channel, spend_egp, platform_roas
orders.csv (REQUIRED): order_id, adset_id, order_value_egp, cogs_egp,
    shipping_cost_egp, return_shipping_egp, courier_status, [ad_id optional]
    courier_status in {delivered, refused, rto, cancelled} (case-insensitive).
    Missing cogs/shipping columns or blank cells fall back to --cogs-default etc.
ads.csv (OPTIONAL): ad_id, ad_name, adset_id, spend_egp, platform_roas,
    frequency, ctr_14d_ago, ctr_now, [impressions, clicks optional]
    Per-ad profit/POAS needs ad_id on orders (order<->ad linkage). Without it,
    ads carry spend/CTR/frequency only and Frame 4 shows its locked state.
daily_adset.csv (OPTIONAL): date, adset_id, spend_egp, platform_roas, cpc_egp,
    ctr_pct, aov_egp, failed_delivery_rate_pct   (powers Frame 5)
funnel.csv (OPTIONAL): date, channel, step, count
    step in {session, add_to_cart, checkout, purchase}   (powers Frame 2)

POAS math mirrors the validation-kit assumptions A1-A5, A7 (see meta.json).

Usage:
    python3 ingest_csvs.py --in ./csvs --out ./data --brand "InYourShoe"
"""

import argparse
import csv
import json
import os
import sys

STATUSES = {"delivered", "refused", "rto", "cancelled"}
FUNNEL_STEPS = {"session", "add_to_cart", "checkout", "purchase"}

ASSUMPTIONS = [
    "A1 Delivered orders count full order value as revenue.",
    "A2 Refused/RTO orders bring zero revenue but paid shipping; RTO also paid return shipping.",
    "A3 Cancelled orders never shipped — excluded entirely.",
    "A4 COGS counted only on delivered orders (refused goods assumed restockable).",
    "A5 Platform ROAS is taken as reported, not re-computed.",
    "A7 Blended true POAS = total profit / total spend; blended platform ROAS = spend-weighted average.",
]

REQUIRED = {
    "spend.csv": ["adset_id", "adset_name", "channel", "spend_egp", "platform_roas"],
    "orders.csv": ["order_id", "adset_id", "order_value_egp", "courier_status"],
}
OPTIONAL = {
    "ads.csv": ["ad_id", "ad_name", "adset_id", "spend_egp", "platform_roas",
                "frequency", "ctr_14d_ago", "ctr_now"],
    "daily_adset.csv": ["date", "adset_id", "spend_egp", "platform_roas", "cpc_egp",
                        "ctr_pct", "aov_egp", "failed_delivery_rate_pct"],
    "funnel.csv": ["date", "channel", "step", "count"],
}


def fnum(v, default=0.0):
    try:
        return float(v) if v not in (None, "") else default
    except (TypeError, ValueError):
        return default


def read_csv(path, required_cols):
    errors = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        missing = [c for c in required_cols if c not in cols]
        if missing:
            errors.append(f"{os.path.basename(path)}: missing columns: {', '.join(missing)}")
            return [], errors
        return list(reader), errors


def order_profit(o, d):
    st = o["courier_status"].strip().lower()
    value = fnum(o.get("order_value_egp"), 0.0)
    cogs = fnum(o.get("cogs_egp"), d["cogs"])
    ship = fnum(o.get("shipping_cost_egp"), d["ship"])
    rship = fnum(o.get("return_shipping_egp"), d["rship"])
    if st == "delivered":
        return value - cogs - ship
    if st == "refused":
        return -ship
    if st == "rto":
        return -ship - rship
    return None  # cancelled -> excluded


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="indir", required=True)
    ap.add_argument("--out", dest="outdir", required=True)
    ap.add_argument("--brand", default="Merchant export")
    ap.add_argument("--cogs-default", type=float, default=0.0)
    ap.add_argument("--ship-default", type=float, default=60.0)
    ap.add_argument("--rship-default", type=float, default=60.0)
    a = ap.parse_args()
    dflt = {"cogs": a.cogs_default, "ship": a.ship_default, "rship": a.rship_default}

    errors, warnings = [], []

    # ---- required files ----
    spend, e = read_csv(os.path.join(a.indir, "spend.csv"), REQUIRED["spend.csv"])
    errors += e
    orders, e = read_csv(os.path.join(a.indir, "orders.csv"), REQUIRED["orders.csv"])
    errors += e
    if errors:
        print("INGEST FAILED:")
        for x in errors:
            print("  -", x)
        sys.exit(1)

    for r in spend:
        r["spend_egp"] = fnum(r["spend_egp"])
        r["platform_roas"] = fnum(r["platform_roas"])
    adset_ids = {r["adset_id"] for r in spend}

    profit_by_adset, profit_by_ad, delivered_values = {}, {}, []
    econ_by_adset = {}
    has_linkage = False
    for o in orders:
        st = o["courier_status"].strip().lower()
        if st not in STATUSES:
            errors.append(f"orders.csv: unknown courier_status '{o['courier_status']}' "
                          f"(order {o.get('order_id')})")
            continue
        if o["adset_id"] not in adset_ids:
            warnings.append(f"orders.csv: order {o.get('order_id')} references unknown "
                            f"adset_id '{o['adset_id']}' — skipped")
            continue
        p = order_profit(o, dflt)
        if p is None:
            continue  # cancelled
        profit_by_adset[o["adset_id"]] = profit_by_adset.get(o["adset_id"], 0.0) + p
        value = fnum(o.get("order_value_egp"), 0.0)
        cogs = fnum(o.get("cogs_egp"), dflt["cogs"])
        ship = fnum(o.get("shipping_cost_egp"), dflt["ship"])
        rship = fnum(o.get("return_shipping_egp"), dflt["rship"])
        e = econ_by_adset.setdefault(o["adset_id"],
                                     {"revenue": 0.0, "cogs": 0.0, "ship": 0.0, "failed": 0.0})
        if st == "delivered":
            e["revenue"] += value
            e["cogs"] += cogs
            e["ship"] += ship
            delivered_values.append(value)
        elif st == "refused":
            e["failed"] += ship
        elif st == "rto":
            e["failed"] += ship + rship
        ad_id = (o.get("ad_id") or "").strip()
        if ad_id:
            has_linkage = True
            profit_by_ad[ad_id] = profit_by_ad.get(ad_id, 0.0) + p

    if errors:
        print("INGEST FAILED:")
        for x in errors:
            print("  -", x)
        sys.exit(1)

    adsets_out = []
    for r in spend:
        profit = profit_by_adset.get(r["adset_id"], 0.0)
        poas = profit / r["spend_egp"] if r["spend_egp"] else 0.0
        e = econ_by_adset.get(r["adset_id"], {"revenue": 0.0, "cogs": 0.0, "ship": 0.0, "failed": 0.0})
        adsets_out.append({
            "id": r["adset_id"],
            "name": r["adset_name"],
            "channel": r["channel"],
            "spend_egp": r["spend_egp"],
            "platform_roas": r["platform_roas"],
            "true_poas": round(poas, 3),
            "gap": round(r["platform_roas"] - poas, 3),
            "profit_egp": round(profit, 2),
            "orders": sum(1 for o in orders
                          if o["adset_id"] == r["adset_id"]
                          and o["courier_status"].strip().lower() != "cancelled"),
            "delivered_share": None,
            "economics": {
                "revenue_egp": round(e["revenue"], 2),
                "cogs_egp": round(e["cogs"], 2),
                "ship_egp": round(e["ship"], 2),
                "failed_egp": round(e["failed"], 2),
            },
        })

    # ---- optional files ----
    def load_optional(name):
        path = os.path.join(a.indir, name)
        if not os.path.exists(path):
            return [], [f"{name} missing — its frame(s) will show the unlock state"]
        rows, e = read_csv(path, OPTIONAL[name])
        return rows, e

    ads_rows, w = load_optional("ads.csv"); warnings += w
    ads_out = []
    for r in ads_rows:
        spend_v = fnum(r["spend_egp"])
        profit = profit_by_ad.get(r["ad_id"])
        poas = (profit / spend_v) if (profit is not None and spend_v) else None
        ad = {
            "ad_id": r["ad_id"],
            "ad_name": r["ad_name"],
            "adset_id": r["adset_id"],
            "spend_egp": spend_v,
            "platform_roas": fnum(r["platform_roas"]),
            "frequency": fnum(r["frequency"]),
            "ctr_14d_ago": fnum(r["ctr_14d_ago"]),
            "ctr_now": fnum(r["ctr_now"]),
            "profit_egp": round(profit, 2) if profit is not None else None,
            "poas": round(poas, 3) if poas is not None else None,
            "orders": None,
        }
        if r.get("impressions"):
            ad["impressions"] = int(fnum(r["impressions"]))
        if r.get("clicks"):
            ad["clicks"] = int(fnum(r["clicks"]))
        ads_out.append(ad)
    if ads_rows and not has_linkage:
        warnings.append("orders.csv has no ad_id column — per-ad profit unavailable; "
                        "Frame 4 will show its locked state")

    daily_rows, w = load_optional("daily_adset.csv"); warnings += w
    daily_out = [{
        "date": r["date"], "adset_id": r["adset_id"],
        "spend_egp": fnum(r["spend_egp"]), "platform_roas": fnum(r["platform_roas"]),
        "cpc_egp": fnum(r["cpc_egp"]), "ctr_pct": fnum(r["ctr_pct"]),
        "aov_egp": fnum(r["aov_egp"]),
        "failed_delivery_rate_pct": fnum(r["failed_delivery_rate_pct"]),
    } for r in daily_rows]

    funnel_rows, w = load_optional("funnel.csv"); warnings += w
    funnel_out = []
    for r in funnel_rows:
        if r["step"].strip().lower() not in FUNNEL_STEPS:
            errors.append(f"funnel.csv: unknown step '{r['step']}'")
            continue
        funnel_out.append({"date": r["date"], "channel": r["channel"],
                           "step": r["step"].strip().lower(),
                           "count": int(fnum(r["count"]))})
    if errors:
        print("INGEST FAILED:")
        for x in errors:
            print("  -", x)
        sys.exit(1)

    total_spend = sum(x["spend_egp"] for x in adsets_out)
    total_profit = sum(x["profit_egp"] for x in adsets_out)
    aov = (sum(delivered_values) / len(delivered_values)) if delivered_values else 0.0

    meta = {
        "brand": {"name": a.brand, "note": "Merchant CSV export",
                  "monthly_ad_spend_egp": total_spend, "aov_egp": round(aov, 2)},
        "assumptions": ASSUMPTIONS,
        "generated_with": "ingest_csvs.py (merchant CSV)",
        "has_ads": bool(ads_out), "has_daily": bool(daily_out),
        "has_funnel": bool(funnel_out), "has_ad_linkage": has_linkage,
    }

    os.makedirs(a.outdir, exist_ok=True)
    for name, payload in [("adsets.json", adsets_out), ("ads.json", ads_out),
                          ("daily_adset.json", daily_out), ("funnel.json", funnel_out),
                          ("meta.json", meta)]:
        with open(os.path.join(a.outdir, name), "w") as f:
            json.dump(payload, f, indent=2)

    for x in warnings:
        print("warning:", x)
    br = sum(x["platform_roas"] * x["spend_egp"] for x in adsets_out) / total_spend if total_spend else 0
    bp = total_profit / total_spend if total_spend else 0
    print(f"OK: {len(adsets_out)} ad sets, {len(orders)} orders, spend={total_spend:.0f} "
          f"blended_roas={br:.2f} blended_poas={bp:.2f}")
    print(f"frames: ads={'yes' if ads_out else 'no'} daily={'yes' if daily_out else 'no'} "
          f"funnel={'yes' if funnel_out else 'no'} ad_linkage={'yes' if has_linkage else 'no'}")


if __name__ == "__main__":
    main()
