# PSEDeposit-main

Render-hosted **Express 5 + Firebase Admin + CoinPayments** deposit endpoint that backs the [`Philippine-Stock-Exchange-user`](https://github.com/shayann07/Philippine-Stock-Exchange-user) Android app's USDT-BEP20 deposit flow. The user app POSTs to `https://psedeposit-main.onrender.com/api/create-transaction`, the server signs a CoinPayments `create_transaction` request with HMAC-SHA512 and a Firestore-stored monotonic nonce, returns a fresh deposit address + QR, then waits for CoinPayments to call back into `/api/ipn-handler` to credit the user's `accounts.investment.{currentBalance,remainingBalance}` (plus a 5% referral bonus to the referrer if any). One file (`server.js`, ~280 LOC) plus a 9-line `firebase.js` shim.

## 🚨 Security warnings — do not deploy without fixing these

This README replaces the previous one. The previous README told users to "ensure the `serviceAccount` directory contains your service account JSON" with no security warning, and the project tracks `serviceAccount/firebase-key.json` (a real Firebase Admin private key) in git. The audit also surfaced an unverified IPN webhook and an unauthenticated deposit endpoint.

### 1. `serviceAccount/firebase-key.json` is committed to this public repo

`firebase.js:2` does `require('./serviceAccount/firebase-key.json')`. The file in the repo is a **real** Firebase Admin service-account JSON for project `REDACTED_PROJECT_ID` (same project the user/admin Android apps point at via `google-services.json`), including a working RSA `private_key`. With this file anyone can mint admin tokens against the production Firebase project and read or write **any** document or auth user.

**Rotate the key immediately:** Google Cloud → IAM → Service Accounts → revoke `firebase-adminsdk-fbsvc@REDACTED_PROJECT_ID.iam.gserviceaccount.com`'s old key, generate a new one, and store the JSON via an env var (e.g. `GOOGLE_APPLICATION_CREDENTIALS_JSON`) on Render. Then:

```bash
git rm --cached serviceAccount/firebase-key.json
echo 'serviceAccount/' >> .gitignore
git commit -m "Stop tracking service account JSON"
# Then purge from history:
#   git filter-repo --path serviceAccount/firebase-key.json --invert-paths
# (or BFG Repo-Cleaner)
```

### 2. `.gitignore` advertises the protection but doesn't deliver it

The full `.gitignore` is:

```
.env
# Ignore Firebase private key
```

The comment is just a comment — there is no rule for `serviceAccount/`. Replace with:

```
.env
.env.*
node_modules/
serviceAccount/
.DS_Store
```

### 3. `node_modules/` is committed (~5,400 files / ~57 MB)

After the secret cleanup:

```bash
git rm -r --cached node_modules/
git commit -m "Stop tracking node_modules/"
```

### 4. `POST /api/ipn-handler` does not verify the CoinPayments HMAC header

`server.js:178-187` only checks `status >= 100`. CoinPayments expects the receiver to verify the `HMAC` header against an `IPN_SECRET` HMAC-SHA512 of the raw POST body. Without that verification, **any unauthenticated client on the public internet can POST a forged IPN payload** that matches an existing `coinpaymentsId` and have the server credit the corresponding user's balance plus pay the 5% referral bonus. Fix:

```js
const crypto = require('crypto');
app.use(bodyParser.urlencoded({
  extended: true,
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

app.post('/api/ipn-handler', (req, res) => {
  const signature = req.get('HMAC');
  const expected = crypto
    .createHmac('sha512', process.env.IPN_SECRET)
    .update(req.rawBody)
    .digest('hex');
  if (!signature || signature !== expected) return res.sendStatus(401);
  // ... existing logic ...
});
```

Configure the matching secret in CoinPayments → Account → IPN Settings.

### 5. `POST /api/create-transaction` is unauthenticated

`server.js:65` accepts `{amount, currency1, currency2, buyer_email, custom}` from the body with no auth check. Any client can craft a transaction for any `userId`. Either require a Firebase ID token (`admin.auth().verifyIdToken(...)` and assert `decodedToken.uid === req.body.custom`) or migrate the endpoint into a Firebase Callable Function (which gives you authenticated `context.auth.uid` for free).

## What the server actually does

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Liveness check. |
| `/api/create-transaction` | POST | Body `{amount, currency1, currency2, buyer_email, custom}`. Signs a CoinPayments `create_transaction` call (HMAC-SHA512 + Firestore-backed nonce in `nonces/{key}`), saves the returned txn to `transactions` (`{coinpaymentsId, address, qrCode, amount, currency, buyer_email, userId, status: "pending", balanceUpdated: false, createdAt}`), responds with the deposit address + QR. **Currently unauthenticated.** |
| `/api/transaction/:txid` | GET | Proxies CoinPayments `get_tx_info`. |
| `/api/ipn-handler` | POST | CoinPayments webhook. Looks up the `transactions` doc by `coinpaymentsId`. If `status >= 100` and `balanceUpdated == false`, runs `db.runTransaction(...)` to set `transactions.{status, balanceUpdated: true}`, increment the user's `accounts.investment.{currentBalance, remainingBalance}`, and (if `users.referredBy` is set) increment the referrer's `accounts` by 5% of `amount`. **Currently no HMAC check.** |

`firebase.js` is 9 lines: load the service account, `admin.initializeApp(...)`, export `admin.firestore()`.

## Tech stack

- **Runtime:** Node.js (no `engines` block; pin a version on Render).
- **Framework:** Express 5.1.0.
- **Firebase:** firebase-admin 13.4.0.
- **HTTP / utility:** axios 1.9.0, body-parser 2.2.0, cors 2.8.5, dotenv 16.5.0.
- **CoinPayments:** no SDK — manual `axios.post(API_URL, params)` over `https://www.coinpayments.net/api.php` with HMAC-SHA512 signing.

## Setup / run

```bash
npm install
# .env (gitignored):
#   PUBLIC_KEY=<CoinPayments public key>
#   PRIVATE_KEY=<CoinPayments private key>
#   IPN_SECRET=<CoinPayments IPN secret>     # required after fix above
#   GOOGLE_APPLICATION_CREDENTIALS_JSON=<rotated service account JSON>
node server.js
```

Default port is `process.env.PORT || 3000`. Render sets `PORT` automatically.

## Project layout

```
PSEDeposit-main/
├── .gitignore                       only ignores `.env` (and lies about ignoring the service-account JSON)
├── README.md
├── firebase.js                      requires the service-account JSON; rewrite to read from env after rotation
├── package.json                     express 5, firebase-admin 13, axios, cors, body-parser, dotenv
├── package-lock.json
├── server.js                        4 endpoints; HMAC-signed CoinPayments calls; Firestore nonce + transactions
├── serviceAccount/
│   └── firebase-key.json            🚨 currently tracked; remove and rotate the key
└── node_modules/                    🚨 currently tracked; remove
```

## Status

- Working tree clean on `master`. Three real commits: `9eea5ca` "Backend Done!", `43eeb8c` "base url added!", `97707ff` "Create README.md". No GitPulse marker noise here.
- Remote: `https://github.com/shayann07/PSEDeposit-main.git`.
- The leaked service-account JSON has been in the repo since the very first commit (`9eea5ca`). Pure rotation is required — purging from history alone is insufficient because the old key has been public.

## Honest limitations (besides the security findings above)

- **CORS is wildcard-open.** `cors()` mounted with no `origin` option. Restrict.
- **No rate limiting.** Add `express-rate-limit` on `/api/create-transaction` and `/api/ipn-handler`.
- **No input validation.** `amount` should be `Number.isFinite(x) && x > 0 && x <= MAX_DEPOSIT`; `buyer_email` should match a simple email regex; `custom` (userId) should be confirmed against Firestore before creating a CoinPayments transaction.
- **Hardcoded 5% referral bonus** at `server.js:238`. Move to Firestore `config/depositRules`.
- **No `engines` block in `package.json`.** Pin Node (e.g. `"engines": { "node": "20.x" }`) so Render doesn't silently upgrade.
- **No tests, no CI.** This endpoint is touching money — at minimum, unit-test the HMAC signing, the IPN status decision tree, and the `balanceUpdated` double-credit guard.

## License

The previous README claimed MIT but no `LICENSE` file is present in the repo. Treat as "all rights reserved" until a real `LICENSE` is committed.
