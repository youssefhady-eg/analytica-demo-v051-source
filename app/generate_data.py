#!/usr/bin/env python3
"""Synthetic data generator for the Analytica demo prototype.

Deterministic (seed=7). Emits JSON consumed directly by the Next.js app.

Brand: "Cairo Thread" — fictional D2C fashion, ~EGP 80,000/month ad spend.

POAS math mirrors the offline validation kit assumptions:
  A1 Delivered orders count full order value as revenue.
  A2 Refused/RTO orders bring zero revenue but paid shipping; RTO also paid return shipping.
  A3 Cancelled orders never shipped — excluded (not generated here).
  A4 COGS counted only on delivered orders (refused goods assumed restockable).
  A5 Platform ROAS is taken as reported, not re-computed.
  A7 Blended true POAS = total profit / total spend; blended platform ROAS = spend-weighted.

NOTE: `ad_id` on orders (order<->ad attribution) is SYNTHETIC-ONLY until
production has UTM / click-ID stitching. Do not present ad-level profit as
measurable in production without that data contract.
"""

import json
import os
import random
from datetime import date, timedelta

random.seed(7)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

AOV = 850
SHIP = 60          # outbound shipping cost per shipped order (EGP)
RSHIP = 60         # return shipping cost per RTO order (EGP)

# ----------------------------------------------------------------------------
# Ad-set + ad plan. `econ` profiles drive per-ad order economics.
# ----------------------------------------------------------------------------
ECON = {
    # delivered share, refused share, rto share, cogs ratio, aov multiplier
    "good": {"d": 0.80, "refused": 0.12, "rto": 0.08, "cogs": 0.55, "aov_mult": 1.00},
    # "hero": like "good" but lower COGS — engineered so creatives A and B are
    # the spec's HEROes (top-quartile POAS) without perturbing headline numbers.
    "hero": {"d": 0.80, "refused": 0.12, "rto": 0.08, "cogs": 0.517, "aov_mult": 1.00},
    "mid":  {"d": 0.70, "refused": 0.17, "rto": 0.13, "cogs": 0.58, "aov_mult": 1.00},
    "poor": {"d": 0.60, "refused": 0.22, "rto": 0.18, "cogs": 0.60, "aov_mult": 0.98},
    # "flop": small creative whose traffic barely turns into cash — engineered
    # so it sits below the spec's HERO creatives A and B.
    "flop": {"d": 0.50, "refused": 0.25, "rto": 0.25, "cogs": 0.62, "aov_mult": 0.98},
    # Creative D: engineered culprit — fatiguing + zombie.
    "bad":  {"d": 0.58, "refused": 0.22, "rto": 0.20, "cogs": 0.60, "aov_mult": 0.98},
}

