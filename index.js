const port = 5000;
const express = require('express');
const session = require('express-session');
const path = require('path');
const querystring = require('querystring');
const http = require('request');
const argv = require('minimist')(process.argv.slice(2));
const FileStore = require('session-file-store')(session);
const app = express();

const redirectUrl = `http://localhost:${port}/auth`;
const loginUrl = 'https://auth.getmondo.co.uk/?' + querystring.stringify({
  'client_id': argv.clientId,
  'redirect_uri': redirectUrl,
  'response_type': 'code'
});

// configure the session
app.use(session({
  store: new FileStore(),
  secret: 'session-secret',
  resave: false,
  saveUninitialized: true
}));

app.set('port', port);
app.use(express.static(path.join(__dirname, '/public')));

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');

app.get('/auth', (request, response) => {
  const formData = {
    'grant_type': 'authorization_code',
    'client_id': argv.clientId,
    'client_secret': argv.clientSecret,
    'redirect_uri': redirectUrl,
    'code': request.query.code
  };

  http.post({
    url: 'https://api.getmondo.co.uk/oauth2/token',
    form: formData},
    (err, _, body) => {
      if (err) {
        return console.error('upload failed:', err);
      } else {
        const jsonResponse = JSON.parse(body);
        if (jsonResponse.error) {
          console.error(jsonResponse);
        } else {
          console.log('Access token returned:', jsonResponse.access_token);
          request.session.token = jsonResponse.access_token;
          response.redirect('/');
        }
      }
    });
});

app.get('/', (request, response) => {
  const accessToken = request.session.token;
  if (!accessToken) {
    response.redirect(loginUrl);
    return;
  }

  response.render('index');
});

app.listen(port, () => {
  console.log('Node app is running on port', port);
});
