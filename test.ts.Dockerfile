FROM node:24.6.0-alpine3.21@sha256:c9e2326c7bf56f4caf665d80a34cf29632f67ea281a2783d3a2b09fd3fe5b6bc AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npm run test:run