ADSETS = [
    {
        "id": "spring-broad", "name": "Spring Collection \u2013 Broad",
        "channel": "Meta", "spend": 22000, "platform_roas": 3.4,
        "ads": [
            {"id": "ad-a", "name": "Creative A \u2014 UGC try-on",   "spend": 5200, "orders": 34, "econ": "hero",
             "platform_roas": 4.2, "frequency": 2.1, "ctr_14d_ago": 2.2, "ctr_now": 2.5, "cpc": 4.6},
            {"id": "ad-b", "name": "Creative B \u2014 studio flat-lay", "spend": 4600, "orders": 30, "econ": "good",
             "platform_roas": 3.9, "frequency": 2.4, "ctr_14d_ago": 2.0, "ctr_now": 2.1, "cpc": 4.9},
            {"id": "ad-c", "name": "Creative C \u2014 influencer cut", "spend": 1100, "orders": 8, "econ": "mid",
             "platform_roas": 3.1, "frequency": 2.8, "ctr_14d_ago": 1.9, "ctr_now": 1.6, "cpc": 5.3},
            {"id": "ad-d", "name": "Creative D \u2014 sale carousel", "spend": 6500, "orders": 36, "econ": "bad",
             "platform_roas": 2.8, "frequency": 4.1, "ctr_14d_ago": 2.4, "ctr_now": 1.2, "cpc": 5.8},
            {"id": "ad-e", "name": "Creative E \u2014 UGC unboxing", "spend": 1200, "orders": 8, "econ": "mid",
             "platform_roas": 3.4, "frequency": 1.9, "ctr_14d_ago": 2.3, "ctr_now": 2.4, "cpc": 4.4},
            {"id": "ad-f", "name": "Creative F \u2014 product demo", "spend": 1100, "orders": 7, "econ": "flop",
             "platform_roas": 2.6, "frequency": 3.1, "ctr_14d_ago": 1.7, "ctr_now": 1.1, "cpc": 5.6},
            {"id": "ad-g", "name": "Creative G \u2014 testimonial",  "spend": 1700, "orders": 5,  "econ": "poor",
             "platform_roas": 2.2, "frequency": 2.2, "ctr_14d_ago": 1.4, "ctr_now": 1.3, "cpc": 6.1},
            {"id": "ad-h", "name": "Creative H \u2014 static offer",  "spend": 600,  "orders": 3,  "econ": "poor",
             "platform_roas": 1.9, "frequency": 3.6, "ctr_14d_ago": 1.2, "ctr_now": 0.7, "cpc": 6.4},
        ],
    },
    {
        "id": "retarget-atc", "name": "Retargeting \u2013 ATC 30d",
        "channel": "Meta", "spend": 18000, "platform_roas": 4.1,
        "ads": [
            {"id": "ad-r1", "name": "Creative R1 \u2014 cart reminder", "spend": 7000, "orders": 62, "econ": "good",
             "platform_roas": 4.6, "frequency": 3.0, "ctr_14d_ago": 2.8, "ctr_now": 2.9, "cpc": 3.8},
            {"id": "ad-r2", "name": "Creative R2 \u2014 offer nudge",  "spend": 6000, "orders": 50, "econ": "good",
             "platform_roas": 4.0, "frequency": 3.4, "ctr_14d_ago": 2.5, "ctr_now": 2.2, "cpc": 4.1},
            {"id": "ad-r3", "name": "Creative R3 \u2014 social proof",  "spend": 5000, "orders": 38, "econ": "mid",
             "platform_roas": 3.5, "frequency": 2.6, "ctr_14d_ago": 2.1, "ctr_now": 2.0, "cpc": 4.5},
        ],
    },
    {
        "id": "lookalike-purch", "name": "Lookalike \u2013 Purchasers",
        "channel": "Meta", "spend": 24000, "platform_roas": 2.9,
        "ads": [
            {"id": "ad-l1", "name": "Creative L1 \u2014 bestsellers",   "spend": 9000, "orders": 52, "econ": "mid",
             "platform_roas": 3.2, "frequency": 2.7, "ctr_14d_ago": 2.0, "ctr_now": 1.9, "cpc": 5.0},
            {"id": "ad-l2", "name": "Creative L2 \u2014 new arrivals",  "spend": 8000, "orders": 42, "econ": "poor",
             "platform_roas": 2.7, "frequency": 3.8, "ctr_14d_ago": 1.8, "ctr_now": 1.0, "cpc": 5.9},
            {"id": "ad-l3", "name": "Creative L3 \u2014 UGC mashup",    "spend": 7000, "orders": 36, "econ": "mid",
             "platform_roas": 2.8, "frequency": 2.3, "ctr_14d_ago": 1.9, "ctr_now": 1.8, "cpc": 5.2},
        ],
    },
    {
        "id": "tiktok-prosp", "name": "TikTok \u2013 Prospecting",
        "channel": "TikTok", "spend": 16000, "platform_roas": 3.8,
        "ads": [
            {"id": "ad-t1", "name": "Creative T1 \u2014 trend hook",    "spend": 6500, "orders": 48, "econ": "mid",
             "platform_roas": 4.1, "frequency": 2.0, "ctr_14d_ago": 2.6, "ctr_now": 2.7, "cpc": 3.4},
            {"id": "ad-t2", "name": "Creative T2 \u2014 duet format",   "spend": 5500, "orders": 36, "econ": "mid",
             "platform_roas": 3.6, "frequency": 2.5, "ctr_14d_ago": 2.2, "ctr_now": 2.0, "cpc": 3.9},
            {"id": "ad-t3", "name": "Creative T3 \u2014 offer clip",    "spend": 4000, "orders": 26, "econ": "poor",
             "platform_roas": 3.4, "frequency": 3.9, "ctr_14d_ago": 2.0, "ctr_now": 1.1, "cpc": 4.6},
        ],
    },
]


def gen_orders(ad, adset_aov):
    """Generate synthetic orders for one ad. Returns list of order dicts."""
    e = ECON[ad["econ"]]
    aov = adset_aov * e["aov_mult"]
    orders = []
    for i in range(ad["orders"]):
        value = max(150.0, random.gauss(aov, aov * 0.25))
        cogs = value * e["cogs"] * random.uniform(0.95, 1.05)
        r = random.random()
        if r < e["d"]:
            status = "delivered"
        elif r < e["d"] + e["refused"]:
            status = "refused"
        else:
            status = "rto"
        orders.append({
            "order_id": f"{ad['id']}-{i:03d}",
            "ad_id": ad["id"],  # SYNTHETIC-ONLY: needs UTM/click-ID stitching in production
            "order_value_egp": round(value, 2),
            "cogs_egp": round(cogs, 2),
            "shipping_cost_egp": SHIP,
            "return_shipping_egp": RSHIP if status == "rto" else 0,
            "payment_method": "mixed",
            "courier_status": status,
        })
    return orders


