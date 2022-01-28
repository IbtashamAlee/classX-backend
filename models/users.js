const Joi = require('joi');
const bcrypt = require('bcrypt');

const userModelSignup = Joi.object(
    {
        name:Joi.string().min(3).max(20).required(),
        email: Joi.string().email().required(),
        password :Joi.string().min(3).required(),
    }
);

function validateUserSignup(data){
    return userModelSignup.validate(data,{abortEarly:false});
}

async function encryptPassword(password){
    saltRounds = 10;
    hashedPassword =  await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

module.exports.validateUserSignup = validateUserSignup;
module.exports.encryptPassword = encryptPassword;