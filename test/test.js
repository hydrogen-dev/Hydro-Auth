require('dotenv').config()
const baseUrl = process.env.HYDRO_URL;
const oauthBaseUrl = process.env.OAUTH_URL;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const contractAddress = process.env.CONTRACT_ADDRESS;
const network = process.env.NETWORK_URL;

const path = require('path');
const nodeModulesPath = path.join(__dirname, '../node_modules');
const Web3 = require('web3');
const web3 = new Web3(network);
const abi = require('../interface.json');
const HydroContract = new web3.eth.Contract(abi, contractAddress);
const { createAddress, performRaindrop } = require('../web3-methods.js');

const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
chai.use(chaiHttp);

describe('authenticate with Raindrop API', function() {
  let access_token;
  let hydro_address_id = 'ee1df97c-5c38-48c0-b46c-70bc0b69bfb1'; //demo hydro_address_id from whitelisting (plug in your own)
  let address = '0xA3C0336928bc8964512847a1193D0b4Cc6Dc19C9'; //demo account address (plug in your own)
  let privateKey = '0xc16f09068c0f3323b3f02bf39e8d1e68ea329874b0379f724528478f5dd3860e'; //demo private key associated with account address (plug in your own)

  let amount;
  let challenge;
  let partner_id;

  before(async function() {
      try {
        this.timeout(10000);

        if(!access_token) {
          const auth = new Buffer.from(`${client_id}:${client_secret}`).toString('base64')
          const url = `${oauthBaseUrl}/oauth/token?grant_type=client_credentials`
          const res = await chai.request(url)
          .post('')
          .set('Authorization', `Basic ${auth}`)
          .send()

          access_token = res.body.access_token
        }

        if(!address || !privateKey) {
          const account = await createAddress(web3);
          ({ address, privateKey } = account);
        }

        if(!hydro_address_id) {
          const url = `${baseUrl}/whitelist`
          const res = await chai.request(url)
          .post('')
          .set('Authorization', `Bearer ${access_token}`)
          .send({ address })

          hydro_address_id = res.body.hydro_address_id
        }
      }
      catch (err) {
        throw (err)
      }
  })

  it('should request challenge details that includes amount, challenge, and partner_id', async function() {
    try {
      this.timeout(10000);

      const url = `${baseUrl}/challenge`
      const res = await chai.request(url)
      .post('')
      .set('Authorization', `Bearer ${access_token}`)
      .send({ hydro_address_id })

      amount = res.body.amount
      challenge = res.body.challenge
      partner_id = res.body.partner_id

      expect(amount).to.be.a('number');
      expect(challenge).to.be.a('number');
      expect(partner_id).to.be.a('number');

    }
    catch (err) {
      throw err;
    }
  });


  it('should return an authentication_id if raindrop was performed successfully', async function () {
    try {
      this.timeout(100000);
      await performRaindrop(web3, HydroContract, contractAddress, address, privateKey, amount, challenge, partner_id)

      const url = `${baseUrl}/authenticate`
      const res = await chai.request(url)
      .get('')
      .set('Authorization', `Bearer ${access_token}`)
      .query({ hydro_address_id })

      const { authentication_id } = res.body

      expect(res.status).to.equal(200);
      expect(authentication_id).to.be.a('string');
    }
    catch (err) {
      throw err;
    }
  });
})
