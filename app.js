
const createError = require('http-errors');
const express = require('express');
const path = require('path');
// this line is added in case env constiables are not getting to other files.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
// routes import
const usersRouter = require('./routes/users');
const membersRouter = require('./routes/members');
const feeRouter = require('./routes/monthlyFee');
const indexRouter = require('./routes/index');
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
const corsOptions = {
  "origin": "*",
  "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
  "preflightContinue": false,
  "optionsSuccessStatus": 204,
  "exposedHeaders": "authorization,x-access-token,new-token,invalidToken,refresh-token,AuthToken,RefreshToken"
}
app.use(cors(corsOptions))

app.use(bodyParser.json({ limit: '150mb' }));
app.use(bodyParser.urlencoded({ limit: '150mb', extended: true, parameterLimit: 50000 }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(function (req, res, next) {
  req.response = {
    status: false,
    message: '',
    data: {}
  };
  next();
})

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/users', usersRouter);
app.use('/members', membersRouter);
app.use('/fees', feeRouter);
app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
