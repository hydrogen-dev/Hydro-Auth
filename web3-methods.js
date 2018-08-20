const chalk  = require('chalk');
const Tx = require('ethereumjs-tx');
const EUtil = require('ethereumjs-util');

//create ethereum account
async function createAddress(web3) {

    try {
        return await web3.eth.accounts.create();
    }
    catch (error) {
        return Promise.reject(error);
    }

}

//Listens to `sendSignedTransaction` method in the contract
//For now only this method works for sending transactions on Infura network
async function sendSignedTransaction(web3, privateKey, nonce, gasPrice, gasLimit, to, from, data) {

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
async function performRaindrop(web3, HydroContract, contractAddress, accountAddress, privateKey, amount, challenge, partner_id) {

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
        const getMoreTokensReceipt = await sendSignedTransaction(web3, privateKeyBuffer, nonceHex, priceHex, gasHexForGetMoreTokens, contractAddress, accountAddress, getMoreTokensData);
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
        const authenticateReceipt = await sendSignedTransaction(web3, privateKeyBuffer, newNonceHex, priceHex, gasHexForAuthenticate, contractAddress, accountAddress, getAuthenticateData);
        console.log(chalk.green('authenticateReceipt'),authenticateReceipt);
    }
    catch (error) {
        return Promise.reject(error);
    }

}

module.exports = { createAddress, sendSignedTransaction, performRaindrop };
