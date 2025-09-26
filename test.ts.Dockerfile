FROM node:24.9.0-alpine3.21@sha256:ffda5f5d47657a0fadca1a3ca2042214a7dcb928ffbdc15d1933fcef2eff2be2 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npm run test:run
