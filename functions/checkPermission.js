const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();

async function checkPermission(user,pcode){
    const userPermission = await prisma.permission.findUnique({
        where:{
            code: pcode
        }
    });
    let isPermitted = false;
    if(!userPermission) return 0;
    user.userRole.map(userRole => {
        userRole.role.rolePermission.map(permission=>{
            if(userPermission.id === permission.permissionId)
                isPermitted = true;
        })
    })
    return isPermitted;
}

module.exports.checkPermission  = checkPermission;