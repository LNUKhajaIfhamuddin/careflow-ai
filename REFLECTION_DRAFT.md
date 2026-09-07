# Reflection (300 words) — Draft

*This is a draft based on the actual testing/security work done in this session.
Personalize the bracketed parts and adjust anything that doesn't match your
own experience before submitting.*

---

The most critical bug I found was that CareFlow AI's public registration
endpoint let anyone create an **admin account** just by sending
`"role": "admin"` in the request — no special permission needed. I confirmed
this by registering a test account with that role and immediately receiving
a working admin token. It mattered because admin access exposes every
patient's appointment history and lets someone deactivate any user account.
The fix was to remove "admin" from the public-facing schema entirely (both
the API and the registration dropdown), so admin accounts can only be
created out-of-band by an existing admin.

The most important security issue, beyond that one, was a broken-access-control
bug in the appointments API: a patient could send a direct PATCH request and
set their own appointment's status straight to "completed," and any provider
could cancel appointments that weren't even assigned to them. Neither of
these was visible from clicking around the UI — I only found them by writing
small scripts that called the API directly, bypassing the frontend entirely.
That's the biggest lesson from this assignment: the UI hiding a button is not
the same as the backend enforcing a rule, and real security testing means
attacking the API, not just testing what's rendered on screen.

AI helped by generating the exploit test scripts almost as fast as I could
describe the scenario, and then generating the corresponding fix and a
regression test to prove the fix didn't break anything else — turning what
would have been hours of manual poking into a tight test-fix-verify loop.

Compared to my first app, this process was different because I went in
looking for exploits from the start rather than just checking that features
"worked," which surfaced real vulnerabilities a normal click-through never
would have. [Add: your own time spent, and anything you personally
discovered while running it locally.]
