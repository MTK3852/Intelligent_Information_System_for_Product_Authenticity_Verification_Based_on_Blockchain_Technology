#!/bin/bash
export CORE_PEER_TLS_ENABLED=true
export ORDERER_CA=${PWD}/fabric_artifacts/crypto-config/ordererOrganizations/product.authenticity.com/orderers/orderer0.product.authenticity.com/msp/tlscacerts/tlsca.product.authenticity.com-cert.pem
export PEER0_ORG1_CA=${PWD}/fabric_artifacts/crypto-config/peerOrganizations/samsung.product.authenticity.com/peers/peer0.samsung.product.authenticity.com/tls/ca.crt
export PEER0_ORG2_CA=${PWD}/fabric_artifacts/crypto-config/peerOrganizations/sony.product.authenticity.com/peers/peer0.sony.product.authenticity.com/tls/ca.crt
export FABRIC_CFG_PATH=${PWD}/channel_artifacts/configs/

export CHANNEL_NAME=product-authenticity-channel

setGlobalsForOrderer(){
    export CORE_PEER_LOCALMSPID="OrdererMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/fabric_artifacts/crypto-config/ordererOrganizations/product.authenticity.com/orderers/orderer0.product.authenticity.com/msp/tlscacerts/tlsca.product.authenticity.com-cert.pem
    export CORE_PEER_MSPCONFIGPATH=${PWD}/fabric_artifacts/crypto-config/ordererOrganizations/product.authenticity.com/users/Admin@product.authenticity.com/msp

}

setGlobalsForPeer0Org1(){
    export CORE_PEER_LOCALMSPID="Samsung1MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG1_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/fabric_artifacts/crypto-config/peerOrganizations/samsung.product.authenticity.com/users/Admin@samsung.product.authenticity.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
}

setGlobalsForPeer1Org1(){
    export CORE_PEER_LOCALMSPID="Samsung1MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG1_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/fabric_artifacts/crypto-config/peerOrganizations/samsung.product.authenticity.com/users/Admin@samsung.product.authenticity.com/msp
    export CORE_PEER_ADDRESS=localhost:8051
    
}

setGlobalsForPeer0Org2(){
    export CORE_PEER_LOCALMSPID="Sony2MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG2_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/fabric_artifacts/crypto-config/peerOrganizations/sony.product.authenticity.com/users/Admin@sony.product.authenticity.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
    
}

setGlobalsForPeer1Org2(){
    export CORE_PEER_LOCALMSPID="Sony2MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG2_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/fabric_artifacts/crypto-config/peerOrganizations/sony.product.authenticity.com/users/Admin@sony.product.authenticity.com/msp
    export CORE_PEER_ADDRESS=localhost:10051
    
}

presetup() {
    echo Vendoring Go dependencies ...  
    pushd chaincode/authenticity_chaincode
    go mod tidy
    go get -t .
    GO111MODULE=on go mod vendor
    popd
    echo Finished vendoring Go dependencies
}
# presetup

export CHANNEL_NAME="product-authenticity-channel"
export CC_RUNTIME_LANGUAGE="golang"
export VERSION=1
export CC_SRC_PATH="chaincode/authenticity_chaincode"
export CC_NAME="product-authenticity-chaincode"

packageChaincode() {
    rm -rf ${CC_NAME}.tar.gz
    # setGlobalsForPeer0Org1
    peer lifecycle chaincode package ${CC_NAME}.tar.gz \
        --path ${CC_SRC_PATH} --lang ${CC_RUNTIME_LANGUAGE} \
        --label ${CC_NAME}_${VERSION}
}
# packageChaincode

installChaincode() {
    setGlobalsForPeer0Org1 #endorsement/commiting one
    peer lifecycle chaincode install ${CC_NAME}.tar.gz

    setGlobalsForPeer1Org1 #commiting one
    peer lifecycle chaincode install ${CC_NAME}.tar.gz

    setGlobalsForPeer0Org2 #endorsement/commiting one
    peer lifecycle chaincode install ${CC_NAME}.tar.gz

    setGlobalsForPeer1Org2 #commiting one
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
}

# installChaincode

queryInstalled() {
    setGlobalsForPeer0Org1
    peer lifecycle chaincode queryinstalled >&log.txt
    cat log.txt
    PACKAGE_ID=$(sed -n "/${CC_NAME}_${VERSION}/{s/^Package ID: //; s/, Label:.*$//; p;}" log.txt)
    echo PackageID is ${PACKAGE_ID}
}

# queryInstalled

