const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();



const admin = require('firebase-admin'); // ✅ Import admin
const db = require('./firebase'); 
const app = express();

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(bodyParser.json());                                // handles JSON
app.use(bodyParser.urlencoded({ extended: true }));        // handles form data (IPN)

app.use(cors(
));

const COINPAYMENTS_URL = 'https://www.coinpayments.net/api.php';
const PUBLIC_KEY = process.env.PUBLIC_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const COLLECTION = 'nonces';
const DOC_ID = 'coinpayments';

// Firestore-based nonce generation
async function getLastNonce() {
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const doc = await docRef.get();
  if (!doc.exists) return Date.now();
  return doc.data().lastNonce || Date.now();
}

async function saveNonce(nonce) {
  await db.collection(COLLECTION).doc(DOC_ID).set({ lastNonce: nonce });
}

async function generateNonce() {
  const nonceDocRef = db.collection(COLLECTION).doc(DOC_ID);

  const newNonce = await db.runTransaction(async (t) => {
    const doc = await t.get(nonceDocRef);
    const lastNonce = doc.exists ? doc.data().lastNonce : 0;
    const now = Math.floor(Date.now() / 1000);
    const safeNonce = now <= lastNonce ? lastNonce + 1 : now;
    t.set(nonceDocRef, { lastNonce: safeNonce });
    return safeNonce;
  });

  return newNonce.toString();
}

// HMAC generator
function generateHmac(postData) {
  const hmac = crypto.createHmac('sha512', PRIVATE_KEY);
  hmac.update(postData);
  return hmac.digest('hex');
}

// POST: Create Transaction
app.post('/api/create-transaction', async (req, res) => {
  try {
    const { amount, currency1, currency2, buyer_email, custom } = req.body;

    // 🔐 Validate input
    if (!amount || !currency1 || !currency2 || !buyer_email || !custom) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nonce = await generateNonce();

    // 🔗 Build CoinPayments API request
    const params = new URLSearchParams();
    params.append('version', '1');
    params.append('key', PUBLIC_KEY);
    params.append('cmd', 'create_transaction');
    params.append('amount', amount);
    params.append('currency1', currency1);
    params.append('currency2', currency2);
    params.append('buyer_email', buyer_email);
    params.append('custom', custom);
    params.append('format', 'json');
    params.append('nonce', nonce);
    params.append('ipn_url', 'https://psedeposit-main.onrender.com/api/ipn-handler');

    const postData = params.toString();
    const hmac = generateHmac(postData);

    const response = await axios.post(COINPAYMENTS_URL, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        HMAC: hmac,
      },
    });

    const cpData = response.data;
    console.log('🪙 CoinPayments response:', cpData);

    if (cpData.error !== 'ok') {
      return res.status(400).json({ error: cpData.error });
    }

    const result = cpData.result;

    // ✅ Save transaction to Firestore
    const txnRef = db.collection('transactions').doc();
    await txnRef.set({
      transactionId: txnRef.id,
      userId: custom,
      amount: parseFloat(amount),
      type: 'deposit',
      address: result.address,                 // ✅ Correct blockchain wallet address
      status: 'pending',
      balanceUpdated: false,
      coinpaymentsId: result.txn_id,           // ✅ For IPN match
      timestamp: admin.firestore.Timestamp.now(),
    });

    console.log(`✅ Firestore transaction created: ${txnRef.id}`);

    // ✅ Return the CoinPayments result to client
    res.json(cpData);
  } catch (err) {
    console.error('❌ Transaction Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error || 'Transaction failed' });
  }
});




// ✅ GET: Get Transaction Info
// GET endpoint to fetch transaction information
// GET endpoint to fetch transaction information
app.get('/api/transaction/:txid', async (req, res) => {
  try {
    const { txid } = req.params;

    if (!txid) {
      return res.status(400).json({ error: 'Missing transaction ID' });
    }

    const nonce = await generateNonce(); // ✅ FIXED

    const params = new URLSearchParams();
    params.append('version', '1');
    params.append('key', PUBLIC_KEY);
    params.append('cmd', 'get_tx_info');
    params.append('txid', txid);
    params.append('format', 'json');
    params.append('nonce', nonce);

    const postData = params.toString();
    const hmac = generateHmac(postData);
    

    const cpRes = await axios.post(COINPAYMENTS_URL, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        HMAC: hmac,
      },
    });
    
    console.log('📦 Full CoinPayments Response:', cpRes.data);
    

    res.json(cpRes.data);
  } catch (error) {
    console.error('Error getting transaction info:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch transaction info' });
  }
});

app.post('/api/ipn-handler', async (req, res) => {
  try {
    const body = req.body;
    const txid = body.txn_id;
    const status = parseInt(body.status);
    const custom = body.custom; // userId
    const amount = parseFloat(body.amount1);

    if (status >= 100 && txid && custom && !isNaN(amount)) {
      const txnRef = await db.collection('transactions')
        .where('coinpaymentsId', '==', txid)
        .limit(1)
        .get();

      if (!txnRef.empty) {
        const doc = txnRef.docs[0];
        const acctSnap = await db.collection('accounts')
          .where('userId', '==', custom)
          .limit(1)
          .get();

        const userSnap = await db.collection('users')
          .where('uid', '==', custom)
          .limit(1)
          .get();

        if (!acctSnap.empty && !userSnap.empty) {
          const acctRef = acctSnap.docs[0].ref;
          const referralCode = userSnap.docs[0].get('referralCode');

          await db.runTransaction(async (t) => {
            const txnDoc = await t.get(doc.ref);
            if (txnDoc.exists && txnDoc.data().balanceUpdated) {
              console.log(`⚠️ Txn ${txid} already updated`);
              return;
            }

            // ✅ 1. Approve user's deposit
            t.update(doc.ref, {
              status: 'approved',
              balanceUpdated: true,
            });

            t.update(acctRef, {
              'investment.remainingBalance': admin.firestore.FieldValue.increment(amount),
              'investment.totalDeposit': admin.firestore.FieldValue.increment(amount),
              'investment.currentBalance': admin.firestore.FieldValue.increment(amount),
            });

            console.log(`✅ IPN Approved txn ${txid} for user ${custom}`);

            // ✅ 2. Credit referrer (if any)
            if (referralCode) {
              const refSnap = await db.collection('accounts')
                .where('userId', '==', referralCode)
                .limit(1)
                .get();

              if (!refSnap.empty) {
                const refAccRef = refSnap.docs[0].ref;
                const bonus = parseFloat((amount * 0.05).toFixed(2));

                // a. Update referrer's balances
                t.update(refAccRef, {
                  'investment.currentBalance': admin.firestore.FieldValue.increment(bonus),
                  'investment.remainingBalance': admin.firestore.FieldValue.increment(bonus),
                  'earnings.referralProfit': admin.firestore.FieldValue.increment(bonus),
                  'earnings.totalEarned': admin.firestore.FieldValue.increment(bonus),
                });

                // b. Log referral transaction
                const refTxnRef = db.collection('transactions').doc();
                t.set(refTxnRef, {
                  transactionId: refTxnRef.id,
                  userId: referralCode,
                  amount: bonus,
                  type: 'referralReward',
                  address: `Referral ${custom}`,
                  status: 'received',
                  balanceUpdated: true,
                  timestamp: admin.firestore.Timestamp.now(),
                });

                console.log(`✅ Referrer ${referralCode} credited with $${bonus}`);
              }
            }
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('❌ IPN error:', e);
    res.status(500).send('Error');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});