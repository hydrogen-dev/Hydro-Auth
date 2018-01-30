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

const baseUrl = 'http://api.hedgeable.ml:31343'; //baseurl for Hydro API
const ethAddress = 'wss://rinkeby.infura.io/ws'; //use websocket address to be able to listen to events
const username = 'dkvmdl4bl1hdr2cka4pniojuc2'; //username for Hydro API
const key = 'l049h703idvj1huir3hsm4ga14'; //key for Hydro API
const contractAddress = '0xEFb8Ba35C4C502EA9035e093F59925C4B5B61482'; //contract address

const web3 = new Web3(ethAddress); // using web3.js version 1.0.0-beta.28, node v8.9.1, npm 5.5.1
const HydroContract = new web3.eth.Contract(abi, contractAddress);

let hydro_address_id = 3; //from whitelisting
let amount = 1234;
let challenge_string = 1234;
let partner_id = 1;
let accountAddress = '0xF082A16f34984Cb897baC3634E6962cA35825AB8'; //account address
let privateKey = '0x3479ace7f172c1ad48f31e4724ef7774b464a09b64a9b947b5df4b9413223218'; //private key associated with account address

app.use(cors());
app.use(morgan('dev'));
app.use(express.static(nodeModulesPath));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

(async () => {

    try {

        if(!accountAddress) {
            //create ethereum account via web3
            accountAddress = await createAddress();
        } 
        if(!hydro_address_id) {
            //whitelist via Hydro API
            hydro_address_id = await whitelistAddress();
        }
        if(!amount && !challenge_string && !partner_id) {
            //ask for "challenge details" via Hydro API
            const data = await requestChallengeDetails();
            amount = data.amount;
            challenge_string = data.challenge_string;
            partner_id = data.partner_id;
        }
        //perform "raindrop" by calling methods in the contract
        await performRaindrop();
        //listen to `Authenticate` event in the contract
        await listenToAuthenticateEvent();

    } catch (error) {

        console.error('main catch block', error)

    }

})()

//create ethereum account
async function createAddress() {

    try {

        const response = await web3.eth.accounts.create();
        return response;

    } catch (error) {

        // console.error('createAddress catch', error)
        return Promise.reject(error);

    }

}

//User requests to whitelist an Ethereum address (one-time)
//returns hydro_address_id
async function whitelistAddress() {

    try {

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
        const response = await request(options);   
        return response;

    } catch (error) {

        // console.error('whitelistAddress catch', error)
        return Promise.reject(error);

    }

}

//Requests challenge details
//Returns amount, challenge_string, and partner_id
async function requestChallengeDetails() {

    try {

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
        const response = await request(options);
        console.log('response from challenge', response);
        return response;

    } catch (error) {

        // console.error('requestChallengeDetails catch', error)
        return Promise.reject(error);

    }

}

//Checks if address is authenticated
//Returns boolean
async function checkIfAuthenticated() {

    try {

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
        const response = await request(options);
        console.log('response from authenticate', response);
        return response;

    } catch (error) {

        // console.error('checkIfAuthenticated catch', error)
        return Promise.reject(error);

    }
    
}

//Listens to `Authenticate` event in the contract
//Returns boolean in the result
async function listenToAuthenticateEvent() {

    try {

        await HydroContract.events.Authenticate(null, async (error, result) => {
            try {
                console.log('Authenticate result', result);
                const isAuthenticated = await checkIfAuthenticated();
                console.log('Are we authenticated via Hydro API?', isAuthenticated)
            }
            catch (error) {
                // console.error('Authenticate error', error);
                Promise.error(error);
            }
        })

    } catch (error) {

        // console.error('listenToAuthenticateEvent catch', error)
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
        const serializedTxHex = serializedTx.toString('hex')
        console.log('serializedTx', serializedTxHex);

        const receipt = await web3.eth.sendSignedTransaction('0x' + serializedTxHex)
            .once('transactionHash', hash => {
                console.log('hash', hash)
            })
            .once('receipt', receipt => {
                // console.log('receipt', receipt)
            })
            .once('confirmation', (confNumber, receipt) => {
                console.log('confNumber', confNumber)
                // console.log('receipt', receipt)
            })

        return receipt;
        
    } catch (error) {

        //Transaction might be still pending/successful even if you get error
        //Check on Etherscan, for example, if the transaction was successful
        //Check out this issue with web3 for further details regarding below error message https://github.com/ethereum/web3.js/issues/1102
        //Example: "Transaction was not mined within 50 blocks, please make sure your transaction was properly send. Be aware that it might still be mined!"

        // console.error('sendSignedTransaction catch', error)
        return Promise.reject(error);

    }

}

//via web3, perform "raindrop" by calling `getMoreTokens` and `authenticate` methods in the contract
async function performRaindrop() {

    try {

        //get account object
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        console.log('account',account);

        //get gas price
        const price = await web3.eth.getGasPrice();
        const priceHex = web3.utils.toHex(price);
        console.log('price',price,'priceHex',priceHex);

        //check balance for your information
        const balance = await web3.eth.getBalance(accountAddress);
        console.log('balance',balance);

        //get gas limit on latest block for your information
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

        //get abi for `getMoreTokens` method in the contract
        const getMoreTokensData = await HydroContract.methods.getMoreTokens().encodeABI();
        console.log('getMoreTokensData',getMoreTokensData);

        //get abi for `authenticate` method in the contract
        const getAuthenticateData = await HydroContract.methods.authenticate(amount, challenge_string, partner_id).encodeABI();
        console.log('getAuthenticateData',getAuthenticateData);

       // used to estimate gas for `getMoreTokens`
        const gasForGetMoreTokens = await HydroContract.methods.getMoreTokens().estimateGas()
        console.log('gasForGetMoreTokens',gasForGetMoreTokens)
        // converts into hex
        const gasHexForGetMoreTokens = web3.utils.toHex(gasForGetMoreTokens);
        console.log('gasHexForGetMoreTokens',gasHexForGetMoreTokens)

        //get receipt for requesting more hydros
        const getMoreTokensReceipt = await sendSignedTransaction(privateKeyBuffer, nonceHex, priceHex, gasHexForGetMoreTokens, contractAddress, accountAddress, getMoreTokensData);
        console.log('getMoreTokensReceipt',getMoreTokensReceipt);

        //update nonce for next transaction
        const newNonce = await web3.eth.getTransactionCount(accountAddress);
        console.log('newNonce',newNonce);
        const newNonceHex = web3.utils.toHex(newNonce);
        console.log('newNonceHex',newNonceHex);

        //get receipt for authenticate
        //use `latestGasLimitHex` variable from `getBlock("latest")` method, because calling `estimateGas` throws errors for `authenticate` method
        const authenticateReceipt = await sendSignedTransaction(privateKeyBuffer, newNonceHex, priceHex, latestGasLimitHex, contractAddress, accountAddress, getAuthenticateData);
        console.log('authenticateReceipt',authenticateReceipt);
    
    } catch (error) {

        // console.error('performRaindrop catch',error)
        return Promise.reject(error);

    }
}

// error handling
app.use(function (err, req, res, next) {
    console.error(err);
});

app.listen(3000, function() {
	console.log('listening on port 3000...');
});

module.exports = app;