def order_profit(o):
    if o["courier_status"] == "delivered":
        return o["order_value_egp"] - o["cogs_egp"] - o["shipping_cost_egp"]
    if o["courier_status"] == "refused":
        return -o["shipping_cost_egp"]
    return -o["shipping_cost_egp"] - o["return_shipping_egp"]  # rto


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    adset_aovs = {"spring-broad": 880, "retarget-atc": 820,
                  "lookalike-purch": 860, "tiktok-prosp": 840}

    ads_out, adsets_out = [], []
    for aset in ADSETS:
        # Guard: creative spends must roll up to the ad-set spend, or Frame 1
        # and Frame 4 will show different totals for the same ad set.
        ad_spend_sum = sum(ad["spend"] for ad in aset["ads"])
        assert ad_spend_sum == aset["spend"], (
            f"{aset['id']}: creative spends sum to {ad_spend_sum}, "
            f"ad-set declares {aset['spend']}"
        )
        aov = adset_aovs[aset["id"]]
        aset_profit, aset_orders, aset_delivered = 0.0, 0, 0
        econ = {"revenue": 0.0, "cogs": 0.0, "ship": 0.0, "failed": 0.0}
        for ad in aset["ads"]:
            orders = gen_orders(ad, aov)
            profit = sum(order_profit(o) for o in orders)
            delivered = sum(1 for o in orders if o["courier_status"] == "delivered")
            for o in orders:
                if o["courier_status"] == "delivered":
                    econ["revenue"] += o["order_value_egp"]
                    econ["cogs"] += o["cogs_egp"]
                    econ["ship"] += o["shipping_cost_egp"]
                elif o["courier_status"] == "refused":
                    econ["failed"] += o["shipping_cost_egp"]
                else:  # rto
                    econ["failed"] += o["shipping_cost_egp"] + o["return_shipping_egp"]
            clicks = int(ad["spend"] / ad["cpc"])
            impressions = int(clicks / (ad["ctr_now"] / 100.0))
            # CPR trend sparkline: 14 points, seeded noise around a drift
            drift = -0.02 if ad["econ"] in ("good",) else (0.03 if ad["econ"] == "bad" else 0.01)
            base_cpr = ad["spend"] / max(1, len(orders))
            cpr_trend = [round(base_cpr * (1 + drift * t + random.uniform(-0.05, 0.05)), 1)
                         for t in range(14)]
            ads_out.append({
                "ad_id": ad["id"],
                "ad_name": ad["name"],
                "adset_id": aset["id"],
                "spend_egp": ad["spend"],
                "impressions": impressions,
                "clicks": clicks,
                "platform_roas": ad["platform_roas"],
                "frequency": ad["frequency"],
                "ctr_14d_ago": ad["ctr_14d_ago"],
                "ctr_now": ad["ctr_now"],
                "cpr_trend": cpr_trend,
                "profit_egp": round(profit, 2),
                "poas": round(profit / ad["spend"], 3),
                "orders": len(orders),
            })
            aset_profit += profit
            aset_orders += len(orders)
            aset_delivered += delivered
        poas = aset_profit / aset["spend"]
        adsets_out.append({
            "id": aset["id"],
            "name": aset["name"],
            "channel": aset["channel"],
            "spend_egp": aset["spend"],
            "platform_roas": aset["platform_roas"],
            "true_poas": round(poas, 3),
            "gap": round(aset["platform_roas"] - poas, 3),
            "profit_egp": round(aset_profit, 2),
            "orders": aset_orders,
            "delivered_share": round(aset_delivered / max(1, aset_orders), 3),
            "economics": {
                "revenue_egp": round(econ["revenue"], 2),
                "cogs_egp": round(econ["cogs"], 2),
                "ship_egp": round(econ["ship"], 2),
                "failed_egp": round(econ["failed"], 2),
            },
        })

    # ---- Story A: 14-day daily series for spring-broad (ROAS -22%) ----
    end = date(2026, 10, 8)
    daily = []
    for t in range(14):
        d = end - timedelta(days=13 - t)
        prog = max(0.0, (t - 6) / 7.0)  # 0 for first 7 days, ramps to 1 over last 7
        daily.append({
            "date": d.isoformat(),
            "adset_id": "spring-broad",
            "spend_egp": round(22000 / 30 * random.uniform(0.9, 1.1), 2),
            "platform_roas": round(3.4 - 0.75 * prog + random.uniform(-0.08, 0.08), 3),
            "cpc_egp": round(5.2 + random.uniform(-0.3, 0.3), 2),
            "ctr_pct": round(2.1 + random.uniform(-0.15, 0.15), 2),
            "aov_egp": round(880 - 132 * prog + random.uniform(-20, 20), 2),
            "failed_delivery_rate_pct": round(11 + 10 * prog + random.uniform(-1, 1), 2),
        })

    # ---- Story B: 14-day funnel per channel ----
    funnel = []
    steps = ["session", "add_to_cart", "checkout", "purchase"]
    for t in range(14):
        d = (end - timedelta(days=13 - t)).isoformat()
        prog = max(0.0, (t - 6) / 7.0)
        # Meta: stable
        s = int(5200 * random.uniform(0.92, 1.08))
        atc = int(s * 0.14 * random.uniform(0.95, 1.05))
        co = int(atc * 0.50 * random.uniform(0.95, 1.05))
        purch = int(co * (0.090 - 0.002 * prog) * random.uniform(0.95, 1.05))
        for step, c in zip(steps, [s, atc, co, purch]):
            funnel.append({"date": d, "channel": "meta", "step": step, "count": c})
        # TikTok: checkout->purchase collapses 8.2% -> 4.1%
        # Sessions scaled (5800/day) so the computed monthly leak lands in the
        # spec's ~EGP 250-300k anchor; rates are unchanged.
        s = int(5800 * random.uniform(0.92, 1.08))
        atc = int(s * 0.12 * random.uniform(0.95, 1.05))
        co = int(atc * 0.45 * random.uniform(0.95, 1.05))
        purch = int(co * (0.082 - 0.041 * prog) * random.uniform(0.95, 1.05))
        for step, c in zip(steps, [s, atc, co, purch]):
            funnel.append({"date": d, "channel": "tiktok", "step": step, "count": c})

    diagnoses = {
        # MOCK — demo only: static texts stand in for the production AI Analyst.
        "case_roas_drop": {
            "trigger": "Spring Collection \u2013 Broad: ROAS \u221222% in 14 days.",
            "diagnosis": "Your ads are fine. The leak is post-click \u2014 orders aren't turning into cash.",
            "action": "Pause creative D, shift its EGP 6,500/month budget to creatives A and B.",
        },
        "case_funnel_leak": {
            "trigger": "TikTok checkout \u2192 purchase cut in half in 7 days.",
            "diagnosis": "Traffic is fine. TikTok buyers stall at checkout.",
            "action": "WhatsApp nudge to TikTok checkout abandoners from the last 48h.",
        },
    }

    meta = {
        "brand": {
            "name": "Cairo Thread",
            "note": "Fictional D2C fashion brand \u2014 sample data",
            "monthly_ad_spend_egp": 80000,
            "aov_egp": AOV,
        },
        "assumptions": [
            "A1 Delivered orders count full order value as revenue.",
            "A2 Refused/RTO orders bring zero revenue but paid shipping; RTO also paid return shipping.",
            "A3 Cancelled orders never shipped \u2014 excluded entirely.",
            "A4 COGS counted only on delivered orders (refused goods assumed restockable).",
            "A5 Platform ROAS is taken as reported, not re-computed.",
            "A7 Blended true POAS = total profit / total spend; blended platform ROAS = spend-weighted average.",
        ],
        "generated_with": "seed=7, reproducible",
    }

    for name, payload in [
        ("adsets.json", adsets_out), ("ads.json", ads_out),
        ("daily_adset.json", daily), ("funnel.json", funnel),
        ("diagnoses.json", diagnoses), ("meta.json", meta),
    ]:
        with open(os.path.join(OUT_DIR, name), "w") as f:
            json.dump(payload, f, indent=2)

    # Console sanity report
    total_spend = sum(a["spend_egp"] for a in adsets_out)
    total_profit = sum(a["profit_egp"] for a in adsets_out)
    blended_roas = sum(a["platform_roas"] * a["spend_egp"] for a in adsets_out) / total_spend
    blended_poas = total_profit / total_spend
    print(f"spend={total_spend} profit={total_profit:.0f} "
          f"blended_roas={blended_roas:.2f} blended_poas={blended_poas:.2f} "
          f"overstatement={blended_roas/blended_poas:.2f}x")
    for a in adsets_out:
        flag = "  <-- FRAME-3" if (a["platform_roas"] >= 2.5 and a["true_poas"] < 1.0) else ""
        print(f"  {a['id']}: roas={a['platform_roas']} poas={a['true_poas']}{flag}")
    d_ad = next(x for x in ads_out if x["ad_id"] == "ad-d")
    print(f"  creative D: poas={d_ad['poas']} (target ~0.7)")


if __name__ == "__main__":
    main()
