# clink-console - the clink-fe ops console served same-origin by a pinned
# clink coordinator, in one image.
#
# Stage 1 builds the console (Vite -> dist/); the final stage starts from
# the published clink runtime image at a PINNED version and adds nothing
# but the static bundle: clink_node serves it at `/` via --http-static-dir,
# beside the JSON API - one port, no nginx, no CORS configuration. The
# clink version is a build argument so each console release states exactly
# which engine it was built against.
#
#   docker build -t clink-console .
#   docker run -p 8081:8081 clink-console
#   open http://localhost:8081        # console + API on the same origin
#
# The default command runs a single coordinator. For a full cluster,
# compose this image as the coordinator alongside plain clink-runtime
# workers (same base, same version) - see the repository README.
#
# Platform note: the runtime base is linux/amd64 (see clink's release
# notes), so this image is too.

ARG CLINK_VERSION=0.4.0

FROM node:22-alpine AS console
WORKDIR /console
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ghcr.io/orhaugh/clink-runtime:${CLINK_VERSION}
ARG CLINK_VERSION
LABEL org.opencontainers.image.title="clink-console" \
      org.opencontainers.image.description="clink coordinator serving the clink-fe ops console same-origin" \
      org.opencontainers.image.source="https://github.com/orhaugh/clink-fe" \
      io.clink.engine.version="${CLINK_VERSION}"
COPY --from=console /console/dist /opt/clink-fe

EXPOSE 6123 8081
ENTRYPOINT ["clink_node"]
CMD ["--role=coordinator", "--port=6123", "--bind-host=0.0.0.0", \
     "--http-port=8081", "--http-bind=0.0.0.0", \
     "--http-static-dir=/opt/clink-fe"]
