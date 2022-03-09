const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
    async sendVerification(name, email, token) {
        return new Promise(function (resolve, reject) {
            const msg = {
                to: email, // User's mail address
                from: process.env.sendGridEmail, // Verified SendGrid Mail Address
                template_id: process.env.SENDGRID_NEW_POST,
                subject: "ClassX Email Verification",
                dynamic_template_data: {
                    name: name,
                    VerificationURL: "http://localhost:3000/authentication/verifymail/" + token + "=" + email,
                },
            };
            sgMail.send(msg).then((res) => {
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
                from: process.env.sendGridEmail, // Verified SendGrid Mail Address
                template_id: process.env.SENDGRID_NEW_POST,
                subject: "ClassX account password reset",
                dynamic_template_data: {
                    name: name,
                    VerificationURL: "http://localhost:3000/authentication/reset-password/" + token + "=" + email,
                },
            };
            sgMail.send(msg).then((res) => {
                resolve(res);
            }).catch((error) => {
                reject(error);
            });
        })
    }
}

module.exports = new EmailService();
