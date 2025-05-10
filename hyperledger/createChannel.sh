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

createChannel(){
    rm -rf ./channel_artifacts/${CHANNEL_NAME}.block
    setGlobalsForPeer0Org1
    
    peer channel create -o localhost:7050 -c $CHANNEL_NAME \
    --ordererTLSHostnameOverride orderer0.product.authenticity.com \
    -f ./fabric_artifacts/${CHANNEL_NAME}.tx --outputBlock ./channel_artifacts/${CHANNEL_NAME}.block \
    --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA
}


joinChannel(){
    setGlobalsForPeer0Org1
    peer channel join -b ./channel_artifacts/$CHANNEL_NAME.block
    
    setGlobalsForPeer1Org1
    peer channel join -b ./channel_artifacts/$CHANNEL_NAME.block
    
    setGlobalsForPeer0Org2
    peer channel join -b ./channel_artifacts/$CHANNEL_NAME.block
    
    setGlobalsForPeer1Org2
    peer channel join -b ./channel_artifacts/$CHANNEL_NAME.block
    
}

updateAnchorPeers(){
    setGlobalsForPeer0Org1
    peer channel update -o localhost:7050 --ordererTLSHostnameOverride orderer0.product.authenticity.com -c $CHANNEL_NAME -f ./fabric_artifacts/${CORE_PEER_LOCALMSPID}anchors.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA
    
    setGlobalsForPeer0Org2
    peer channel update -o localhost:7050 --ordererTLSHostnameOverride orderer0.product.authenticity.com -c $CHANNEL_NAME -f ./fabric_artifacts/${CORE_PEER_LOCALMSPID}anchors.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA
    
}

# removeOldCrypto

createChannel
joinChannel
updateAnchorPeers
