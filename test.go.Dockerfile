FROM golang:1.25.1-alpine3.22@sha256:b6ed3fd0452c0e9bcdef5597f29cc1418f61672e9d3a2f55bf02e7222c014abd AS gobuild

COPY . /src
WORKDIR /src

# mock out static file generation
RUN mkdir /src/dist
RUN touch /src/dist/test.txt

RUN go test -covermode=atomic ./...
