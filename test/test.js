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

const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

const { createAddress, performRaindrop } = require('../web3-methods.js');

chai.use(chaiHttp);

describe('authenticate with Raindrop API', function() {
  let access_token,
  hydro_address_id,
  address,
  privateKey,
  amount,
  challenge,
  partner_id;

  // access_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6WyJjcmVhdGUiLCJyZWFkIiwidXBkYXRlIiwiZGVsZXRlIl0sImV4cCI6MTUzNDg2Nzk0OSwiYXV0aG9yaXRpZXMiOlsiUk9MRV9TVVBFUl9BRE1JTiJdLCJqdGkiOiI2NzA2OGI0NS0wOWJiLTQ3YzUtYTM5OS0yNGUwMGZmMjM0ZDEiLCJjbGllbnRfaWQiOiI4YmNqZWdpMnJnM2pkeWp4bDQxcjNtNmtoZyIsImFwcHMiOiJoeWRybyJ9.gon2RlcdHJwP63PDS6PclggHLgjyVITtd5kV-4wXHw6dNnzbbnc2n2Sn_0l4eUY2dlg5uzxnrkE5x9Rh60wasdznRiYuN5P7db_O3FBy-QObQQvQh_-fC96qNZ3qEIXEfOIiycmMjTU1eynbFEMg_Y3V4ygfSrMgTeNmmPSUD8QMwwzzYkPg1kvTAE3Fo2hEoXLP3-b3ssnz1uiW86yieTN0Z_LVFS2CDqVu6nZI7lDG6QczbGcL6BzAkae6IXxuiFxjf_qh5lkGptxSk-eaEAQHNoRxgN9FsTxWHhVmbNueiT6_GINkyyKt-KjIIxlQfPf6I2KBZW96FNoNbWPJ2w"
  //
  // hydro_address_id = "19850808-9e9a-455e-9983-5ebdcce23fec"

  beforeEach(function() {
    this.timeout(10000);
  })

  it('should get an access token via OAuth API that is used to call Raindrop API', async function() {
    try {
      const auth = new Buffer.from(client_id + ':' + client_secret).toString('base64')
      const url = `${oauthBaseUrl}/oauth/token?grant_type=client_credentials`
      const res = await chai.request(url)
      .post('')
      .set('Authorization', `Basic ${auth}`)
      .send()

      access_token = res.body.access_token
      console.log('access_token',access_token)
      expect(res.status).to.equal(200);
      expect(access_token).to.be.a('string');
    }
    catch (err) {
      throw err;
    }
  });

  xit('should whitelist address', async function() {
    try {
      const account = await createAddress(web3);
      ({ address, privateKey } = account);

      console.log('address',address)
      console.log('access_token',access_token)
      const url = `${baseUrl}/whitelist`
      const res = await chai.request(url)
      .post('')
      .type('application/json')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ address })

      hydro_address_id = res.body.hydro_address_id
      console.log('hydro_address_id',hydro_address_id)

      expect(res.status).to.equal(200);
      expect(hydro_address_id).to.be.a('string');
    }
    catch (err) {
      throw err;
    }
  });

  xit('should request challenge details that includes amount, challenge, and partner_id', async function() {
    try {
      console.log('here',access_token)
      console.log('here hydro_address_id',hydro_address_id)

      const url = `${baseUrl}/challenge`
      const res = await chai.request(url)
      .post('')
      .type('application/json')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ hydro_address_id })

      console.log('res.request._data',res.request._data)

      amount = res.body.amount
      challenge = res.body.challenge
      partner_id = res.body.partner_id

      console.log('res.body',res.body)

      expect(amount).to.be.a('number');
      expect(challenge).to.be.a('number');
      expect(partner_id).to.be.a('number');
    }
    catch (err) {
      throw err;
    }
  });

  xit('should perform raindrop', async function() {
    try {
      const raindrop = await performRaindrop(web3, HydroContract, contractAddress, address, privateKey, amount, challenge, partner_id)
      console.log('raindrop',raindrop)
      expect(raindrop).to.exist;
    }
    catch (err) {
      throw err;
    }
  });

  xit('should return an authentication_id when authenticated successfully', async function () {
    try {
      const url = `${baseUrl}/authenticate`
      const res = await chai.request(url)
      .post('')
      .type('application/json')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ hydro_address_id })

      const { authentication_id } = res.body
      expect(res.status).to.equal(200);
      expect(authentication_id).to.be.a('string');
    }
    catch (err) {
      throw err;
    }
  });
})
