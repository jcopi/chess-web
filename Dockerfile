FROM node:24.6.0-alpine3.21@sha256:c9e2326c7bf56f4caf665d80a34cf29632f67ea281a2783d3a2b09fd3fe5b6bc AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npx vite build

FROM golang:1.25.0-alpine3.22@sha256:f18a072054848d87a8077455f0ac8a25886f2397f88bfdd222d6fafbb5bba440 AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild --chown=2000 /bin/main /bin/main
USER 2000

EXPOSE 8080
ENTRYPOINT [ "/bin/main" ]
