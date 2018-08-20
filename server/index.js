require('dotenv').config()
const baseUrl = process.env.HYDRO_URL;
const oauthBaseUrl = process.env.OAUTH_URL; //baseurl for oauth API
const client_id = process.env.CLIENT_ID; //username for Hydro API
const client_secret = process.env.CLIENT_SECRET; //key for Hydro API
const contractAddress = process.env.CONTRACT_ADDRESS; //contract address on Sandbox
const network = process.env.NETWORK_URL; //use websocket address to be able to listen to events

const path = require('path');
const nodeModulesPath = path.join(__dirname, '../node_modules');

const Web3 = require('web3');
const web3 = new Web3(network); // using web3.js version 1.0.0-beta.28, node v8.9.1, npm 5.5.1
const abi = require('../interface.json'); //interface for contract
const HydroContract = new web3.eth.Contract(abi, contractAddress);

const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
const chalk  = require('chalk');
const bodyParser = require('body-parser');
const request = require('request-promise');

const { createAddress, performRaindrop } = require('../web3-methods.js');

let access_token;
let hydro_address_id = 'c74c1f74-ab39-45c8-86c1-51e39769d0a0'; //demo hydro_address_id from whitelisting
let amount;
let challenge;
let partner_id;
let accountAddress = '0xB1Efb9349c6754b8Df2Ae78E8C65286BC84Db5d8'; //demo account address (plug in your own)
let privateKey = '0x051c55700f8a335719f731a3882f16929d75d55effa594dabbf7e93635a96ae9'; //demo private key associated with account address (plug in your own)

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

        if(!accountAddress) {
            //create ethereum account via web3
            console.log(chalk.magentaBright('creating an ethereum account...'));
            account = await createAddress(web3);
            console.log(chalk.green('account'),account);
            ({ accountAddress, privateKey } = account);
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
        await performRaindrop(web3, HydroContract, contractAddress, accountAddress, privateKey, amount, challenge, partner_id);

        //check if authenticated via Hydro API
        console.log(chalk.magentaBright('checking if we are authenticated...'));
        await checkIfAuthenticated();
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
              address: accountAddress
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
              hydro_address_id: hydro_address_id
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
//Returns boolean
async function authenticatedWithHydro() {

    try {
        const options = {
            uri: `${baseUrl}/authenticate`,
            headers: {
              'Authorization': `Bearer ${access_token}`
            },
            qs: {
                hydro_address_id: hydro_address_id
            },
            json: true
        };
        return await request(options);
    }
    catch (error) {
        return Promise.reject(error);
    }

}

async function checkIfAuthenticated() {

    try {
        const { authentication_id } = await authenticatedWithHydro();
        console.log(chalk.greenBright('authentication_id'), authentication_id)
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
