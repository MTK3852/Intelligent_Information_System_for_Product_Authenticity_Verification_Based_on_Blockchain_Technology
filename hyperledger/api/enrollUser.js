/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
//node enrollUser.js priv1 Samsung1MSP org1.department1 ca.samsung.product.authenticity.com ./connection_org.json
const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');
const user_enroll = process.argv[2]
const user_department = process.argv[3]
const admin_name = process.argv[4]
const org_msp = process.argv[5]

async function main() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '.', 'connection_conf.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities["ca.samsung.product.authenticity.com"].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(user_enroll);
        if (userIdentity) {
            console.log(`An identity for the user "${user_enroll}" already exists in the wallet`);
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminIdentity = await wallet.get(admin_name);
        if (!adminIdentity) {
            console.log(`An identity for the admin user "${admin_name}" does not exist in the wallet`);
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, admin_name);

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: user_department,
            enrollmentID: user_enroll,
            role: 'client'
        }, adminUser);0
        const enrollment = await ca.enroll({
            enrollmentID: user_enroll,
            enrollmentSecret: secret
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: org_msp,
            type: 'X.509',
        };
        await wallet.put(user_enroll, x509Identity);
        console.log(`Successfully registered and enrolled user "${user_enroll}" and imported it into the wallet`);

    } catch (error) {
        console.error(`Failed to register '${user_enroll}': ${error}`);
        process.exit(1);
    }
}

main();