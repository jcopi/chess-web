FROM golang:1.24.4-alpine3.22@sha256:68932fa6d4d4059845c8f40ad7e654e626f3ebd3706eef7846f319293ab5cb7a AS gobuild

COPY . /src
WORKDIR /src

# mock out static file generation
RUN mkdir /src/dist
RUN touch /src/dist/test.txt

RUN go test -covermode=atomic ./...
