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
            emailTokenGen: new Date()
        },
    }));
    if (newUserErr) return res.status(409).send("unable to create user");
    const [, emailErr] = await safeAwait(sendVerification(req.body.name, newUser.email, emailVerificationToken, newUser.id));
    if (emailErr) return res.status(200).send("user created successfully.unable to send email try again")
    return res.status(200).send("user created successfully");
});


//This route processes user request for email verification
router.get("/mail-verify/:token", async (req, res) => {
    const temp = req.params.token.split('=');
    const userId = temp[1];
    const token = temp[0];
    const [user] = await safeAwait(prisma.user.findUnique({
        where: {
            id: parseInt(userId)
        },
    }));
    if (!user) return res.status(400).send("invalid verification token.")
    if (user.isVerified) return res.send("user already verified")
    if (!(user.emailToken === token)) return res.status(409).send("invalid token");
    //check if code is generated within 48 hrs
    if (!(parseInt(new Date() - user.emailTokenGen) < (48 * 60 * 60 * 1000)))
        return res.status(409).send("verification code expired. Please try again");
    const [, updatedUserErr] = await safeAwait(prisma.user.update({
        where: {
            id: parseInt(userId),
        }, data: {
            isVerified: true,
            emailToken: null
        },
    }));
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
    if (!session || sessionErr) return res.status(409).send("unable to login")
    return res.status(200).send({access_token: session.token});
})

// manually resend verification to registered user
router.post("/send-mail-verification", async (req, res) => {
    if (!req.body.email) return res.status(404).send("email not provided");
    const mail = req.body.email;
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
            email: mail,
        },
    }))
    if (!user) return res.status(404).send("User not Found");
    if (userErr) return res.status(409).send("unable to find user");
    // const validPassword = await verifyPassword(req.body.password, user.password)
    // if (!validPassword) return res.status(401).send("Not Authorized");
    if (user.isVerified) return res.send("User is already Verified");
    const token = randomstring.generate(64)
    const [, updatedUserErr] = await safeAwait(prisma.user.update({
        where: {
            email: mail,
        },
        data: {
            emailToken: token,
            emailTokenGen: new Date()
        }
    }))
    const [, emailErr] = await safeAwait(sendVerification(user.name, user.email, token, user.id));
    if (updatedUserErr) return res.status(409).send("unable to send verification");
    return emailErr ? res.status(409).send({
        message: "unable to send verification",
        err: emailErr
    }) : res.send("verification code sent")
});

//System admin can make another user system admin
router.post('/make-admin', verifyUser, verifySystemAdmin, async (req, res) => {
    if (!req.body.email) return res.status(401).send("email not provided");
    const [user] = await safeAwait(prisma.user.findUnique({
        where: {
            email: req.body.email,
        }
    }))
    if (!user) return res.status(404).send("User not found");
    const [role] = await safeAwait(prisma.role.findUnique({
        where: {
            name: "SystemAdmin"
        }
    }));
    if (!role) return res.status(409).send("unable to find System Admin Role")
    const [userRole, userRoleErr] = await safeAwait(prisma.userRole.create({
        data: {
            userId: user.id, roleId: role.id
        }
    }))
    if (!userRole || userRoleErr) return res.status(409).send({
        message: 'unable to create user role',
        error: userRoleErr
    });
    return res.status(200).send({message: "admin privileges created for user " + user.email});
});

//if session id is provided then it will expire provided session Otherwise current session would be logged out
router.put("/logout", verifyUser, async (req, res) => {
    const [, loggingOutErr] = await safeAwait(prisma.userSession.update({
        where: {
            id: req.body.sessionId ? req.body.sessionId : req.session
        }, data: {
            token: null
        }
    }));
    if (loggingOutErr) return res.status(409).send("unable to log out");
    return res.send("user logged out successfully");
});

//get user's active sessions
router.get("/sessions", verifyUser, async (req, res) => {
    let [sessions, sessionErr] = await safeAwait(prisma.userSession.findMany({
        where: {
            userId: req.user.id,
        },
    }))
    if (!sessions || sessionErr) return res.send("unable to fetch sessions");
    res.send(sessions);
})

router.post('/password-reset', async (req, res) => {
    if (!req.body.email) return res.send("email not provided");
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
            email: req.body.email
        }
    }));
    if (!user || userErr) return res.status(404).send("user not found");
    const token = randomstring.generate((64));
    const [updatedUser, updatedErr] = await safeAwait(prisma.user.update({
        where: {
            email: req.body.email
        },
        data: {
            resetToken: token,
            resetTokenGen: new Date()
        }
    }))
    if (updatedErr) return res.status(409).send("unable to genereate reset code")
    const [, resetMailErr] = await safeAwait(resetPassword(user.name, user.email, token, user.id));
    if (resetMailErr) return res.status(409).send("unable to send password reset email")
    return res.send(updatedUser);
})

router.post("/password-reset/:token", async (req, res) => {
    if (!req.body.password) return res.status(404).send("password not provided");
    const [newPassword] = await safeAwait(encryptPassword(req.body.password))
    const temp = req.params.token.split("=");
    const token = temp[0];
    const userId = temp[1];
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
            id: parseInt(userId),
        },
    }))
    if (!user || userErr) return res.status(404).send("unable to find user");
    if (!(user.resetToken === token)) return res.status(409).send("invalid token");
    //check if code is generated within 24 hrs
    if (!(parseInt(new Date() - user.resetTokenGen) < (24 * 60 * 60 * 1000)))
        return res.status(409).send("Password Reset Token has expired. Please try again");
    const [updatedUser, updatedErr] = await safeAwait(prisma.user.update({
        where: {
            id: parseInt(userId)
        },
        data: {
            password: newPassword,
            resetToken: null,
            resetTokenGen: new Date()
        }
    }));
    if (!updatedUser || updatedErr) return res.status(409).send({message: "unable to reset password", err: updatedErr});
    return res.send("password updated successfully");
})

module.exports = router;
