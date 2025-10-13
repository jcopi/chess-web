FROM golang:1.25.2-alpine3.22@sha256:06cdd34bd531b810650e47762c01e025eb9b1c7eadd191553b91c9f2d549fae8 AS gobuild

COPY . /src
WORKDIR /src

# mock out static file generation
RUN mkdir /src/dist
RUN touch /src/dist/test.txt

RUN go test -covermode=atomic ./...
