FROM node:24.4.0-alpine3.21@sha256:e6aaf9abc5ff965dd7f263c234677baf73bd6f60f022296603f01e1843bee686 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npm run test:run
