const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const Web3 = require('web3');
const rp = require('request-promise');
const nodeModulesPath = path.join(__dirname, '../node_modules');
const baseUrl = 'http://api.hedgeable.ml:31343/v1';
// const ethAddress = 'https://rinkeby.infura.io/y7OLwOvp7UNmvUcIoNmn';
const ethAddress = 'wss://rinkeby.infura.io/ws'; //use websocket address to be able to listen to events
const username = 'uspd2qunj8h2ra62nb50rk29gu';
const key = '9kbspd941u06o8udn49hphlcvk';
const contractAddress = '0xed19C73C0caB93864986743378032798F1efA994';
const abi = require('./interface.json');
const Tx = require('ethereumjs-tx');
const EUtil = require('ethereumjs-util');

// const web3 = new Web3(new Web3.providers.HttpProvider(ethAddress));
// using web3.js version 1.0.0-beta.28, node v8.9.1, npm 5.5.1
const web3 = new Web3(ethAddress);
const HydroContract = new web3.eth.Contract(abi, contractAddress);

let hydro_address_id = 3; //from whitelisting
let amount;
let challenge_string;
let partner_id;
let accountAddress = '0xF082A16f34984Cb897baC3634E6962cA35825AB8';
let privateKey = '0x3479ace7f172c1ad48f31e4724ef7774b464a09b64a9b947b5df4b9413223218';

app.use(cors());
app.use(morgan('dev'));
app.use(express.static(nodeModulesPath));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

main();

function main() {

    if(!accountAddress) {
        return createAddress();
    } 
    if(!hydro_address_id) {
        return whitelist();
    }

    return challenge()
    .then(res => {
        return raindrop()
    })
    .then(res => {
        return authenticate()
    })
    .then(res => {
        console.log('res authenticate', res)
        listenToAuthenticateEvent();
    })
    .catch(err=>{
        console.log('err',err)
    })
}

async function createAddress() {
    let accountAddress = await web3.eth.accounts.create();
    return accountAddress;
}

//User requests to whitelist an Ethereum address
//One-time thing the user does up front before attempting to authenticate
async function whitelist() {

    const auth = new Buffer(username + ':' + key).toString('base64');
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
        const response = await rp(options);   
        console.log('response from whitelist',response)
		hydro_address_id = response;
        return Promise.resolve(response);
    }
    catch (error) {
        Promise.reject(error);
    }
	
}


//User requests challenge details
//Returns amount, challenge_string, and partner_id

async function challenge() {

    const auth = new Buffer(username + ':' + key).toString('base64');
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
        const response = await rp(options);
        console.log('response from challenge',response)
        amount = response.amount;
        challenge_string = response.challenge_string;
        partner_id = response.partner_id;
        return Promise.resolve(response);
    }
    catch (error) {
        Promise.reject(error);
    }

}

async function raindrop() {
    try {

        //default gas price
        let account = web3.eth.accounts.privateKeyToAccount(privateKey);
        console.log('account',account)

        //get gasprice
        let price = await web3.eth.getGasPrice();
        // let price = 10000000000;
        let priceHex = web3.utils.toHex(price);

        let balance = await web3.eth.getBalance(accountAddress);
        console.log('price',price,'priceHex',priceHex);
        console.log('balance',balance);

        let getBlock = await web3.eth.getBlock("latest")
        // console.log('getBlock',getBlock)
        let latestGasLimit = getBlock.gasLimit;
        // let latestGasLimit = 40000;
        console.log('latestGasLimit',latestGasLimit)

        let latestGasLimitHex = web3.utils.toHex(latestGasLimit);
        console.log('latestGasLimitHex',latestGasLimitHex)
        
        // let privateKeyBuffer = new Buffer(privateKey, 'hex') //from documentation - doesn't work
        let privateKeyBuffer = EUtil.toBuffer(privateKey, 'hex');

        let nonce = await web3.eth.getTransactionCount(accountAddress);
        console.log('nonce',nonce);

        let nonceHex = web3.utils.toHex(nonce);
        console.log('nonceHex',nonceHex);

        //get more tokens
        async function getMoreTokens() {
            let getMoreTokensData = await HydroContract.methods.getMoreTokens().encodeABI();
            console.log('getMoreTokensData',getMoreTokensData);

            // used to estimate gas
            // let gas = await HydroContract.methods.getMoreTokens().estimateGas()

            // converts into hex
            // let gasHex = web3.utils.toHex(gas);
            // console.log('gas',gas)
            // console.log('gasHex',gasHex)

            let rawTx1 = {
              nonce: nonceHex,
              gasPrice: priceHex,
              gasLimit: latestGasLimitHex,
              to: contractAddress,
              from: accountAddress,
              data: getMoreTokensData
            }

            let tx1 = new Tx(rawTx1);
            tx1.sign(privateKeyBuffer);

            let serializedTx1 = tx1.serialize();

            console.log('serializedTx1', serializedTx1.toString('hex'));

            let receipt1 = await web3.eth.sendSignedTransaction('0x' + serializedTx1.toString('hex'))
            console.log('receipt1',receipt1);

            return receipt1;
        }

        //authenticate
        async function authenticateTransaction() {

            let getData = await HydroContract.methods.authenticate(amount, challenge_string, partner_id).encodeABI();
            console.log('getData',getData)

            //one way to estimate gas
            // let gas = await HydroContract.methods.authenticate(amount, challenge_string, partner_id).estimateGas({from:accountAddress});
            // console.log('gas',gas)

            //another way to estimate gas
            // let gas2 = await web3.eth.estimateGas({from:accountAddress,to:contractAddress,data:getData});
            // console.log('gas2',gas2)

            //convert into hex
            // let gasHex = web3.utils.toHex(gas);
            // console.log('gasHex',gasHex)

            let rawTx = {
              nonce: nonceHex,
              gasPrice: priceHex,
              gasLimit: latestGasLimitHex,
              to: contractAddress,
              from: accountAddress,
              data: getData
            }

            let tx = new Tx(rawTx);
            tx.sign(privateKeyBuffer);

            let serializedTx = tx.serialize();

            console.log('serializedTx', serializedTx.toString('hex'));

            let receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
            console.log('receipt',receipt);
            return receipt;
            
        }

        return authenticateTransaction();

    
    } catch (error) {
        console.error(error);
    }

}

async function authenticate() {

    const auth = new Buffer(username + ':' + key).toString('base64');
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
        const response = await rp(options);
        //returns hydro_address_id
        console.log('response from authenticate',response)
        return Promise.resolve(response);
    }
    catch (error) {
        Promise.reject(error);
    }
	
}

function listenToAuthenticateEvent() {
    // 1) one way to listen to Authenticate event
    HydroContract.events.Authenticate(null, (error, result) => {
        console.log('Authenticate error',error)
        console.log('Authenticate result',result)
        if(error) return reject(error);
        return resolve(result);            
    })

    // 2) another way to listen to Authenticate event
    HydroContract.once('Authenticate', {}, (error, result) => {
        console.log('Authenticate error',error)
        console.log('Authenticate result',result)
        if(error) return reject(error);
        return resolve(result);
    })
}

// error handling
app.use(function (err, req, res, next) {
    console.error(err);
});

app.listen(3000, function() {
	console.log('listening on port 3000...');
});

module.exports = app;