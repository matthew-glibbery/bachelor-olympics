# Simulation notes: sizing the overall-bet payout

Referenced from `PRODUCT_SPEC.md` → Overall betting. Keep this file if the
event count, scoring curve, or player count ever changes — rerun the
simulation rather than guessing a new number.

## What we were trying to answer

If someone correctly bets on the overall winner, how many bonus points should
that be worth? Enough to matter, not enough to decide the whole competition
by itself.

## Method

Simulated 5,000 runs of an 8-player, 8-event competition using the placement
scoring curve (100, 72, 51.8, 37.3, 26.9, 19.3, 13.9, 10). Each player has a
latent "skill" drawn from a normal distribution, and each event adds
per-event noise (some events more luck-driven than others) on top of that
skill to decide placement order that event.

## Results

- Average gap between 1st and 2nd place, final totals: **~134 points**
- Average gap between 2nd and 3rd: **~91 points**
- Average gap between 3rd and 4th: **~71 points**
- Std dev of the 1st–2nd gap: **~98 points** (meaning it's often a blowout,
  but sometimes very close)

## Conclusion

A flat **20-point** bonus (the first number considered) would almost never
be large enough to move a placement — it's swamped by the typical 70–130
point gap between adjacent finishers. A **100-point** bonus sits right in
that real gap range: large enough to plausibly flip a close 2nd/3rd, but
still smaller than the typical 1st/2nd gap, so it can't unilaterally hand
someone the win. That's why the spec locks the overall-bet payout at 100
points.

If the event count or scoring curve changes, this simulation should be
rerun — the 100-point number is tuned to *this* configuration, not a
universal constant.
