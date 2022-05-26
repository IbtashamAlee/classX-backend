const Bull = require("bull");
const EmailService = require('./email-service');
const sendVerification = EmailService.sendVerification;

const consumer = function () {
  console.log("Bull Started!");
  const signupVerificationQueue = new Bull('signup-verification');
  signupVerificationQueue.process(async function (job) {
    let data = job['data'];
    console.log(data)
    sendVerification(data.name, data.mail, data.token, data.userId)
      .then(() => console.log("verification email sent successfully"))
      .catch((e) => console.log(e))
    return {email: data.email, result: "OK"};
  });
};

consumer();
