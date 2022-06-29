const Bull = require("bull");
const EmailService = require('../backgroundJobs/email-service');
const sendVerification = EmailService.sendVerification;

const consumer = function() {
  const signupVerificationQueue = new Bull('signup-verification');
  signupVerificationQueue.process(async function(job) {
    const {data} = job
    await sendVerification(data.name, data.mail, data.token, data.userId)
      .then(()=>console.log("verification email sent successfully"))
      .catch((e)=>console.log(e))
    return {email: data.email, result: "OK"};
  });
};

consumer();
