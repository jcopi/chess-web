FROM node:24.10.0-alpine3.21@sha256:24085db06725487642885c4d4f7f156aeac0dc4b881b10dabb38cb8d5e142577 AS nodebuild

COPY . /src
WORKDIR /src

RUN npm ci
RUN npx vite build

FROM golang:1.25.2-alpine3.22@sha256:06cdd34bd531b810650e47762c01e025eb9b1c7eadd191553b91c9f2d549fae8 AS gobuild

COPY --from=nodebuild /src /src
WORKDIR /src

ENV CGO_ENABLED=0
RUN go build -o /bin/main -tags netgo,osusergo -trimpath -buildvcs=false .

FROM scratch

COPY --from=gobuild --chown=2000 /bin/main /bin/main
USER 2000

EXPOSE 8080
ENTRYPOINT [ "/bin/main" ]
