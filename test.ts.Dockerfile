FROM node:24.4.1-alpine3.21@sha256:3eb2e1adfcf3945867eb4d763cfa4cb3a0a2560d70de10481d95453488854786 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npm run test:run
