const {validateUserSignup} = require("../models/users");

function SignupValidation(req,res,next) {
    let {error} = validateUserSignup(req.body);
    if(error) return res.status(400).send(error)
    next();
}

module.exports.signupValidation = SignupValidation;
