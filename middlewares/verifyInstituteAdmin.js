const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();

async function verifyInstituteAdmin(req, res, next) {
    if (!req.params.id) return res.status(400).send("can read institute id");
    const institute = await prisma.institute.findUnique({
        where: {
            id: parseInt(req.params.id)
        }
    })
    if (!institute) return res.status(404).send("institute not found");
    if (institute.adminId !== req.user.id) return res.status(401).send("unauthorized")
    next();
}

module.exports.verifyInstituteAdmin = verifyInstituteAdmin;
