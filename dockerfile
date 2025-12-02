FROM ghcr.io/puppeteer/puppeteer:21.5.0

USER root
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

CMD [ "node", "index.js" ]
