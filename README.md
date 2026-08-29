# PSEDeposit (Cryptocurrency Deposit & Referral Microservice)

[![Platform](https://img.shields.io/badge/Platform-Firebase-FFCA28?logo=firebase&logoColor=black)]()
[![Language](https://img.shields.io/badge/Language-Node.js-339933?logo=nodedotjs&logoColor=white)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Backend deposit service that lets the PSE user app accept USDT-BEP20 top-ups through CoinPayments â€” handles the IPN callback and credits the user's wallet.

---

## 📖 Overview

Backend deposit service that lets the PSE user app accept USDT-BEP20 top-ups through CoinPayments â€” handles the IPN callback and credits the user's wallet.

---

## ✨ Key Features

- **Automated Deposit Generation**: Seamlessly bridges CoinPayments API with cryptocurrency deposit creation across 100+ digital currencies.
- **Monotonic Nonce Management**: Persistently coordinates transactional sequence numbers using Firestore atomic increments to eliminate race conditions.
- **Atomic Balance Updates**: Uses Firestore database transactions to ensure idempotency and prevent double-crediting on asynchronous webhooks.
- **Referral Reward Distribution Engine**: Automatically calculates and distributes multi-tier affiliate referral rewards (5% commission) directly to the sponsor's wallet.
- **12-Factor Cloud Configuration**: Decoupled from hardcoded credentials; fully configurable via environment variables or Cloud Secret Manager.

---

---

## 🛠️ Technology Stack

| Component / Layer | Technology |
|---|---|
| **Platform** | Firebase / GCP |
| **Primary Language** | Node.js |
| **Architecture** | MVVM / Clean Architecture |
| **License** | Open Source (MIT) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18 / 20+
- Firebase CLI (`npm install -g firebase-tools`)

### Setup & Run
1. Clone the repository:
   ```bash
   git clone https://github.com/shayann07/PSEDeposit-main.git
   cd PSEDeposit-main
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Deploy functions:
   ```bash
   firebase deploy --only functions
   ```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — Copyright (c) 2026 [shayann07](https://github.com/shayann07).
