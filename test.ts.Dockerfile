FROM node:24.1.0-alpine3.21@sha256:dfea0736e82fef246aba86b2082a5e86c4825470302692b841d097dd61253b79 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npm run test:run
