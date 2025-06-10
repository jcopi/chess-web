FROM node:24.2.0-alpine3.21@sha256:84d000da129e2e2ea545ad9779845a7e457b1472ba01225513a8ed1a222df7dd AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npm run test:run
