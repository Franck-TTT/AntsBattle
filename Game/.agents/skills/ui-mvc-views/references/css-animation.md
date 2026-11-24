# Your own CSS animation

Own motion is plain CSS: `@keyframes` (`from`/`to`/`%`, per-keyframe `animation-timing-function`) and `animation` /
`animation-*` (iteration-count incl. `infinite`, direction, fill-mode, play-state, `animation-composition: add` to layer on the
element's own transform). Animatable: `transform`, `opacity`, `background-color`, `color`, `border-color`, `tint`,
`text-stroke`, `text-shadow`, `border-radius`. Easings: CSS names, the engine set (`out-back`, `in-out-sine`, …),
`cubic-bezier()`, `steps()`, or a formula of the progress `t` with `expr()` (evaluated natively; it may leave 0..1):
a Unity shake `sin(t·(1+8t)·4π)·max·(1−t)` is two keyframes (`rotate(0)` → `rotate(<max>)`) with
`animation-timing-function: expr(sin(t * (1 + 8 * t) * 4 * pi) * (1 - t))` (or `easing: 'expr(…)'` in `ui.animate`) —
no baked samples. Names: `t`, `pi`, `e`; functions `sin cos tan abs sqrt exp floor fract sign min max pow step clamp mix smoothstep`.
`var(--x, fallback)` and `calc()` work in any value; `calc()` mixes units, takes parentheses and scales `env()`:
`padding-top: calc(env(safe-area-inset-top) * 0.5 + 20px)` (`%` only combines with `%`).
