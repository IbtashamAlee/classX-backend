const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()
const safeAwait = require('../services/safe_await')

async function verifyUser(req, res, next) {
  let token = req.header('Authorization') ? req.header('Authorization').split(" ")[1] : null;
  if (!token) return res.status(401).send("Token not provided");
  const [session, sessionErr] = await safeAwait(prisma.userSession.findUnique({
    where: {
      token: token,
    },
    include: {
      user: {
        include: {
          userRole: {
            include: {
              role: {
                include: {
                  rolePermission: {
                    include: {
                      permission: {
                        select :{
                          code : true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }));
  if (sessionErr) return res.status(401).send("unable to fetch user");
  if (!session) return res.status(401).send("invalid token");
  if (session.user) {
    req.user = session.user
    req.session = session.id;
    return next();
  } else
    return res.status(401).send("user not found");
}

module.exports.verifyUser = verifyUser;
