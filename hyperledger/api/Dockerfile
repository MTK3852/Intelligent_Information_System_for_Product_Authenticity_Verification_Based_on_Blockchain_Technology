FROM node:10-alpine

#Copy neede files for backend
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app/

WORKDIR /home/node/app

COPY app_server.js ./
COPY connection_conf.json ./
COPY package.json ./
COPY wallet ./

USER node

RUN npm install

COPY --chown=node:node . .

EXPOSE 9090

CMD [ "node", "app_server.js", "admin_samsung" ]