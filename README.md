# PSEDeposit-main

This repository contains the backend service for processing deposits and withdrawals in the Philippine Stock Exchange (PSE) app. It integrates with the CoinPayments API to generate deposit addresses and submit withdrawal transactions on behalf of users.

## Features

- Generate unique cryptocurrency deposit addresses for user wallets via the CoinPayments API.
- Monitor incoming payments and credit user balances.
- Handle withdrawal requests and submit payouts to the CoinPayments API.
- Manage API keys and secrets securely via environment variables or a service account.
- Provide RESTful endpoints for integration with the PSE mobile apps.

## Getting started

1. **Clone the repository**

   ```bash
   git clone https://github.com/shayann07/PSEDeposit-main.git
   cd PSEDeposit-main
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   - Copy `.env.example` to `.env` if present and fill in your CoinPayments API keys and any other secrets (alternatively update `firebase.js` or `server.js` with your credentials).
   - If using Firebase or other services, ensure the `serviceAccount` directory contains your service account JSON.

4. **Run the server**

   ```bash
   node server.js
   ```
   This will start the backend locally. Use tools like Postman to test the deposit and withdrawal endpoints.

5. **Deploy**

   You can deploy this service to your preferred hosting provider (e.g. Heroku, Firebase Cloud Functions, or another Node.js hosting platform). Make sure to configure environment variables on the host.

## Technologies used

- **Node.js** – JavaScript runtime environment.
- **Express** – web framework for building APIs (if used).
- **CoinPayments API** – for creating deposit addresses and processing withdrawals.
- **Firebase Admin SDK** – for interacting with Firebase (if applicable).

## License

This project is open source under the MIT License.
