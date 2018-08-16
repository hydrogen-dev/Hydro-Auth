const express = require('express');
const cors = require('cors');
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
const server = require('../server/index.js');

const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
// const config = require('./_config');

// const redis = require('redis');
// const client = redis.createClient();

const baseUrl = 'https://sandbox.hydrogenplatform.com/hydro/v1';
const ethAddress = 'wss://rinkeby.infura.io/ws'; //use websocket address to be able to listen to events
const oauthBaseUrl = 'https://sandbox.hydrogenplatform.com/authorization/v1'; //baseurl for oauth API
const client_id = '8bcjegi2rg3jdyjxl41r3m6khg'; //demo username for Hydro API (plug in your own)
const client_secret = '8qyeutqj7way17zie2k7khnghe'; //demo key for Hydro API (plug in your own)

const contractAddress = '0x4959c7f62051D6b2ed6EaeD3AAeE1F961B145F20'; //contract address on Sandbox
const web3 = new Web3(ethAddress); // using web3.js version 1.0.0-beta.28, node v8.9.1, npm 5.5.1
const HydroContract = new web3.eth.Contract(abi, contractAddress);

let access_token;
let hydro_address_id = 'c74c1f74-ab39-45c8-86c1-51e39769d0a0'; //demo hydro_address_id from whitelisting
let amount;
let challenge;
let partner_id;
let accountAddress = '0xB1Efb9349c6754b8Df2Ae78E8C65286BC84Db5d8'; //demo account address (plug in your own)
let privateKey = '0x051c55700f8a335719f731a3882f16929d75d55effa594dabbf7e93635a96ae9'; //demo private key associated with account address (plug in your own)

chai.use(chaiHttp);

describe('Test Raindrop on the contract', function() {
  it('should return nonce', async function () {
    const nonce = await web3.eth.getTransactionCount(accountAddress);
    const nonceHex = web3.utils.toHex(nonce);
    expect(nonce).to.be.a('number');
    expect(nonceHex).to.be.a('string');
  });

  it('should return encodeABI data for methods', async function () {
    const getMoreTokensData = await HydroContract.methods.getMoreTokens().encodeABI();
    let amount = 12000000000000000000
    let challenge = 944173759196
    let partner_id = 5
    const getAuthenticateData = await HydroContract.methods.authenticate(amount, challenge, partner_id).encodeABI();

    expect(getMoreTokensData).to.be.a('string');
    expect(getAuthenticateData).to.be.a('string');
  });
});

describe('test authenticate with OAuth API', function() {
  it('should return an access token', function(done) {
    const auth = new Buffer.from(client_id + ':' + client_secret).toString('base64')
    const url = `${oauthBaseUrl}/oauth/token?grant_type=client_credentials`
    console.log('url',url)
    chai.request(url)
      .post('')
      .set('Authorization', `Basic ${auth}`)
      .send()
      .end(async function(err, res){
        console.log('err',err)
        const { access_token } = await res.body
        console.log('access_token',access_token)
        expect(res).to.have.status(200);
        expect(access_token).to.be.a('string');
        done();
      });
  });
})
