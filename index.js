'use strict';

const port = 5000;
const express = require('express');
const Q = require('q');
const session = require('express-session');
const path = require('path');
const querystring = require('querystring');
const rp = require('request-promise');
const argv = require('minimist')(process.argv.slice(2));
const FileStore = require('session-file-store')(session);
const app = express();

const redirectUrl = `http://localhost:${port}/auth`;
const loginUrl = 'https://auth.getmondo.co.uk/?' + querystring.stringify({
  'client_id': argv.clientId,
  'redirect_uri': redirectUrl,
  'response_type': 'code'
});

function balanceRequest(accessToken, accountId) {
  return {
    uri: 'https://api.getmondo.co.uk/balance',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    qs: {
      'account_id': accountId
    },
    json: true
  };
}

function listTransactionsRequest(accessToken, accountId) {
  return {
    uri: 'https://api.getmondo.co.uk/transactions',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    qs: {
      'account_id': accountId,
      'expand[]': 'merchant'
    },
    json: true
  };
}

function accountsRequest(accessToken) {
  return {
    uri: 'https://api.getmondo.co.uk/accounts',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    json: true
  };
}

function authTokenRequest(code) {
  return {
    method: 'POST',
    uri: 'https://api.getmondo.co.uk/oauth2/token',
    form: {
      'grant_type': 'authorization_code',
      'client_id': argv.clientId,
      'client_secret': argv.clientSecret,
      'redirect_uri': redirectUrl,
      'code': code
    },
    json: true
  };
}

const createFilterFromQuery = (query) =>
  (tx) => {
    const keys = Object.keys(query)
      .filter(k => ['format'].indexOf(k) === -1);
    for (const key of keys) {
      const expected = query[key];
      const actual = tx[key];
      if (Array.isArray(actual)) {
        if (actual.indexOf(expected) === -1) {
          return false;
        }
      } else if (['created', 'settled'].indexOf(key) > -1) {
        const min = new Date(expected.substr(0, 10));
        const max = new Date(expected.substr(11, 10));
        max.setDate(max.getDate() + 1);
        const date = new Date(actual);
        return min < date && date < max;
      } else {
        if (actual != expected) { // eslint-disable-line eqeqeq
          return false;
        }
      }
    }
    return true;
  };

// configure the session
app.use(session({
  store: new FileStore(),
  secret: 'session-secret',
  resave: false,
  saveUninitialized: true
}));

app.set('port', port);
app.use(express.static(path.join(__dirname, '/node_modules')));

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');

app.get('/auth', (request, response) => {
  rp(authTokenRequest(request.query.code))
    .then((body) => {
      if (body.error) {
        console.error(body);
      } else {
        console.log('Access token returned:', body.access_token);
        request.session.token = body.access_token;
        response.redirect('/?notes=#expenses');
      }
    })
    .error((error) => {
      console.error(error);
    });

});

app.get('/', (request, response) => {
  const accessToken = argv.accessToken || request.session.token;
  if (!accessToken) {
    response.redirect(loginUrl);
    return;
  }

  rp(accountsRequest(accessToken))
    .then(accountsResponse => {
      const account = accountsResponse.accounts[0];
      return Q.all([
        rp(balanceRequest(accessToken, account.id)),
        rp(listTransactionsRequest(accessToken, account.id))
      ])
      .then(mondoData => {
        const transactions = mondoData[1].transactions.filter(tx => tx.merchant)
          .filter(createFilterFromQuery(request.query));
        const data = {
          account: account,
          balance: mondoData[0],
          transactions
        };
        switch (request.query.format) {
        case 'json':
          return response.send(data);
        case 'expenses':
          return response.render('expenses', data);
        default:
          return response.render('index', data);
        }
      });
    })
    .error((error) => console.error(error));

});

app.listen(port, () => {
  console.log('Node app is running on port', port);
});
