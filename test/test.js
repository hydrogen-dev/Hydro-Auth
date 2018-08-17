require('dotenv').config()

const Web3 = require('web3');
const abi = require('../interface.json'); //interface for contract
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

const baseUrl = process.env.HYDRO_URL;
const network = process.env.NETWORK_URL; //use websocket address to be able to listen to events
const oauthBaseUrl = process.env.OAUTH_URL; //baseurl for oauth API
const client_id = process.env.CLIENT_ID; //username for Hydro API
const client_secret = process.env.CLIENT_SECRET; //key for Hydro API
const contractAddress = process.env.CONTRACT_ADDRESS; //contract address on Sandbox

const web3 = new Web3(network); // using web3.js version 1.0.0-beta.28, node v8.9.1, npm 5.5.1
const HydroContract = new web3.eth.Contract(abi, contractAddress);
const performRaindropFunction = require('../server/index.js')

chai.use(chaiHttp);

describe('authenticate with Raindrop API', function() {
  let access_token, hydro_address_id, address, privateKey;

  it('should get an access token via OAuth API that is used to call Raindrop API', async function() {
    try {
      this.timeout(10000);
      const auth = new Buffer.from(client_id + ':' + client_secret).toString('base64')
      const url = `${oauthBaseUrl}/oauth/token?grant_type=client_credentials`
      const res = await chai.request(url)
      .post('')
      .set('Authorization', `Basic ${auth}`)
      .send()

      access_token = res.body.access_token

      expect(res.status).to.equal(200);
      expect(access_token).to.be.a('string');
    }
    catch (err) {
      throw err;
    }
  });

  it('should whitelist address', async function() {
    try {
      this.timeout(10000);
      const account = await web3.eth.accounts.create();
      ({ address, privateKey } = account);
      const url = `${baseUrl}/whitelist`
      const res = await chai.request(url)
      .post('')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ address })

      hydro_address_id = res.body.hydro_address_id

      expect(res.status).to.equal(200);
      expect(hydro_address_id).to.be.a('string');
    }
    catch (err) {
      throw err;
    }
  });

  it('should request challenge details that includes amount, challenge, and partner_id', async function() {
    try {
      this.timeout(10000);
      console.log('hydro_address_id',hydro_address_id)
      const url = `${baseUrl}/challenge`
      const res = await chai.request(url)
      .post('')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ hydro_address_id })

      console.log('res.body',res.body)
      const { amount, challenge, partner_id } = res.body

      expect(amount).to.be.a('number');
      expect(challenge).to.be.a('number');
      expect(partner_id).to.be.a('number');
    }
    catch (err) {
      throw err;
    }
  });

  it('should perform raindrop', async function() {
    try {
      this.timeout(10000);
      const raindrop = await performRaindropFunction(address, privateKey, amount, challenge, partner_id)
      console.log('raindrop',raindrop)
      expect(raindrop).to.exist;
    }
    catch (err) {
      throw err;
    }
  });

  it('should return an authentication_id when authenticated successfully', async function () {
    try {
      this.timeout(10000);
      const url = `${baseUrl}/authenticate`
      const res = await chai.request(url)
      .post('')
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
