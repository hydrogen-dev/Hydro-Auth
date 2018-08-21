require('dotenv').config()
const baseUrl = process.env.HYDRO_URL;
const oauthBaseUrl = process.env.OAUTH_URL;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const contractAddress = process.env.CONTRACT_ADDRESS;
const network = process.env.NETWORK_URL;

const path = require('path');
const nodeModulesPath = path.join(__dirname, '../node_modules');
const Web3 = require('web3');
const web3 = new Web3(network);
const abi = require('../interface.json');
const HydroContract = new web3.eth.Contract(abi, contractAddress);
const { createAddress, performRaindrop } = require('../web3-methods.js');

const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
const chalk  = require('chalk');
const bodyParser = require('body-parser');
const request = require('request-promise');

let access_token;
let hydro_address_id = 'ee1df97c-5c38-48c0-b46c-70bc0b69bfb1'; //demo hydro_address_id from whitelisting (plug in your own)
let address = '0xA3C0336928bc8964512847a1193D0b4Cc6Dc19C9'; //demo account address (plug in your own)
let privateKey = '0xc16f09068c0f3323b3f02bf39e8d1e68ea329874b0379f724528478f5dd3860e'; //demo private key associated with account address (plug in your own)

let amount;
let challenge;
let partner_id;

app.use(cors());
app.use(morgan('dev'));
app.use(express.static(nodeModulesPath));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//our main script
async function main() {

    try {

        if(!access_token) {
          //authenticate with Oauth API
          console.log(chalk.magentaBright('authenticating with OAuth...'));
          access_token = await authenticateWithOauth();
          console.log(chalk.green('access_token'), access_token)
        }

        if(!address) {
            //create ethereum account via web3
            console.log(chalk.magentaBright('creating an ethereum account...'));
            account = await createAddress(web3);
            console.log(chalk.green('account'),account);
            ({ address, privateKey } = account);
        }

        if(!hydro_address_id) {
            //one-time whitelist via Hydro API
            console.log(chalk.magentaBright('requesting to whitelist via Hydro API...'));
            const result = await whitelistAddress();
            ({ hydro_address_id } = result);
            console.log(chalk.green('hydro_address_id'),hydro_address_id);
        }

        //ask for "challenge details" via Hydro API
        console.log(chalk.magentaBright('requesting challenge details via Hydro API...'));

        const challengeDetails = await requestChallengeDetails();
        ({ amount, challenge, partner_id } = challengeDetails);
        console.log(chalk.green('amount'), amount);
        console.log(chalk.green('challenge'), challenge);
        console.log(chalk.green('partner_id'), partner_id);

        //perform "raindrop" by calling methods in the contract
        console.log(chalk.magentaBright('starting to perform raindrop...'));
        await performRaindrop(web3, HydroContract, contractAddress, address, privateKey, amount, challenge, partner_id);

        //check if authenticated via Hydro API
        console.log(chalk.magentaBright('checking if we are authenticated...'));
        const { authentication_id } = await authenticatedWithHydro();
        console.log(chalk.greenBright('authentication_id'), authentication_id)
        return;

    }
    catch (error) {
        console.error(chalk.red('error'), error);
    }

}

async function authenticateWithOauth() {

    try {
        const auth = new Buffer.from(client_id + ':' + client_secret).toString('base64')
        const options = {
            method: 'POST',
            uri: `${oauthBaseUrl}/oauth/token?grant_type=client_credentials`,
            headers: {
              'Authorization': `Basic ${auth}`
            },
            json: true
        };
        const credentials = await request(options);
        return credentials.access_token;

    }
    catch (error) {
        return Promise.reject(error);
    }

}

//User requests to whitelist an Ethereum address (one-time)
//returns hydro_address_id
async function whitelistAddress() {

    try {
        const options = {
            method: 'POST',
            uri: `${baseUrl}/whitelist`,
            headers: {
              'Authorization': `Bearer ${access_token}`
            },
            body: {
              address
            },
            json: true
        };
        return await request(options);
    }
    catch (error) {
        return Promise.reject(error);
    }

}

//Requests challenge details
//Returns amount, challenge, and partner_id
async function requestChallengeDetails() {

    try {
        const options = {
            method: 'POST',
            uri: `${baseUrl}/challenge`,
            headers: {
              'Authorization': `Bearer ${access_token}`
            },
            body: {
              hydro_address_id
            },
            json: true
        };
        return await request(options);
    }
    catch (error) {
        return Promise.reject(error);
    }

}

//Checks if address is authenticated
//Returns authentication_id
async function authenticatedWithHydro() {

    try {
        const options = {
            uri: `${baseUrl}/authenticate`,
            headers: {
              'Authorization': `Bearer ${access_token}`
            },
            qs: {
                hydro_address_id
            },
            json: true
        };
        return await request(options);
    }
    catch (error) {
        return Promise.reject(error);
    }

}

// error handling
app.use(function (err, req, res, next) {
    console.error(chalk.red('global error handling'),err);
});

app.listen(3000, function() {
    console.log(chalk.bold('listening on port 3000...'));
    //execute our script!
    main();
});

module.exports = app;
