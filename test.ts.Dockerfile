FROM node:25.0.0-alpine3.21@sha256:1c66cb8e1a58309a1be03f3752bfc4a98aafa9f822e3fb003c5c97f7c2d1edd4 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npm run test:run
