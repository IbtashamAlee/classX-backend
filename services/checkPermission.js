const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const safeAwait = require('./safe_await');

async function checkPermission(user, pcode) {
  console.log(pcode)
  const [userPermission, permissionErr] = await safeAwait(prisma.permission.findUnique({
    where: {
      code: pcode
    }
  }));
  let isPermitted = false;
  if (!userPermission || permissionErr) return false;
  user.userRole.map(userRole => {
    userRole.role.rolePermission.map(permission => {
      if (userPermission.id === permission.permissionId) {
        return isPermitted = true;
      }
    })
  })
  return isPermitted;
}

module.exports.checkPermission = checkPermission;
