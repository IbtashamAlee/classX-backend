const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();

async function verifySystemAdmin(req, res, next) {
    const user = req.user;
    const role = await prisma.role.findMany({
        where: {
            name: "SystemAdmin",
        }
    });
    if (role.length > 0) {
        const verifiedRole = user.userRole.filter(t => {
            return t.roleId === role[0].id
        })
        verifiedRole.length > 0 ? next() : res.status(401).send("unauthorized")
    } else
        return res.status(404).send("Admin Role does not exist.")
}

module.exports.verifySystemAdmin = verifySystemAdmin;
