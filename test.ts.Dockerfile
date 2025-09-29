FROM node:24.9.0-alpine3.21@sha256:843a738e7405b4fb42b2fc37d6c99cd2063af9f48852968a09851129a96b0ebf AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npm run test:run
