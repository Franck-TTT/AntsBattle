# Restricted (sandboxed) previews

Restricted opaque-origin previews using `sandbox="allow-scripts"` automatically use
the engine's compatibility scope when a script iframe is inaccessible. Game globals, tool eval
and Math/Date/console guards stay separate from the player and reset with the runtime. Intrinsic
prototypes and browser objects remain shared, so this mode is for trusted engine bundles that
use engine APIs and do not modify prototypes. It is not a JavaScript security boundary.
The outer host's sandbox stays unchanged. Do not add `allow-same-origin` to untrusted uploads on
an authenticated host. Normal browser pages and Node still use separate realms.
