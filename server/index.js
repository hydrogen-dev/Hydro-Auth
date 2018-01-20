const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const Web3 = require('web3');
const rp = require('request-promise');
const nodeModulesPath = path.join(__dirname, '../node_modules');

const baseUrl = 'https://qa.hydrogenplatform.com/hydro/v1';
const username = 'uspd2qunj8h2ra62nb50rk29gu';
const key = '9kbspd941u06o8udn49hphlcvk';
const address = '0xed19C73C0caB93864986743378032798F1efA994';
const abi = require('./interface.json');

const web3 = new Web3(new Web3.providers.HttpProvider(baseUrl));
const HydroContract = web3.eth.contract(abi)
const HydroFactory = HydroContract.at(address)

let hydroAddressId;
let amount;
let challengeString;
let partnerId;

app.use(cors());
app.use(morgan('dev'));
app.use(express.static(nodeModulesPath));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

main();

function main() {

    return raindrop()  
        .then(res=>{
            console.log('res',res)
        })  
        .catch(err=>{
            console.log('err',err)
        })
    // return whitelist()
    //     .then(res=>{
    //         console.log('res',res)
    //         return challenge()
    //     })
    //     .then(res=> {
    //         console.log('res 1',res)
    //         return raindrop()
    //     })
    //     .then(res=> {
    //         console.log('res 1',res)
    //         return authenticate()
    //     })
    //     .catch(err=>{
    //         console.log('err',err)
    //     })
}

//User requests to whitelist an Ethereum address
//One-time thing the user does up front before attempting to authenticate
function whitelist() {

    let auth = new Buffer(username + ':' + key).toString('base64');
    let options = {
        method: 'POST',
        uri: `${baseUrl}/whitelist/${address}`,
        rejectUnauthorized: app.get('reject_unauthorized'),
        headers: {
          'Authorization': 'Basic ' + auth
        },
        body: JSON.stringify({
            username: username,
            key: key
        }),
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
          'Authorization': 'Basic ' + auth
        },
        body: JSON.stringify({
            amount: amount,
            challengeString: challengeString,
            partnerId: partnerId
        }),
        qs: {
        	hydroAddressId: hydroAddressId
        },
        json: true
    };

	return rp(options)
	.then(response => {
		res.send(response);
	})
	.catch(next);

}

function raindrop() {
    HydroFactory.authenticate(amount, challengeString, partnerId);

    var event = HydroFactory.Authenticate((error, result) => {
        console.log('error',error)
        console.log('result',result)
        return authenticate()
            .then(res => {
                console.log('res',res)
            })
            .catch(err => {
                console.log('err',err)
            })
    });

    console.log('event',event)

    
}

function authenticate() {

    let auth = new Buffer(username + ':' + key).toString('base64');
    let options = {
        method: 'POST',
        uri: `${baseUrl}/authenticate/${address}`,
        rejectUnauthorized: app.get('reject_unauthorized'),
        headers: {
          'Authorization': 'Basic ' + auth
        },
        body: JSON.stringify({
            username: username,
            key: key
        }),
        json: true
    };

	return rp(options)
	.then(response => {
		hydroAddressId = response
	})
	.catch(next);
	
}

// error handling
app.use(function (err, req, res, next) {
    console.error(err);
    // res.status(500).send(err.message);
});

app.listen(3000, function() {
	console.log('listening on port 3000...');
});

module.exports = app;