FROM golang:1.24.5-alpine3.22@sha256:daae04ebad0c21149979cd8e9db38f565ecefd8547cf4a591240dc1972cf1399 AS gobuild

COPY . /src
WORKDIR /src

# mock out static file generation
RUN mkdir /src/dist
RUN touch /src/dist/test.txt

RUN go test -covermode=atomic ./...
