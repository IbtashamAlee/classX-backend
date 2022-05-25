FROM node:16-alpine

WORKDIR /app
RUN npm install bull
RUN npm install @sendgrid/mail

COPY . .

CMD node consumer.js
