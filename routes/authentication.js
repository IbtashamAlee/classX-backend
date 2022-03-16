const express = require("express");
const router = express.Router();
const {signupValidation, loginValidation} = require("../middlewares/userValidation");
const {encryptPassword, verifyPassword} = require("../models/users");
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");
const {PrismaClient} = require(".prisma/client");
const randomstring = require("randomstring");
const parser = require("ua-parser-js");
const {verifyUser} = require("../middlewares/verifyUser");
const prisma = new PrismaClient();
const EmailService = require('../services/email-service');
const sendVerification = EmailService.sendVerification;
const resetPassword = EmailService.resetPassword;
const safeAwait = require('../services/safe_await');

router.post(`/signup`, signupValidation, async (req, res) => {
    let [pass] = await safeAwait(encryptPassword(req.body.password));
    const [user] = await safeAwait(
        prisma.user.findUnique({
            where: {
                email: req.body.email
            }
        }))
    if (user) return res.send("user already exists");
    const emailVerificationToken = randomstring.generate(64);
    const [newUser, newUserErr] = await safeAwait(prisma.user.create({
        data: {
            name: req.body.name,
            email: req.body.email,
            password: pass,
            createdAt: new Date(),
            emailToken: emailVerificationToken,
        },
    }));
    if (newUserErr) return res.status(409).send("unable to create user");
    const [_, emailErr] = await safeAwait(sendVerification(req.body.name, newUser.email, emailVerificationToken, newUser.id));
    if (emailErr) return res.status(200).send("user created successfully.unable to send email try again")
    return res.status(200).send("user created successfully");
});


//This route processes user request for email verification
router.get("/mail-verify/:token", async (req, res) => {
    const userId = req.params.token.split('=')[1];
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
            id: parseInt(userId)
        },
    }));
    if (!user) return res.status(400).send("invalid verification token.")
    if (user.isVerified) return res.send("user already verified")
    const [updatedUser, updatedUserErr] = await safeAwait(prisma.user.update({
        where: {
            id: parseInt(userId),
        }, data: {
            isVerified: true,
        },
    }))
    if (updatedUserErr) return res.status(409).send("unable to verify.Please try again")
    return res.send("user verified successfully.")
});

//This is route for user login
router.post(`/signin`, loginValidation, async (req, res) => {
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
            email: req.body.email,
        },
    }))
    if (!user) return res.status(404).send("User not found");
    if (userErr) return res.status(409).send("An error occurred")
    const [validPassword, validPassError] = await safeAwait(verifyPassword(req.body.password, user.password));
    if (validPassError) return res.status(409).send("Unable to verify password")
    if (!validPassword) return res.status(403).send("Password is incorrect");
    if (!user.isVerified) return res.status(401).send("Please verify your email first");
    const myParser = new parser();
    myParser.setUA(req.headers["user-agent"]);
    const result = myParser.getResult();
    const sessionToken = randomstring.generate(240);
    const [session, sessionErr] = await safeAwait(prisma.userSession.create({
        data: {
            userId: user.id,
            createdAt: new Date(),
            userAgent: result.ua || "unknown",
            ipv4Address: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            ipv6Address: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            device_model: result.device.type + "-" + result.device.vendor + "-" + result.device.model || "unknown",
            browser_version: result.browser.version || "unknown",
            browser_family: result.browser.name || "unknown",
            os_family: result.os.name || "unknown",
            os_version: result.os.version || "unknown",
            token: sessionToken + user.id,
        }
    }));
    if (sessionErr) return res.status(409).send("unable to login")
    return res.status(200).send({access_token: session.token});
})

// manually resend verification to registered user
router.post("/send-mail-verification", async (req, res) => {
    const mail = req.body.email;
    const user = await prisma.user.findUnique({
        where: {
            email: mail,
        },
    });
    if (!user) return res.status(404).send("User not Found");
    const validPassword = await verifyPassword(req.body.password, user.password)
    if (!validPassword) return res.status(401).send("Not Authorized");
    if (user.isVerified) return res.send("User is already Verified");
    const [e, emailErr] = await safeAwait(sendVerification(user.name, user.email, user.emailToken, user.id));
    return emailErr ? res.status(409).send("unable to send verification\n" + emailErr) : res.send("verification code sent")
});

//System admin can make another user system admin
router.post('/makeAdmin', verifyUser, verifySystemAdmin, async (req, res) => {
    try {
        if (!req.body.email) return res.status(401).send("email not provided");
        const user = await prisma.user.findUnique({
            where: {
                email: req.body.email,
            }
        })
        if (!user) return res.status(404).send("User not found");
        const role = await prisma.role.findMany({
            where: {
                name: "SystemAdmin"
            }
        });
        const userRole = await prisma.userRole.create({
            data: {
                userId: user.id, roleId: role[0].id
            }
        })
        return res.status(200).send({resp: "admin privileges created for user", userRole});
    } catch (e) {
        if (e.code === 'P2002') {
            return res.status(409).send("Role Already Exists");
        }
        return res.status(500).send("An error occurred");
    }
});

//if session id is provided then it will expire provided session Otherwise current session would be logged out
router.put("/logout", verifyUser, async (req, res) => {
    prisma.userSession.update({
        where: {
            id: req.body.sessionId ? req.body.sessionId : req.session
        }, data: {
            token: null
        }
    }).then(() => res.send("User logged out successfully"));
})

//get user's active sessions
router.get("/sessions", verifyUser, async (req, res) => {
    let sessions = await prisma.userSession.findMany({
        where: {
            userId: req.user.id,
        },
    })
    sessions = sessions.filter(s => {
        return s.token !== null
    })
    res.json(sessions);
})

router.post('/password-reset', async (req, res) => {
    prisma.user.findUnique({
        where: {
            email: req.body.email
        }
    }).then(user => {
        if (user) {
            let resetToken = randomstring.generate(64);
            prisma.user.update({
                where: {
                    email: req.body.email
                },
                data: {
                    resetToken: resetToken
                }
            }).then((response) => {
                if (response) {
                    resetPassword(user.name, user.email, resetToken).then((result) => {
                        res.status(200).send("Reset link has been sent successfully")
                    }).catch(err => {
                        console.log(err);
                        res.status(409).send("Unable to send email");
                    })
                } else {
                    res.status(404).send("Could not find user");
                }
            }).catch(err => {
                res.status(409).send("Unable to update reset link");
            })
        }
    }).catch(err => {
        res.status(409).send("Something went wrong");
    })
})

router.get("/password-reset/:token", async (req, res) => {
    const temp = req.params.token.split("=");
    const token = temp[0];
    const mail = temp[1];
    prisma.user.findUnique({
        where: {
            email: mail,
        },
    }).then(user => {
        if (user) {
            if (token !== user.resetToken) {
                res.status(400).send("invalid reset token.")
            } else {
                res.status(200).send("Reset token verified!");
            }
        } else {
            res.status(404).send("Unable to find user")
        }
    }).catch(err => {
        res.status(409).send("Unable to fetch user");
    })
})

module.exports = router;
