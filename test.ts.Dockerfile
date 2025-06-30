FROM node:24.3.0-alpine3.21@sha256:d2df158f09bc2b0e493cb979b67bacedc8b4a87bd1224e2dd7dfae0a4699e40d AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npm run test:run
