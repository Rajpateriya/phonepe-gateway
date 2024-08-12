const express = require("express");
const cors = require("cors");
const bodyparser = require("body-parser");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");

const app = express();

// UAT environment
const MERCHANT_ID = "PGTESTPAYUAT";
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const SALT_INDEX = 1;
const SALT_KEY = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
const APP_URL = "http://localhost:3000";

// Middleware setup
app.use(express.json());
app.use(cors());
// app.use(bodyparse)

const PORT = 3000;

const retryRequest = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error.response && error.response.status === 429) {
      console.log(`Rate limit exceeded. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay * 2); // Exponential backoff
    } else {
      throw error;
    }
  }
};

app.get("/", (req, res) => {
  res.send("Phonepe API integration............");
});

// Endpoint to initiate a payment
app.get("/pay", async (req, res) => {
  const amount = +req.query.amount;

  if (!amount || isNaN(amount)) {
    return res.status(400).send("Invalid amount");
  }

  let userId = "MUID123";
  let merchantTransactionId = uniqid();

  let payload = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: userId,
    amount: amount * 100, // converting to paise
    redirectUrl: `${APP_URL}/payment/validate/${merchantTransactionId}`,
    redirectMode: "REDIRECT",
    mobileNumber: "9999999999",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  let bufferObj = Buffer.from(JSON.stringify(payload), "utf-8");
  let base64encodedPayload = bufferObj.toString("base64");

  let string = base64encodedPayload + "/pg/v1/pay" + SALT_KEY;
  let sha256_val = sha256(string);
  let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

  try {
    let response = await retryRequest(() => axios.post(
      `${PHONE_PE_HOST_URL}/pg/v1/pay`,
      {
        request: base64encodedPayload,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        },
      }
    ));
    console.log("response->", JSON.stringify(response.data));
    res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
  } catch (error) {
    console.error("Payment initiation error:", error);
    res.status(500).send("Payment initiation failed");
  }
});

// Endpoint to check the status of payment
app.get("/payment/validate/:merchantTransactionId", async (req, res) => {
  const { merchantTransactionId } = req.params;

  if (!merchantTransactionId) {
    return res.status(400).send("Invalid transaction ID");
  }

  let statusUrl = `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;

  let string = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + SALT_KEY;
  let sha256_val = sha256(string);
  let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

  try {
    let response = await retryRequest(() => axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyChecksum,
        "X-MERCHANT-ID": MERCHANT_ID,
        accept: "application/json",
      },
    }));
    console.log("response->", response.data);
    if (response.data && response.data.code === "PAYMENT_SUCCESS") {
      res.send("Payment successful");
    } else {
      res.send("Payment status: " + response.data.code);
    }
  } catch (error) {
    console.error("Payment status error:", error);
    res.status(500).send("Failed to retrieve payment status");
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
