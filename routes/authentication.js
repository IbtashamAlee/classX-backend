const express = require("express");
const router = express.Router();
const sgMail = require("@sendgrid/mail");
const {signupValidation, loginValidation} = require("../middlewares/userValidation");
const {encryptPassword, verifyPassword} = require("../models/users");
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");
const {PrismaClient} = require(".prisma/client");
const randomstring = require("randomstring");
const jwt = require('jsonwebtoken');
const parser = require("ua-parser-js");
const prisma = new PrismaClient();
require("dotenv").config();

//This function sends an email to the user with a link to verify their email address
async function sendVerification(name, email, token) {
    const apiKey = `${process.env.SENDGRID_API_KEY}`;
    sgMail.setApiKey(apiKey);
    apiKey
    const msg = {
        to: email, // User's mail address
        from: "faseehahmad00@gmail.com", //Verified SendGrid Mail Address
        template_id: `${process.env.SENDGRID_NEW_POST}`, subject: "ClassX Email Verification", dynamic_template_data: {
            name: name, VerificationURL: "http://localhost:3000/authentication/verifymail/" + token + "=" + email,
        },
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

//This is route for user signup and it validates the user data
router.post(`/signup`, signupValidation, async (req, res) => {
    let pass = await encryptPassword(req.body.password);
    let EmailVerificationCode = randomstring.generate(64);
    try {
        const result = await prisma.user.create({
            data: {
                name: req.body.name,
                email: req.body.email,
                password: pass,
                createdAt: new Date(),
                emailToken: EmailVerificationCode,
            },
        });
        await sendVerification(req.body.name, req.body.email, EmailVerificationCode)
            .then(() => {
                return res.send(result);
            });
    } catch (e) {
        return res.send(e);
    }
});

//This route processes user request for email verification
router.get("/verifymail/:id", async (req, res) => {
    const {id} = req.params;
    try {
        const myarray = id.split("=");
        const token = myarray[0];
        const mail = myarray[1];
        console.log("mail is " + mail);
        result = await prisma.user.findUnique({
            where: {
                email: mail,
            },
        });
        if (token === result.emailToken) {
            await prisma.user.update({
                where: {
                    email: mail,
                }, data: {
                    isVerified: true,
                },
            });
        }
        return res.send("Email Verified Successfully. Continue to login");
    } catch (e) {
        return res.send("Unable to Verify .Please Try Again");
    }
});

//This is route for user login
router.post(`/login`, loginValidation, async (req, res) => {
    try {
        await prisma.user.findUnique({
            where: {
                email: req.body.email,
            },
        }).then((user) => {
            if (user) {
                verifyPassword(req.body.password, user.password)
                    .then((result) => {
                        if (result) {
                            if (user.isVerified) {
                                //IF user exists , password matches and user is verified then proceed to login
                                //generating jwt
                                jwt_token = jwt.sign({id: user.id, email: user.email}, process.env.JWT_SECRET);
                                //parsing user agent header for digital finger print
                                const myparser = new parser();
                                myparser.setUA(req.headers["user-agent"]);
                                const result = myparser.getResult();
                                //generating random session token
                                sessionToken = randomstring.generate(255);
                                //generating user session
                                prisma.userSession.create({
                                    data: {
                                        userId: user.id,
                                        createdAt: new Date(),
                                        userAgent: result.ua || "unknown",
                                        ipv4Address: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
                                        ipv6Address: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
                                        device_model: result.device.type + "-" + result.device.vendor + "-"
                                                        + result.device.model || "unknown",
                                        browser_version: result.browser.version || "unknown",
                                        browser_family: result.browser.name || "unknown",
                                        os_family: result.os.name || "unknown",
                                        os_version: result.os.version || "unknown",
                                        token: sessionToken,
                                    }
                                }).then(({sessionToken: token}) => {
                                    return res.send({jwt_token, sessionToken});
                                })
                            } else {
                                return res.send("USER MAIL IS NOT VERIFIED . PLEASE VERIFY YOUR EMAIL TO LOGIN");
                            }
                        } else {
                            return res.send("Password is incorrect");
                        }
                    });
            } else {
                console.log("user not found");
                return res.send("user not found");
            }
        });
    } catch (e) {
        res.send(e);
    }
})


router.post("/sendemailverification", async (req, res) => {
    const mail = req.body.email;
    result = await prisma.user.findUnique({
        where: {
            email: mail,
        },
    });
    console.log(result);
    if (result) {
        verifyPassword(req.body.password, result.password)
            .then((status) => {
                if (status) {
                    if (result.isVerified) return res.send("User is already Verified"); else {
                        sendVerification(result.name, result.email, result.emailToken)
                            .then(emailStatus => {
                                return res.send("Verification Email sent");
                            });
                    }
                } else return res.status(401).send("Not Authorized");
            })
    } else return res.status(404).send("User not Found");
});

router.post('/makeAdmin',verifySystemAdmin,async(req,res)=>{
    try {
        if (req.body.email) {
            const user = await prisma.user.findUnique({
                where: {
                    email: req.body.email,
                }
            })
            if (user) {
                const role = await prisma.role.findMany({
                    where: {
                        name: "SystemAdmin"
                    }
                });
                const userRole = await prisma.userRole.create({
                    data: {
                        userId: user.id,
                        roleId: role[0].id
                    }
                })
                res.status(200).send({resp: "admin previleges created for user", userRole});
            } else
                res.status(404).send("User not found");
        } else
            return res.status(401).send("email not provided");
    }
    catch (e){
        if(e.code === 'P2002'){
            return res.send("Role Already Exists");
        }
        return res.status(500).send("An error occured");
    }
    });


module.exports = router;