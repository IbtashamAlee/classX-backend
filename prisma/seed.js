const{ PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createSystemAdminRole(){
    permissions = [{name:"Can approve institute Requests",code:'01'},
                   {name:"Can read, delete an institute",code:'02'},
                    {name:"Can read, delete a department",code:'03'},
                    {name:"Can read, delete a class",code:'04'},
                    {name:"Can read, delete a user",code:'05'}]

        const role  = await prisma.role.create({
            data:{
                name: "SystemAdmin"
            }
        })

        // console.log(userRole);
        permissions.map(async per => {
            const permission = await prisma.permission.create({
                data:{
                    name:per.name,
                    code:per.code
                }
            })
            const rolePermission = await prisma.rolePermission.create({
                data:{
                    permissionId:permission.id,
                    roleId : role.id
                }
            })
            console.log(rolePermission)
        })


}

async function makeSystemAdmin(email){
    const user  = await prisma.user.findUnique({
        where:{
            email:email
        }
    })
    if(user){
        const role = await prisma.role.findUnique({
            where:{
                name:"SystemAdmin"
            }
        });
        await prisma.userRole.create({
            data:{
                userId:user.id,
                roleId:role.id
            }
        })
    }
    else
        console.log("User not found");
}


createSystemAdminRole().then(()=>{
    makeSystemAdmin("faseehahmad21@gmail.com")
        .then(()=> {
            console.log("user now has admin previleges");
        })
})

