const Joi = require('joi');
const bcrypt = require('bcrypt');
const userModelSignup = Joi.object(
    {
        name: Joi.string().min(3).max(20).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(3).required(),
    }
);

const userModelLogin = Joi.object(
    {
        email: Joi.string().email().required(),
        password: Joi.string().min(3).required(),
    }
);

function validateUserSignup(data) {
    return userModelSignup.validate(data, {abortEarly: false});
}

function validateUserLogin(data) {
    return userModelLogin.validate(data, {abortEarly: false});
}

async function encryptPassword(password) {
    saltRounds = 10;
    hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword)
}

module.exports.validateUserSignup = validateUserSignup;
module.exports.encryptPassword = encryptPassword;
module.exports.validateUserLogin = validateUserLogin;
module.exports.verifyPassword = verifyPassword;
