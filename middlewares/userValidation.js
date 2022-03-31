const {validateUserSignup, validateUserLogin} = require("../models/users");

function SignupValidation(req, res, next) {
  let {error} = validateUserSignup(req.body);
  if (error) return res.status(400).send(error)
  next();
}

function LoginValidation(req, res, next) {
  let {error} = validateUserLogin(req.body);
  if (error) return res.status(400).send(error)
  next();
}

module.exports.signupValidation = SignupValidation;
module.exports.loginValidation = LoginValidation;
