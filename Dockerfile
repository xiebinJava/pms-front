FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.31-alpine
USER root
# Refresh the Alpine security packages in the final runtime image. The
# application is static, so only the runtime layer needs the upgrade.
RUN apk upgrade --no-cache
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY healthcheck-frontend.sh /usr/local/bin/healthcheck-frontend.sh
RUN chmod 0755 /usr/local/bin/healthcheck-frontend.sh \
    && chown -R nginx:nginx /usr/share/nginx/html /etc/nginx/conf.d /usr/local/bin/healthcheck-frontend.sh
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["/usr/local/bin/healthcheck-frontend.sh"]
