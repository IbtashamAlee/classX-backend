const jwt = require("jsonwebtoken");
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyUser(req, res, next) {
    try {
    let token = req.header("auth-token");
    if (!token)
        return res.status(400).send("Token not provided");
        const user = jwt.verify(token, process.env.JWT_SECRET);
        if (!user)
            return res.status(403).send("invalid token");
        const dbUser = await prisma.user.findUnique({
            where: {
                id: user.id
            }
        })
        req.user = dbUser;
        next();
    } catch (e) {
        return res.status(401).send("not authorized");
    }

}

module.exports.verifyUser = verifyUser;