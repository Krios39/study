FROM rust:1-alpine AS build
RUN apk add --no-cache musl-dev
WORKDIR /src
# сначала только зависимости — кешируется между сборками
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm -rf src target/release/deps/echo*
COPY src ./src
RUN cargo build --release

FROM alpine:3.20
COPY --from=build /src/target/release/echo /echo
EXPOSE 8080
ENTRYPOINT ["/echo"]
