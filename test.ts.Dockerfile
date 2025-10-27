FROM node:25.0.0-alpine3.21@sha256:54a2c8c7113949ec9b177738aaa7188529b73e2cbcf1d572e62bbe4c2e7e4df0 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npm run test:run
