# PSEDeposit (Cryptocurrency Deposit & Referral Microservice)

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.1.0-blue.svg)](https://expressjs.com)
[![Firebase](https://img.shields.io/badge/Firebase-Admin%2013-orange.svg)](https://firebase.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

PSEDeposit is a resilient Node.js / Express microservice that acts as an automated cryptocurrency deposit gateway and multi-tier referral reward processing engine for stock and trading platforms.

---

## Architecture & Transaction Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Mobile Client App
    participant API as PSEDeposit Microservice
    participant CP as CoinPayments Gateway
    participant FS as Google Cloud Firestore

    Client->>API: POST /api/create-transaction (amount, currency, userId)
    API->>FS: Fetch & Increment Monotonic Nonce
    API->>CP: create_transaction (HMAC-SHA512 authenticated)
    CP-->>API: Return Deposit Address & QR Info
    API->>FS: Save Pending Transaction Document
    API-->>Client: Return Transaction Details & Address

    Note over Client,CP: User sends cryptocurrency to address

    CP->>API: POST /api/ipn-handler (Instant Payment Notification)
    API->>FS: Atomic Transaction:
    Note over API,FS: 1. Verify status >= 100<br/>2. Update transaction status = approved<br/>3. Increment user balance & totalDeposit<br/>4. Calculate & credit 5% referral reward
    API-->>CP: 200 OK (IPN Processed)
```

---

## Key Features

- **Automated Deposit Generation**: Seamlessly bridges CoinPayments API with cryptocurrency deposit creation across 100+ digital currencies.
- **Monotonic Nonce Management**: Persistently coordinates transactional sequence numbers using Firestore atomic increments to eliminate race conditions.
- **Atomic Balance Updates**: Uses Firestore database transactions to ensure idempotency and prevent double-crediting on asynchronous webhooks.
- **Referral Reward Distribution Engine**: Automatically calculates and distributes multi-tier affiliate referral rewards (5% commission) directly to the sponsor's wallet.
- **12-Factor Cloud Configuration**: Decoupled from hardcoded credentials; fully configurable via environment variables or Cloud Secret Manager.

---

## API Endpoints

### 1. Health Check
- **`GET /health`**
- **Response:** `200 OK`
  ```json
  { "status": "ok" }
  ```

### 2. Create Deposit Transaction
- **`POST /api/create-transaction`**
- **Body:**
  ```json
  {
    "amount": 50.00,
    "currency1": "USD",
    "currency2": "USDT.TRC20",
    "buyer_email": "investor@example.com",
    "custom": "USER_FIREBASE_UID"
  }
  ```
- **Response:** `200 OK` (CoinPayments transaction metadata, deposit address, timeout, and QR URL).

### 3. Query Transaction Status
- **`GET /api/transaction/:txid`**
- **Response:** Real-time on-chain confirmation status and balance progress from CoinPayments.

### 4. CoinPayments IPN Webhook
- **`POST /api/ipn-handler`**
- **Description:** Receives webhook notifications from CoinPayments, validates confirmation status, updates user accounts, and triggers referral rewards atomically.

---

## Setup & Local Development

### Prerequisites
- Node.js 20+ runtime
- Google Cloud Firebase Project with Firestore enabled
- CoinPayments Merchant Account

### Step-by-Step Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/shayann07/PSEDeposit-main.git
   cd PSEDeposit-main
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example `.env` file:
   ```bash
   cp .env.example .env
   ```
   Fill in your CoinPayments API credentials and Firebase Service Account JSON.

4. **Start the Server:**
   ```bash
   npm start
   ```

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

Copyright (c) 2026 **shayann07**
