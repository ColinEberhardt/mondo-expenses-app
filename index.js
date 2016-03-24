const port = 5000;
const express = require('express');
const session = require('express-session');
const path = require('path');
const querystring = require('querystring');
const argv = require('minimist')(process.argv.slice(2));
const FileStore = require('session-file-store')(session);
const app = express();

const loginUrl = 'https://auth.getmondo.co.uk/?' + querystring.stringify({
  'client_id': argv.clientId,
  'redirect_uri': `http://localhost:${port}/auth`,
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
