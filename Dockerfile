FROM node:25.0.0-alpine3.21@sha256:54a2c8c7113949ec9b177738aaa7188529b73e2cbcf1d572e62bbe4c2e7e4df0 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npx vite build

FROM golang:1.25.3-alpine3.22@sha256:aee43c3ccbf24fdffb7295693b6e33b21e01baec1b2a55acc351fde345e9ec34 AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild --chown=2000 /bin/main /bin/main
USER 2000

EXPOSE 8080
ENTRYPOINT [ "/bin/main" ]
