FROM mcr.microsoft.com/playwright:v1.47.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p db screenshots
ENV NODE_ENV=production
CMD ["node","index.js"]
