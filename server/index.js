require('dotenv').config()

const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
const chalk  = require('chalk');
const bodyParser = require('body-parser');
const path = require('path');
const Web3 = require('web3');
const request = require('request-promise');
const nodeModulesPath = path.join(__dirname, '../node_modules');
const Tx = require('ethereumjs-tx');
const EUtil = require('ethereumjs-util');
const abi = require('../interface.json'); //interface for contract

const baseUrl = process.env.HYDRO_URL;
const network = process.env.NETWORK_URL; //use websocket address to be able to listen to events
const oauthBaseUrl = process.env.OAUTH_URL; //baseurl for oauth API
const client_id = process.env.CLIENT_ID; //username for Hydro API
const client_secret = process.env.CLIENT_SECRET; //key for Hydro API
const contractAddress = process.env.CONTRACT_ADDRESS; //contract address on Sandbox

const web3 = new Web3(network); // using web3.js version 1.0.0-beta.28, node v8.9.1, npm 5.5.1
const HydroContract = new web3.eth.Contract(abi, contractAddress);

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
            account = await createAddress();
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
        await performRaindrop(accountAddress, privateKey, amount, challenge, partner_id);

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

//create ethereum account
async function createAddress() {

    try {
        return await web3.eth.accounts.create();
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

//Listens to `sendSignedTransaction` method in the contract
//For now only this method works for sending transactions on Infura network
async function sendSignedTransaction(privateKey, nonce, gasPrice, gasLimit, to, from, data) {

    try {
        const rawTx1 = {
          nonce: nonce,
          gasPrice: gasPrice,
          gasLimit: gasLimit,
          to: to,
          from: from,
          data: data
        };

        const tx1 = new Tx(rawTx1);
        tx1.sign(privateKey);

        const serializedTx = tx1.serialize();
        const serializedTxHex = serializedTx.toString('hex');

        const receipt = await web3.eth.sendSignedTransaction('0x' + serializedTxHex)
            .once('transactionHash', hash => {
                console.log(chalk.green('transaction hash'), hash)
            })
            .once('confirmation', (confNumber, receipt) => {
                console.log(chalk.green('confNumber'), confNumber)
            })
        return receipt;
    }
    catch (error) {
        //Transaction might be still pending or successful even if you get an error
        //Check on Etherscan, for example, if the transaction was successful
        //https://rinkeby.etherscan.io/address/{accountAddress}
        //https://rinkeby.etherscan.io/tx/{transactionHash}
        //Check out this issue with web3 for further details regarding below error message https://github.com/ethereum/web3.js/issues/1102
        //Example: "Transaction was not mined within 50 blocks, please make sure your transaction was properly send. Be aware that it might still be mined!"
        return Promise.reject(error);
    }

}

//via web3, perform "raindrop" by calling `getMoreTokens` and `authenticate` methods in the contract
async function performRaindrop(accountAddress, privateKey, amount, challenge, partner_id) {

    try {
        //get gas price
        const price = await web3.eth.getGasPrice();
        const priceHex = web3.utils.toHex(price);
        console.log(chalk.green('price'),price);

        //check balance for your information
        const balance = await web3.eth.getBalance(accountAddress);
        console.log(chalk.green('balance'),balance);

        //get gas limit on latest block
        const getBlock = await web3.eth.getBlock("latest");
        const latestGasLimit = getBlock.gasLimit;
        const latestGasLimitHex = web3.utils.toHex(latestGasLimit);
        console.log(chalk.green('latestGasLimit'),latestGasLimit);

        //convert private key into buffer
        const privateKeyBuffer = EUtil.toBuffer(privateKey, 'hex');

        //get nonce via transaction count
        const nonce = await web3.eth.getTransactionCount(accountAddress);
        const nonceHex = web3.utils.toHex(nonce);
        console.log(chalk.green('nonce'),nonce);

        //get abi for `getMoreTokens` method in the contract
        const getMoreTokensData = await HydroContract.methods.getMoreTokens().encodeABI();
        //get abi for `authenticate` method in the contract
        const getAuthenticateData = await HydroContract.methods.authenticate(amount, challenge, partner_id).encodeABI();

        //estimate gas for `getMoreTokens`
        const gasForGetMoreTokens = await HydroContract.methods.getMoreTokens().estimateGas()
        const gasHexForGetMoreTokens = web3.utils.toHex(gasForGetMoreTokens);
        console.log(chalk.green('gasForGetMoreTokens'),gasForGetMoreTokens)

        //get receipt for requesting more hydros
        console.log(chalk.magentaBright('requesting more tokens...'));
        const getMoreTokensReceipt = await sendSignedTransaction(privateKeyBuffer, nonceHex, priceHex, gasHexForGetMoreTokens, contractAddress, accountAddress, getMoreTokensData);
        console.log(chalk.green('getMoreTokensReceipt'),getMoreTokensReceipt);

        //update nonce for next transaction
        const newNonce = await web3.eth.getTransactionCount(accountAddress);
        const newNonceHex = web3.utils.toHex(newNonce);
        console.log(chalk.green('newNonce'),newNonce);

        //estimate gas for `authenticate`
        const gasForAuthenticate = await HydroContract.methods.authenticate(amount, challenge, partner_id).estimateGas({from:accountAddress, gas:latestGasLimit});
        const gasHexForAuthenticate = web3.utils.toHex(gasForAuthenticate);
        console.log(chalk.green('gasForAuthenticate'),gasForAuthenticate);

        //get receipt for authenticate
        console.log(chalk.magentaBright('requesting to authenticate...'));
        const authenticateReceipt = await sendSignedTransaction(privateKeyBuffer, newNonceHex, priceHex, gasHexForAuthenticate, contractAddress, accountAddress, getAuthenticateData);
        console.log(chalk.green('authenticateReceipt'),authenticateReceipt);
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
    // main();
});

module.exports = performRaindrop;
