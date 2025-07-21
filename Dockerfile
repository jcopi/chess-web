FROM node:24.4.1-alpine3.21@sha256:3eb2e1adfcf3945867eb4d763cfa4cb3a0a2560d70de10481d95453488854786 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npx vite build

FROM golang:1.24.5-alpine3.22@sha256:daae04ebad0c21149979cd8e9db38f565ecefd8547cf4a591240dc1972cf1399 AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild --chown=2000 /bin/main /bin/main
USER 2000

EXPOSE 8080
ENTRYPOINT [ "/bin/main" ]
