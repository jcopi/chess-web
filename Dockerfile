FROM node:24.1.0-alpine3.21 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm install
RUN npx vite build

FROM golang:1.24.4-alpine3.22 AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild /bin/main /bin/main

EXPOSE 80
ENTRYPOINT [ "/bin/main" ]
