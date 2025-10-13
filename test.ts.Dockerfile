FROM node:24.10.0-alpine3.21@sha256:24085db06725487642885c4d4f7f156aeac0dc4b881b10dabb38cb8d5e142577 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npm run test:run
