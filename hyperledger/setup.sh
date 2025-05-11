echo ################################################ EXPOSING DB ENV VARS ###############################################################
export $(cat .env | xargs)

echo ################################################ Generating Crypto Materials e.x. channel.tx, genesis.block ###############################################################
if [[ $1 == "artifact" ]]; then
    sh ./fabric_artifacts/create-artifacts.sh init #can set "cont" for updating existing crypto materials
fi

echo ################################################ Wake Up Fabric Containers ###############################################################
if [[ $1 == "u" ]]; then
    apt update && apt install -y git git-lfs nano jq docker docker-compose gzip
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 14.21.3
    nvm use 14.21.3
    nvm alias default 14.21.3
    chmod -R +x fabric_bin/*
    sudo cp fabric_bin/* /usr/local/bin/
    sudo tar -C /usr/local -xzf go1.13.6.linux-amd64.tar.gz.1
    docker-compose -f docker-compose.yaml up -d
    sleep 60
    echo ################################################ Creating Channel/Joining All Peers There ###############################################################
    sh ./createChannel.sh
    sleep 8
    echo ################################################ Running Chaincode ###############################################################
    sudo ./deployChaincode.sh
elif [[ $1 == "d" ]]; then
    docker-compose -f docker-compose.yaml down
fi

#echo ################################################ Running Backend ###o############################################################
if [[ $1 == "u" ]]; then
    cd ./api
    npm install --unsafe-perm
    node app_server.js admin_samsung &
    PID=$!
    sleep 10
    kill $PID
    node app_server.js admin_samsung
elif [[ $1 == "back" ]]; then
    cd ./api
    npm install --unsafe-perm
    node app_server.js admin_samsung &
    PID=$!
    sleep 10
    kill $PID
    node app_server.js admin_samsung
fi
