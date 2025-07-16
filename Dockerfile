FROM node:24.4.0-alpine3.21@sha256:e6aaf9abc5ff965dd7f263c234677baf73bd6f60f022296603f01e1843bee686 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npx vite build

FROM golang:1.24.5-alpine3.22@sha256:ddf52008bce1be455fe2b22d780b6693259aaf97b16383b6372f4b22dd33ad66 AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild --chown=2000 /bin/main /bin/main
USER 2000

EXPOSE 8080
ENTRYPOINT [ "/bin/main" ]