approveForMyOrg1() {
    setGlobalsForPeer0Org1
    # set -x
    peer lifecycle chaincode approveformyorg -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.product.authenticity.com --tls $CORE_PEER_TLS_ENABLED \
        --cafile $ORDERER_CA --channelID $CHANNEL_NAME --name ${CC_NAME} --version ${VERSION} \
        --init-required --package-id ${PACKAGE_ID} \
        --sequence ${VERSION} > /dev/null 2>&1
    # set +x
}
# approveForMyOrg1
getBlock() {
    setGlobalsForPeer0Org1

    peer channel getinfo  -c $CHANNEL_NAME -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.product.authenticity.com --tls  \
        --cafile $ORDERER_CA > /dev/null 2>&1
}

checkCommitReadyness() {
    setGlobalsForPeer0Org1
    peer lifecycle chaincode checkcommitreadiness \
        --collections-config $PRIVATE_DATA_CONFIG \
        --channelID $CHANNEL_NAME --name ${CC_NAME} --version ${VERSION} \
        --sequence ${VERSION} --output json --init-required > /dev/null 2>&1
}

# checkCommitReadyness

approveForMyOrg2() {
    setGlobalsForPeer0Org2

    peer lifecycle chaincode approveformyorg -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.product.authenticity.com --tls $CORE_PEER_TLS_ENABLED \
        --cafile $ORDERER_CA --channelID $CHANNEL_NAME --name ${CC_NAME} \
        --version ${VERSION} --init-required --package-id ${PACKAGE_ID} \
        --sequence ${VERSION} > /dev/null 2>&1

}

# approveForMyOrg2

checkCommitReadyness() {

    setGlobalsForPeer0Org1
    peer lifecycle chaincode checkcommitreadiness --channelID $CHANNEL_NAME \
        --peerAddresses localhost:7051 --tlsRootCertFiles $PEER0_ORG1_CA \
        --name ${CC_NAME} --version ${VERSION} --sequence ${VERSION} --output json --init-required > /dev/null 2>&1
}

# checkCommitReadyness

commitChaincodeDefination() {
    setGlobalsForPeer0Org1
    peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer0.product.authenticity.com \
        --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA \
        --channelID $CHANNEL_NAME --name ${CC_NAME} \
        --peerAddresses localhost:7051 --tlsRootCertFiles $PEER0_ORG1_CA \
        --peerAddresses localhost:9051 --tlsRootCertFiles $PEER0_ORG2_CA \
        --version ${VERSION} --sequence ${VERSION} --init-required > /dev/null 2>&1

}

# commitChaincodeDefination

chaincodeInvokeInit() {
    setGlobalsForPeer0Org1
    peer chaincode invoke -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.product.authenticity.com \
        --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA \
        -C $CHANNEL_NAME -n ${CC_NAME} \
        --peerAddresses localhost:7051 --tlsRootCertFiles $PEER0_ORG1_CA \
        --peerAddresses localhost:9051 --tlsRootCertFiles $PEER0_ORG2_CA \
        --isInit -c '{"Args":[]}' > /dev/null 2>&1

}

# chaincodeInvokeInit

chaincodeInvoke() {

    setGlobalsForPeer0Org1

    # Init ledger
    peer chaincode invoke -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.product.authenticity.com \
        --tls $CORE_PEER_TLS_ENABLED \
        --cafile $ORDERER_CA \
        -C $CHANNEL_NAME -n ${CC_NAME} \
        --peerAddresses localhost:7051 --tlsRootCertFiles $PEER0_ORG1_CA \
        --peerAddresses localhost:9051 --tlsRootCertFiles $PEER0_ORG2_CA \
        -c '{"function": "initLedger","Args":[]}' > /dev/null 2>&1

    peer chaincode invoke -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.product.authenticity.com \
        --tls $CORE_PEER_TLS_ENABLED \
        --cafile $ORDERER_CA \
        -C $CHANNEL_NAME -n ${CC_NAME} \
        --peerAddresses localhost:7051 --tlsRootCertFiles $PEER0_ORG1_CA \
        --peerAddresses localhost:9051 --tlsRootCertFiles $PEER0_ORG2_CA \
        -c '{"function": "createStoreItem","Args":["Tesla", "Headphones", "Casper", "6242-5231-4124-6631"]}' > /dev/null 2>&1

}

# chaincodeInvoke

# Run this function if you add any new dependency in chaincode
presetup

packageChaincode
installChaincode
queryInstalled
approveForMyOrg1
checkCommitReadyness
approveForMyOrg2
checkCommitReadyness
commitChaincodeDefination
chaincodeInvokeInit
sleep 7
chaincodeInvoke
sleep 5
