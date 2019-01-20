FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY agent ./agent

USER node
EXPOSE 8080
# The same image runs the webhook (default), the mock API and the simulator.
CMD ["node", "src/webhook/server.js"]
ENV ROLLBACK_CHANGES=true
ENV TRANSCODE_VIDEO=true
ENV ROLLBACK_CHANGES=true
ENV TRANSCODE_VIDEO=true