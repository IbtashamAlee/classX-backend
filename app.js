const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authenticationRouter = require('./routes/authentication');
const instituteRouter = require('./routes/institute');
const departmentRouter = require('./routes/department');
const fileRouter = require('./routes/file');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/authentication', authenticationRouter);
app.use('/institutes', instituteRouter);
app.use('/departments', departmentRouter);
app.use('/file', fileRouter)

module.exports = app;
