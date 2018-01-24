const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const Web3 = require('web3');
const rp = require('request-promise');
const nodeModulesPath = path.join(__dirname, '../node_modules');
// const _ = require('lodash');
// const SolidityFunction = require('web3/lib/web3/function');

// console.log('SolidityFunction',SolidityFunction)
// const baseUrl = 'https://qa.hydrogenplatform.com/v1';
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

let hydroAddressId = 3;
let amount;
let challengeString;
let partnerId;
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
    if(!hydroAddressId) {
        return whitelist();
    }

    return challenge()
    .then(res => {
        console.log('res challenge', res)
        return raindrop()
    })
    .then(res => {
        console.log('res raindrop', res)
        return authenticate()
    })
    .then(res => {
        console.log('res authenticate', res)
    })
    .catch(err=>{
        console.log('err',err)
    })
}

function createAddress() {
    let accountAddress = web3.eth.accounts.create();
    return accountAddress;
}

//User requests to whitelist an Ethereum address
//One-time thing the user does up front before attempting to authenticate
function whitelist() {

    let auth = new Buffer(username + ':' + key).toString('base64');
    let options = {
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

	return rp(options)
	.then(response => {
        console.log('response',response)
		hydroAddressId = response;
	})
	.catch(err => {
        console.log('err',err)
    });
	
}


//User requests challenge details
//Returns amount, challengeString, and partnerId
function challenge() {

    let auth = new Buffer(username + ':' + key).toString('base64');
    let options = {
        method: 'POST',
        uri: `${baseUrl}/challenge`,
        rejectUnauthorized: app.get('reject_unauthorized'),
        headers: {
          'Content-Type': 'application/json'
        },
        qs: {
        	hydroAddressId: hydroAddressId
        },
        body: {
            username: username,
            key: key
        },
        json: true
    };

	return rp(options)
	.then(response => {
        console.log('response from challenge',response)
        amount = response.amount;
        challengeString = response.challengeString;
        partnerId = response.partnerId;
        return response;
	})
	.catch(err => {
        console.log('err',err)
    });

}

async function raindrop() {
        
        /*
        let event = HydroContract.methods.authenticate(amount, challengeString, partnerId).send({from:accountAddress});
            event.then(res=>{
                console.log('res event2',res)
                
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
        })
        */
        

        /*
        // additional random methods to test
        HydroContract.getPastEvents('Authenticate', null, function(error, events) { console.log('events', events); })


        let validate = HydroContract.methods.validateAuthentication('0x6873faBF374bc1D1b5b5a6137522abC5EAB792E6','data',1).call();
        console.log('validate',validate)
        validate.then(res=>{
            console.log('res',res)
        })

        HydroContract.methods.authenticate(amount, challengeString, partnerId).estimateGas()
        .then(res=>{
            console.log('res gas',res) //24280
        })
        .catch(error=>{
            console.log('error',error)
        })
        console.log('accountAddress',accountAddress)
        

        web3.eth.personal.unlockAccount(accountAddress);
        let account = web3.eth.accounts.privateKeyToAccount(privateKey);
        // console.log('web3.',web3.eth.getAccounts().then(res=>{console.log('res',res)}))
        web3.eth.accounts.wallet.clear();
        let wallet = web3.eth.accounts.wallet.add(account)
        console.log('wallet',wallet)
        console.log('web3.eth.accounts.wallet',web3.eth.accounts.wallet)

        // */

        // 1) one way to send transaction using `send` method
        // let event = await HydroContract.methods.getMoreTokens().send({from:accountAddress});

        
        
        // 2) another way to send transaction using `sendTransaction` method
        // let getData = HydroContract.methods.getMoreTokens().encodeABI();
        // console.log('getData',getData)
        // let event2 = await web3.eth.sendTransaction({to:contractAddress,from:accountAddress,data:getData});

        // console.log('event2',event2)
        

        
        // 3) another third way to send transaction using `sendSignedTransaction` method
        // let privateKeyBuffer = new Buffer(privateKey, 'hex')

        //default gas price
        let account = web3.eth.accounts.privateKeyToAccount(privateKey);
        console.log('account',account)
        // let wallet = web3.eth.accounts.wallet;
        // console.log('wallet before',wallet)
        // let newWallet = web3.eth.accounts.wallet.add(account);
        // console.log('newWallet',newWallet);
        // console.log('wallet after',wallet)

        //get gasprice
        let price = await web3.eth.getGasPrice();
        let priceHex = web3.utils.toHex(price);

        let balance = await web3.eth.getBalance(accountAddress);
        console.log('price',price,'priceHex',priceHex);
        console.log('balance',balance);
        // let gas = await web3.eth.estimateGas({data:getData});

        let getBlock = await web3.eth.getBlock("latest")
        // console.log('getBlock',getBlock)
        let latestGasLimit = getBlock.gasLimit;
        console.log('latestGasLimit',latestGasLimit)
        let latestGasLimitHex = web3.utils.toHex(latestGasLimit);
        console.log('latestGasLimitHex',latestGasLimitHex)
        
        let privateKeyBuffer = EUtil.toBuffer(privateKey, 'hex');

        // let getData = HydroContract.methods.getMoreTokens().encodeABI();
        // let gas = await HydroContract.methods.getMoreTokens().estimateGas()
        // let gasHex = web3.utils.toHex(gas);
        // console.log('gas',gas)
        // console.log('gasHex',gasHex)


        // let rawTx = {
        //   data: getData,
        //   gasLimit: latestGasLimitHex,
        //   gasPrice: priceHex
        // }
        // let tx = new Tx(rawTx);
        // tx.sign(privateKeyBuffer);

        // let serializedTx = tx.serialize();

        // console.log('serializedTx', serializedTx.toString('hex'));

        // let receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        // console.log('receipt',receipt);
        
        let nonce = await web3.eth.getTransactionCount(accountAddress);
        console.log('nonce',nonce);
        let nonceHex = web3.utils.toHex(nonce);
        console.log('nonceHex',nonceHex);

        // let getMoreTokensData = await HydroContract.methods.getMoreTokens().encodeABI();
        // console.log('getMoreTokensData',getMoreTokensData);


        // let getDataHex = web3.utils.toHex(getData);
        // console.log('getDataHex',getDataHex) //same as original

        //estimategas
        // let gas = await HydroContract.methods.authenticate(amount, challengeString, partnerId).estimateGas({from:accountAddress});
        // console.log('gas',gas)
        // let gasHex = web3.utils.toHex(gas);
        // console.log('gasHex',gasHex)

        // let gas2 = await web3.eth.estimateGas({from:accountAddress,to:contractAddress,data:getData});
        // console.log('gas2',gas2)

        // let value = web3.utils.toHex(web3.utils.toWei(amount,'ether'));


        // let rawTx1 = {
        //   nonce: nonceHex,
        //   gasPrice: priceHex,
        //   gasLimit: latestGasLimitHex,
        //   to: contractAddress,
        //   from: accountAddress,
        //   // value: priceHex,
        //   data: getMoreTokensData
        // }
        // let tx1 = new Tx(rawTx1);
        // tx1.sign(privateKeyBuffer);

        // let serializedTx1 = tx1.serialize();

        // console.log('serializedTx1', serializedTx1.toString('hex'));

        // let receipt1 = await web3.eth.sendSignedTransaction('0x' + serializedTx1.toString('hex'))
        // console.log('receipt1',receipt1);


        // return receipt1;


        let getData = await HydroContract.methods.authenticate(amount, challengeString, partnerId).encodeABI();
        console.log('getData',getData)
        let rawTx = {
          nonce: nonceHex,
          gasPrice: priceHex,
          gasLimit: latestGasLimitHex,
          to: contractAddress,
          from: accountAddress,
          // value: priceHex,
          data: getData
        }
        let tx = new Tx(rawTx);
        tx.sign(privateKeyBuffer);

        let serializedTx = tx.serialize();

        console.log('serializedTx', serializedTx.toString('hex'));

        let receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        console.log('receipt',receipt);
        // return receipt;
        

}

function authenticate() {

    let auth = new Buffer(username + ':' + key).toString('base64');
    let options = {
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

	return rp(options)
	.then(response => {
        //returns hydroAddressId
		console.log('response authenticate',response)
	})
	.catch(err => {
        console.log('err',err)
    });
	
}

// error handling
app.use(function (err, req, res, next) {
    console.error(err);
});

app.listen(3000, function() {
	console.log('listening on port 3000...');
});

module.exports = app;