#!/bin/bash

docker rm -f authenticity_frontend

docker rmi authenticity_frontend:v1

docker-compose up -d --no-deps authenticity_frontend

echo "Frontend updated successfully"

cd api

cp -rf /tmp/node_modules_1 ./node_modules

node app_server.js admin_samsung