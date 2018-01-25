const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const Web3 = require('web3');
const request = require('request-promise');
const nodeModulesPath = path.join(__dirname, '../node_modules');
const abi = require('./interface.json');
const Tx = require('ethereumjs-tx');
const EUtil = require('ethereumjs-util');

const baseUrl = 'http://api.hedgeable.ml:31343/v1';
const ethAddress = 'wss://rinkeby.infura.io/ws'; //use websocket address to be able to listen to events
const username = 'dkvmdl4bl1hdr2cka4pniojuc2';
const key = 'l049h703idvj1huir3hsm4ga14';
const contractAddress = '0xed19C73C0caB93864986743378032798F1efA994';

// using web3.js version 1.0.0-beta.28, node v8.9.1, npm 5.5.1
const web3 = new Web3(ethAddress);
const HydroContract = new web3.eth.Contract(abi, contractAddress);

let hydro_address_id = 4; //from whitelisting
let amount;
let challenge_string;
let partner_id;
let accountAddress = '0xF082A16f34984Cb897baC3634E6962cA35825AB8';
let privateKey = '0x3479ace7f172c1ad48f31e4724ef7774b464a09b64a9b947b5df4b9413223218';
let isAuthenticated;

app.use(cors());
app.use(morgan('dev'));
app.use(express.static(nodeModulesPath));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

main();

async function main() {

    try {

        if(!accountAddress) {
            await createAddress();
        } 

        if(!hydro_address_id) {
            await whitelistAddress();
        }

        await requestChallengeDetails();
        await performRaindrop();

        isAuthenticated = await listenToAuthenticateEvent();
        console.log('isAuthenticated',isAuthenticated);

    } catch (error) {

        console.error(error);

    }
}

async function createAddress() {
    const accountAddress = await web3.eth.accounts.create();
    return accountAddress;
}

//User requests to whitelist an Ethereum address (one-time)
//returns hydro_address_id
async function whitelistAddress() {

    const options = {
        method: 'POST',
        uri: `${baseUrl}/whitelist/${accountAddress}`,
        rejectUnauthorized: app.get('reject_unauthorized'),
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
            username: username,
            key: key
        },
        json: true
    };

    try {
        const response = await request(options);   
        console.log('response from whitelist',response);
		hydro_address_id = response;
        return Promise.resolve(response);
    }
    catch (error) {
        Promise.reject(error);
    }

}

//Requests challenge details
//Returns amount, challenge_string, and partner_id
async function requestChallengeDetails() {

    const options = {
        method: 'POST',
        uri: `${baseUrl}/challenge`,
        rejectUnauthorized: app.get('reject_unauthorized'),
        headers: {
          'Content-Type': 'application/json'
        },
        qs: {
            hydro_address_id: hydro_address_id
        },
        body: {
            username: username,
            key: key
        },
        json: true
    };

    try {
        const response = await request(options);
        console.log('response from challenge',response);
        amount = response.amount;
        challenge_string = response.challenge_string;
        partner_id = response.partner_id;

        return Promise.resolve(response);
    }
    catch (error) {
        Promise.reject(error);
    }

}

//Checks if address is authenticated
//Returns boolean
async function checkIfAuthenticated() {

    const options = {
        method: 'POST',
        uri: `${baseUrl}/authenticate/${accountAddress}`,
        rejectUnauthorized: app.get('reject_unauthorized'),
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
            username: username,
            key: key
        },
        json: true
    };

    try {
        const response = await request(options);
        //returns hydro_address_id
        console.log('response from authenticate',response);
        return Promise.resolve(response);
    }
    catch (error) {
        Promise.reject(error);
    }
    
}

//Listens to `Authenticate` event in the contract
async function listenToAuthenticateEvent() {

    await HydroContract.events.Authenticate(null, async (error, result) => {
        console.error('Authenticate error',error);
        console.log('Authenticate result',result);
        await checkIfAuthenticated();
    })

}

//Listens to `sendSignedTransaction` method in the contract
async function sendSignedTransaction(privateKey, nonce, gasPrice, gasLimit, to, from, data) {

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

    console.log('serializedTx', serializedTx.toString('hex'));

    const receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    console.log('receipt',receipt);

    return receipt;
}

async function performRaindrop() {

    //get account object
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    console.log('account',account);

    //get gas price
    const price = await web3.eth.getGasPrice();
    const priceHex = web3.utils.toHex(price);
    console.log('price',price,'priceHex',priceHex);

    //check balance
    const balance = await web3.eth.getBalance(accountAddress);
    console.log('balance',balance);

    //get gas limit on latest block
    const getBlock = await web3.eth.getBlock("latest");
    const latestGasLimit = getBlock.gasLimit;
    console.log('latestGasLimit',latestGasLimit);
    const latestGasLimitHex = web3.utils.toHex(latestGasLimit);
    console.log('latestGasLimitHex',latestGasLimitHex);
    
    //convert private key into buffer
    const privateKeyBuffer = EUtil.toBuffer(privateKey, 'hex');
    console.log('privateKeyBuffer',privateKeyBuffer);

    //get nonce via transaction count
    const nonce = await web3.eth.getTransactionCount(accountAddress);
    console.log('nonce',nonce);
    const nonceHex = web3.utils.toHex(nonce);
    console.log('nonceHex',nonceHex);

    //get abi for get more token method in the contract
    const getMoreTokensData = await HydroContract.methods.getMoreTokens().encodeABI();
    console.log('getMoreTokensData',getMoreTokensData);

    //get abi for authenticate method in the contract
    const getAuthenticateData = await HydroContract.methods.authenticate(amount, challenge_string, partner_id).encodeABI();
    console.log('getAuthenticateData',getAuthenticateData);

    //get receipt for requesting more hydros
    let getMoreTokensReceipt = await sendSignedTransaction(privateKeyBuffer, nonceHex, priceHex, latestGasLimitHex, contractAddress, accountAddress, getMoreTokensData);
    console.log('getMoreTokensReceipt',getMoreTokensReceipt);
    //get receipt for authenticate
    let authenticateReceipt = await sendSignedTransaction(privateKeyBuffer, nonceHex, priceHex, latestGasLimitHex, contractAddress, accountAddress, getAuthenticateData);
    console.log('authenticateReceipt',authenticateReceipt);
}


// error handling
app.use(function (err, req, res, next) {
    console.error(err);
});

app.listen(3000, function() {
	console.log('listening on port 3000...');
});

module.exports = app;