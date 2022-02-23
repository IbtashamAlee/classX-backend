const jwt = require("jsonwebtoken");
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyUser(req, res, next) {
    try {
        let token = req.header('Authorization').split(" ")[1];
        if (!token) return res.status(400).send("Token not provided");
        let user;
        await jwt.verify(token, process.env.JWT_SECRET, (err,decoded) => {
            user = decoded;
        });
        if (!user) return res.status(403).send("invalid token");
        const dbUser = await prisma.user.findUnique({
            where: {
                id: user.id
            }
        })
        if (dbUser) {
            req.user = dbUser
            next();
        } else return res.status(404).send("user not found");
    } catch (e) {        return res.status(401).send("not authorized");
    }

}

module.exports.verifyUser = verifyUser;