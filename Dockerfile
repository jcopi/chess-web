FROM node:24.2.0-alpine3.21@sha256:84d000da129e2e2ea545ad9779845a7e457b1472ba01225513a8ed1a222df7dd AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npx vite build

FROM golang:1.24.4-alpine3.22@sha256:68932fa6d4d4059845c8f40ad7e654e626f3ebd3706eef7846f319293ab5cb7a AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild --chown=2000 /bin/main /bin/main
USER 2000

EXPOSE 8080
ENTRYPOINT [ "/bin/main" ]
