const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();

async function verifySystemAdmin(req, res, next) {
    try {
        const user = req.user;
        const role = await prisma.role.findMany({
            where: {
                name: "SystemAdmin",
            },
        });
        const dbUser = await prisma.user.findUnique({
            where: {
                id: user.id,
            }, include: {
                userRole: {
                    where: {
                        userId: user.id, roleId: role[0].id,
                    },
                },
            },
        });

        return dbUser.userRole.length > 0 ? next() : res.status(401).send("not authorized");
    } catch (e) {
        return res.status(401).send("not authorized");
    }
}

module.exports.verifySystemAdmin = verifySystemAdmin;
