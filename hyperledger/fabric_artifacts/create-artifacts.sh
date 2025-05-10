
if [[ $1 == "init" ]]; then
    #Generate Crypto artifactes for organizations
    cryptogen generate --config=./crypto-config.yaml --output=./crypto-config/
elif [[ $2 == "cont" ]]; then
    chmod -R 0755 ./crypto-config
    # Delete existing artifacts
    rm -rf ./crypto-config
    rm genesis.block product-authenticity-channel.tx
    rm -rf ../../channel-artifacts/*

    cryptogen generate --config=./crypto-config.yaml --output=./crypto-config/
fi



# System channel
SYS_CHANNEL="product-authenticity-sys-channel"

# channel name defaults to "mychannel"
CHANNEL_NAME="product-authenticity-channel"

echo $CHANNEL_NAME

# Generate System Genesis block
configtxgen -profile OrdererGenesis -configPath . -channelID $SYS_CHANNEL  -outputBlock ./genesis.block


# Generate channel configuration block
configtxgen -profile Channel -configPath . -outputCreateChannelTx ./product-authenticity-channel.tx -channelID $CHANNEL_NAME

echo "#######    Generating anchor peer update for Org1MSP  ##########"
configtxgen -profile Channel -configPath . -outputAnchorPeersUpdate ./Samsung1MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Samsung1MSP

echo "#######    Generating anchor peer update for Org2MSP  ##########"
configtxgen -profile Channel -configPath . -outputAnchorPeersUpdate ./Sony2MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Sony2MSP