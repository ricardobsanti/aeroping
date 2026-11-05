# Source attribution

`google-proto.js` and `google-currency.js` were adapted from `fli-js/src/search/proto.ts` and `fli-js/src/core/currency.ts` in [punitarani/fli](https://github.com/punitarani/fli/tree/881aee5ff4321e81ea2157cb44be94ce6a21dc1b), commit `881aee5ff4321e81ea2157cb44be94ce6a21dc1b`, MIT. The complete upstream notice is preserved in `FLI-LICENSE.txt`. TypeScript annotations were removed with Node's built-in type stripper; the wire codec has no external runtime dependency.

The application's own `google-provider.js` uses ordinary HTTPS requests to the public search page, with JSON parsing of its inlined data. It does not invoke gated shopping RPCs, use third-party credentials, consent cookies, paid proxies, or CAPTCHA workarounds. Source layout changes or access restrictions produce an unavailable-source error. This is not an official Google API or an availability guarantee.

Web Push uses the MIT library `web-push`, pinned to `npm:web-push@3.6.7` in the Edge Function. Encryption and VAPID request generation run server-side; delivery uses a bounded native `fetch` to validated browser push-service endpoints. No paid messaging account is required.
