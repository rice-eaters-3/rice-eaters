# Railway uses this Dockerfile automatically at the repository root.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
