FROM golang:1.24.5-alpine3.22@sha256:ddf52008bce1be455fe2b22d780b6693259aaf97b16383b6372f4b22dd33ad66 AS gobuild

COPY . /src
WORKDIR /src

# mock out static file generation
RUN mkdir /src/dist
RUN touch /src/dist/test.txt

RUN go test -covermode=atomic ./...
