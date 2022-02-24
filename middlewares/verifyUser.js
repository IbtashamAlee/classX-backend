const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyUser(req, res, next) {
    let token = req.header('Authorization')?req.header('Authorization').split(" ")[1]:null;
    if (!token) return res.status(400).send("Token not provided");
    const session = await prisma.userSession.findUnique({
        where: {
            token: token,
        },
        include: {
            user: {
                include: {
                    userRole: true
                }
            }
        }
    });
    if (!session) return res.status(403).send("invalid token");
    if (session.user) {
        req.user = session.user
        req.session = session.id;
        return next();
    }
    else
        return res.status(404).send("user not found");
}

module.exports.verifyUser = verifyUser;