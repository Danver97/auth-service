FROM node:lts-alpine

COPY ./index.html /src/

COPY ./test.js /src/

COPY ./package.json /src/

WORKDIR /src

RUN npm install --only=production

EXPOSE 3000

CMD npm start