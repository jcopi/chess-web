FROM node:24.9.0-alpine3.21@sha256:843a738e7405b4fb42b2fc37d6c99cd2063af9f48852968a09851129a96b0ebf AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npx vite build

FROM golang:1.25.1-alpine3.22@sha256:b6ed3fd0452c0e9bcdef5597f29cc1418f61672e9d3a2f55bf02e7222c014abd AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild --chown=2000 /bin/main /bin/main
USER 2000

EXPOSE 8080
ENTRYPOINT [ "/bin/main" ]
