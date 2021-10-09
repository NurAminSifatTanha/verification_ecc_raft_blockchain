/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');
const channelName = 'mychannel';
const chaincodeName = 'app';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUser';


async function main() {
	try {
		// build an in memory object with the network configuration (also known as a connection profile)
		const ccp = buildCCPOrg1();

		// build an instance of the fabric ca services client based on
		// the information in the network configuration
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

		// setup the wallet to hold the credentials of the application user
		const wallet = await buildWallet(Wallets, walletPath);

		// in a real application this would be done on an administrative flow, and only once
		await enrollAdmin(caClient, wallet, mspOrg1);

		// in a real application this would be done only when a new user was required to be added
		// and would be part of an administrative flow
		await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

		// Create a new gateway instance for interacting with the fabric network.
		// In a real application this would be done as the backend server session is setup for
		// a user that has been verified.
		const gateway = new Gateway();

		try {
			await gateway.connect(ccp, {
				wallet,
				identity: org1UserId,
				discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
			});

			const network = await gateway.getNetwork(channelName);

			// Get the contract from the network.
			const contract = network.getContract(chaincodeName);

			// ExpressJs
			const express = require("express");
			const app = express();
			app.use(express.urlencoded({ extended: false }));
			app.use(express.json());
			const ecc = require('eosjs-ecc')

			const port = 3000;

			// create hid
			app.post("/hid", async function (req, res) {
				const { h_id } = req.body;
				const key = `hid_${h_id}`;
				try {
					let result = await contract.evaluateTransaction(
						'CreateHID', key, h_id
					);
					await contract.submitTransaction(
						'CreateHID', key, h_id
					);
					res.send(result.toString());
				} catch (error) {
					res.status(400).send(error.toString());
				}
			});

			// register with hid verification
			app.post("/hidregister", async function (req, res) {
				console.log(req.body)
				const { h_id } = req.body;
				const key = `hid_${h_id}`;
				ecc.randomKey().then(privateKey => {
					console.log('Private Key:\t', privateKey) // wif
					console.log('Public Key:\t', ecc.privateToPublic(privateKey)) // EOSkey...
					let public_key = ecc.privateToPublic(privateKey)
					const G_x = public_key;
					console.log("160bit code", G_x)
					const x = Math.floor(Math.random() * 1000);
					try {
						try {
							let result = contract.evaluateTransaction(
								'HIDExists', h_id
							)
							contract.submitTransaction(
								'Registration', key, h_id, x, G_x
							)
							res.send(result.toString());
						} catch (err) {
							res.status(400).send(`HID not exist create one.`)
						}
					} catch (error) {
						res.status(400).send(error.toString());
					}
				})
			});

			// check register or not
			app.post("/checkregister", async function (req, res) {

				const { h_id } = req.body;
				let key = `register_${h_id}`
				try {
					let result = contract.evaluateTransaction(
						'FindRegisterd', key
					)
					// console.log(JSON.parse(result))
					res.send("Successfull check register.")

				} catch (error) {
					res.status(400).send(error.toString());
				}
			});
			app.listen(port, () => {
				console.log(`Server listening at http://localhost:${port}`);
			})

		} finally {
			
		}
	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
	}
}

main();