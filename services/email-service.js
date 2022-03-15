const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
    async sendVerification(name, email, token) {
        return new Promise(function (resolve, reject) {
            const msg = {
                to: email, // User's mail address
                from: process.env.SENDGRID_EMAIL, // Verified SendGrid Mail Address
                template_id: process.env.SENDGRID_MAIL_VERIFY,
                subject: "ClassX Email Verification",
                html: `<a href="http://localhost:${process.env.PORT}/authentication/mail-verify/${token}=${email}">Click here to verify<a/>`,
            };
            sgMail.send(msg).then((res) => {
                console.log('Account verification email sent');
                console.log(res);
                resolve(res);
            }).catch((error) => {
                reject(error);
            });
        })
    }

    async resetPassword(name, email, token) {
        return new Promise(function (resolve, reject) {
            const msg = {
                to: email, // User's mail address
                from: process.env.SENDGRID_EMAIL, // Verified SendGrid Mail Address
                template_id: process.env.SENDGRID_PASSWORD_RESET,
                subject: "ClassX Password Reset",
                html: `<a href="http://localhost:${process.env.PORT}/authentication/password-reset/${token}=${email}">Click here to reset<a/>`,
            };
            sgMail.send(msg).then((res) => {
                console.log("Account reset email sent")
                resolve(res);
            }).catch((error) => {
                reject(error);
            });
        })
    }
}

module.exports = new EmailService();
