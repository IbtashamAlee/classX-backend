const jwt = require("jsonwebtoken");
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

async function verifySystemAdmin(req, res, next) {
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
        const role = await prisma.role.findMany({
            where: {
                name: "SystemAdmin"
            }
        })
        const userRole = await prisma.userRole.findMany({
            where: {
                userId: dbUser.id,
                roleId: role[0].id
            }
        })
        if(userRole.length > 0)
            next();
        else
            return res.status(401).send("not authorized")

    } catch (e) {
        return res.status(401).send("not authorized");
    }

}

module.exports.verifySystemAdmin = verifySystemAdmin;