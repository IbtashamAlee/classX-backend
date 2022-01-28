var express = require("express");
var router = express.Router();
const sgMail = require("@sendgrid/mail");
var { signupValidation } = require("../../middlewares/userValidation");
var { encryptPassword } = require("../../models/users");
const { PrismaClient } = require(".prisma/client");
require("dotenv").config();
var randomstring = require("randomstring");

const prisma = new PrismaClient();

async function sendVerification(name, email, token) {
  console.log({ "email sending process": email, token });
  const apiKey = `${process.env.SENDGRID_API_KEY}`;
  sgMail.setApiKey(apiKey);
  const msg = {
    to: email, // Change to your recipient
    from: "faseehahmad00@gmail.com", // Change to your verified sender
    template_id: `${process.env.SENDGRID_NEW_POST}`,
    subject: "ClassX Email Verification",
    dynamic_template_data: {
          name: "Faseeh Ahmad",
          VerificationURL: "http://localhost:3000/authentication/verifymail/"+token+"="+email,
        }
  };
  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent");
    })
    .catch((error) => {
      console.error(error);
    });
}

router.post(`/signup`, signupValidation, async (req, res) => {
  let pass = await encryptPassword(req.body.password);
  let EmailVerificationCode = await randomstring.generate(64);
  try {
    const result = await prisma.user.create({
      data: { name: req.body.name, email: req.body.email, password: pass ,createdAt: new Date(), emailToken: EmailVerificationCode},
    });
    await sendVerification(req.body.name,req.body.email,EmailVerificationCode).then(() => {
      return res.send(result);
    });
  } catch (e) {
    return res.send(e);
  }
});

router.get('/verifymail/:id', async (req, res) => {
  const { id } = req.params;
  try{
    const myarray = id.split("=");
    const token = myarray[0];
    const mail = myarray[1];
    console.log("mail is "+mail)
    result  =await prisma.user.findUnique({
      where: {
        email: mail,
      },
    });
    if(token === result.emailToken){
      await prisma.user.update({
        where: {
          email: mail,
        },
        data:{
          isVerified: true,
        }
    });
  }
  return res.send("Email Verified Successfully");
  }
  catch(e){
    return res.send("Unable to Verify .Please Try Again");
  }

});


module.exports = router;
