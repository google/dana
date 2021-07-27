FROM node:16-buster-slim

RUN mkdir /dana
WORKDIR /dana

# install node requirements
COPY package.json ./
RUN npm install

# dana application
COPY src ./src
COPY www ./www
COPY third_party ./third_party

CMD ["npm", "start"]
