const express = require('express');
const session = require('express-session');
const path = require('path');
const FileStore = require('session-file-store')(session);
const app = express();

// configure the session
app.use(session({
  store: new FileStore(),
  secret: 'session-secret',
  resave: false,
  saveUninitialized: true
}));

app.set('port', 5000);
app.use(express.static(path.join(__dirname, '/public')));

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');

app.get('/', (request, response) => {
  response.render('index');
});

app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'));
});
