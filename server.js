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
const APP_URL = "http://localhost:3000"; // our application

//middleware setup
app.use(express.json());
app.use(cors());

const PORT = 3000;

app.get("/", async (req, res) => {
  res.send("Phonepe API integration............");
});

// endpoint to initiate a payment
app.get("/pay", async (req, res, next) => {
  const amount = +req.query.amount;

  let userId = "RAJ123";

  let merchantTransactionId = uniqid();

  let payload = {
    merchantId: MERCHANT_ID, //* PHONEPE_MERCHANT_ID . Unique for each account (private)
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

  axios
    .post(
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
    )
    .then(function (response) {
      console.log("response->", JSON.stringify(response.data));
      res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
    })
    .catch(function (error) {
      res.send(error);
    });
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
