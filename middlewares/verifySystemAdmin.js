const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const safeAwait  = require('../services/safe_await');

async function verifySystemAdmin(req, res, next) {
    const user = req.user;
    const [role,roleErr] = await safeAwait(prisma.role.findUnique({
        where: {
            name: "SystemAdmin",
        }
    }));
    if(roleErr) return res.status(409).send("unable to fetch System Admin Role")
    if(!role) return res.status(404).send("role not found");
    const verifiedRole = user.userRole.filter(t => {
            return t.roleId === role.id
    })
    verifiedRole.length > 0 ? next() : res.status(401).send("unauthorized");
}

module.exports.verifySystemAdmin = verifySystemAdmin;
