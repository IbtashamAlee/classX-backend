const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
require('dotenv').config();

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authenticationRouter = require('./routes/authentication');
const instituteRouter = require('./routes/institute');
const departmentRouter = require('./routes/department');
const fileRouter = require('./routes/file');
const classRouter = require('./routes/class');
const assessmentRouter = require('./routes/assessment');
const chatRouter = require('./routes/chat');
const statsRouter = require('./routes/stats');
const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/user', usersRouter);
app.use('/auth', authenticationRouter);
app.use('/institutes', instituteRouter);
app.use('/departments', departmentRouter);
app.use('/file', fileRouter);
app.use('/class', classRouter);
app.use('/assessment', assessmentRouter);
app.use('/chat', chatRouter);
app.use('/stats', statsRouter);

module.exports = app;
