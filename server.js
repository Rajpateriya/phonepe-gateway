const express = require('express')
const cors  = require('cors')
const bodyparser = require('body-parser')
const axios = require('axios')
const sha256 = require('sha256')
const uniqid = require('uniqid')

const app = express();

app.use(express.json());
app.use(cors());

const PORT = 3000

app.listen(PORT , ()=>{
    console.log(`Server is listening on port ${PORT}` )
})