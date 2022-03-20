const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();

async function checkPermission(user, pcode) {
    const userPermission = await prisma.permission.findUnique({
        where: {
            code: pcode
        }
    });
    let isPermitted = false;
    if (!userPermission) return false;
    user.userRole.map(userRole => {
        userRole.role.rolePermission.map(permission => {
            if (userPermission.id === permission.permissionId)
                return isPermitted = true;
        })
    })
    return isPermitted;
}

module.exports.checkPermission = checkPermission;
